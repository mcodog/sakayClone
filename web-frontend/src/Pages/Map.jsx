import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Polyline,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

// Colors for different transportation modes
const TRANSPORT_COLORS = {
  jeepney: "#FF4500", // OrangeRed
  bus: "#1E90FF", // DodgerBlue
  tricycle: "#32CD32", // LimeGreen
  walk: "#9932CC", // DarkOrchid
};

const CommuteGuide = () => {
  const [geojsonData, setGeojsonData] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [mapKey, setMapKey] = useState(0);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [suggestedRoutes, setSuggestedRoutes] = useState([]);
  const [transportModes, setTransportModes] = useState({});
  const [loading, setLoading] = useState(true);

  // Parse URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const originLat = parseFloat(params.get("originLat"));
    const originLng = parseFloat(params.get("originLng"));
    const destLat = parseFloat(params.get("destinationLat"));
    const destLng = parseFloat(params.get("destinationLng"));

    if (!isNaN(originLat) && !isNaN(originLng)) {
      setOrigin({ lat: originLat, lng: originLng });
    }

    if (!isNaN(destLat) && !isNaN(destLng)) {
      setDestination({ lat: destLat, lng: destLng });
    }
  }, []);

  // Load GeoJSON data
  useEffect(() => {
    const loadGeoJSON = async () => {
      setLoading(true);
      try {
        const response = await fetch("../data/export.geojson");
        const data = await response.json();

        // Add transport mode to each route if not already present
        const processedData = data.features.map((feature) => {
          if (!feature.properties.transportMode) {
            // Randomly assign a transport mode based on route characteristics
            // This is a simplified approach - in real application, you'd use actual data
            const routeName = feature.properties.name?.toLowerCase() || "";
            let mode = "jeepney"; // Default

            if (routeName.includes("bus")) {
              mode = "bus";
            } else if (routeName.includes("tricycle")) {
              mode = "tricycle";
            } else if (feature.properties.length < 0.5) {
              // Short routes might be tricycle routes
              mode = "tricycle";
            } else if (feature.properties.length > 5) {
              // Longer routes might be bus routes
              mode = "bus";
            }

            return {
              ...feature,
              properties: {
                ...feature.properties,
                transportMode: mode,
              },
            };
          }
          return feature;
        });

        setGeojsonData(processedData || []);
      } catch (error) {
        console.error("Error loading GeoJSON:", error);
        setGeojsonData([]);
      } finally {
        setLoading(false);
      }
    };

    loadGeoJSON();
  }, []);

  // Build commute routes when origin, destination, and geojsonData are all available
  useEffect(() => {
    if (origin && destination && geojsonData.length > 0) {
      buildCommuteRoutes();
    }
  }, [origin, destination, geojsonData]);

  // Function to calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Calculate nearest point on a line to a given point
  const nearestPointOnLine = (point, lineStart, lineEnd) => {
    const x1 = lineStart[0];
    const y1 = lineStart[1];
    const x2 = lineEnd[0];
    const y2 = lineEnd[1];
    const px = point[0];
    const py = point[1];

    // Line segment length squared
    const segmentLengthSq = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);

    // If zero length line, return start point
    if (segmentLengthSq === 0) return [x1, y1];

    // Calculate projection parameter
    const t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / segmentLengthSq;

    if (t < 0) return [x1, y1]; // Beyond start point
    if (t > 1) return [x2, y2]; // Beyond end point

    // Projection on line
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };

  // Find minimum distance from a point to a route and return the nearest point
  const minDistanceAndPointToRoute = (point, route) => {
    let minDist = Infinity;
    let nearestCoord = null;

    // For each route, check all line segments
    if (route.geometry && route.geometry.coordinates) {
      const coords = route.geometry.coordinates;

      // For LineString
      if (route.geometry.type === "LineString") {
        for (let i = 0; i < coords.length - 1; i++) {
          const start = coords[i];
          const end = coords[i + 1];
          const nearest = nearestPointOnLine(
            [point.lng, point.lat],
            start,
            end
          );
          const dist = calculateDistance(
            point.lat,
            point.lng,
            nearest[1],
            nearest[0]
          );
          if (dist < minDist) {
            minDist = dist;
            nearestCoord = nearest;
          }
        }
      }
      // For MultiLineString
      else if (route.geometry.type === "MultiLineString") {
        for (const line of coords) {
          for (let i = 0; i < line.length - 1; i++) {
            const start = line[i];
            const end = line[i + 1];
            const nearest = nearestPointOnLine(
              [point.lng, point.lat],
              start,
              end
            );
            const dist = calculateDistance(
              point.lat,
              point.lng,
              nearest[1],
              nearest[0]
            );
            if (dist < minDist) {
              minDist = dist;
              nearestCoord = nearest;
            }
          }
        }
      }
    }

    return {
      distance: minDist,
      point: nearestCoord ? [nearestCoord[1], nearestCoord[0]] : null,
    };
  };

  // Extract coordinates from a GeoJSON feature
  const extractCoordinates = (feature) => {
    if (!feature.geometry) return [];

    const coords = [];
    if (feature.geometry.type === "LineString") {
      return feature.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
    } else if (feature.geometry.type === "MultiLineString") {
      feature.geometry.coordinates.forEach((line) => {
        line.forEach((coord) => {
          coords.push([coord[1], coord[0]]);
        });
      });
    }
    return coords;
  };

  // Create a walking path between points
  const createWalkingPath = (from, to) => {
    // For simplicity, create a direct line
    return {
      type: "Feature",
      properties: {
        name: "Walking Path",
        transportMode: "walk",
        distance: calculateDistance(from[0], from[1], to[0], to[1]),
        duration: calculateDistance(from[0], from[1], to[0], to[1]) * 12, // Assuming 5km/h walking speed (12 min per km)
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [from[1], from[0]],
          [to[1], to[0]],
        ],
      },
    };
  };

  // Build multimodal commute routes
  const buildCommuteRoutes = () => {
    if (!origin || !destination || loading) return;

    // First, find nearest points on available routes for origin and destination
    const routeAccessPoints = geojsonData.map((route) => {
      const originAccess = minDistanceAndPointToRoute(origin, route);
      const destAccess = minDistanceAndPointToRoute(destination, route);

      return {
        route,
        originAccess,
        destAccess,
        score:
          originAccess.distance +
          destAccess.distance +
          extractCoordinates(route).length / 100, // Consider route complexity
      };
    });

    // Sort by accessibility score
    const sortedRoutes = routeAccessPoints.sort((a, b) => a.score - b.score);

    // Get top routes for building our suggestions
    const topRoutes = sortedRoutes.slice(0, Math.min(5, sortedRoutes.length));

    // Build first suggestion - direct route with fewest transfers
    const directRoute = buildDirectRoute(topRoutes[0]);

    // Build second suggestion - potentially faster but more transfers
    const alternativeRoute = buildAlternativeRoute(topRoutes);

    setSuggestedRoutes([directRoute, alternativeRoute]);
    setSelectedRoute(directRoute);
    setMapKey((prevKey) => prevKey + 1);
  };

  // Build a direct route option
  const buildDirectRoute = (routeData) => {
    if (!routeData) return null;

    const route = routeData.route;
    const walkToRoute = createWalkingPath(
      [origin.lat, origin.lng],
      routeData.originAccess.point
    );

    const walkFromRoute = createWalkingPath(routeData.destAccess.point, [
      destination.lat,
      destination.lng,
    ]);

    // Calculate total journey details
    const totalDistance =
      walkToRoute.properties.distance +
      (route.properties.length || 0) +
      walkFromRoute.properties.distance;

    // Estimate times based on mode of transport
    let mainRouteDuration = 0;
    if (route.properties.transportMode === "bus") {
      mainRouteDuration = (route.properties.length || 0) * 3; // 20km/h
    } else if (route.properties.transportMode === "jeepney") {
      mainRouteDuration = (route.properties.length || 0) * 4; // 15km/h
    } else if (route.properties.transportMode === "tricycle") {
      mainRouteDuration = (route.properties.length || 0) * 5; // 12km/h
    }

    const totalDuration =
      walkToRoute.properties.duration +
      mainRouteDuration +
      walkFromRoute.properties.duration;

    return {
      name: `${route.properties.transportMode.toUpperCase()}: ${
        route.properties.name
      }`,
      segments: [
        { ...walkToRoute, position: 0 },
        { ...route, position: 1 },
        { ...walkFromRoute, position: 2 },
      ],
      totalDistance,
      totalDuration,
      transfers: 2, // Number of transfers (walk->transport->walk)
      description: `Walk to ${route.properties.transportMode} → ${route.properties.name} → Walk to destination`,
    };
  };

  // Build a potentially more complex but efficient route
  const buildAlternativeRoute = (routesData) => {
    if (routesData.length < 2) {
      // If we don't have enough routes, just return something similar to direct route
      return buildDirectRoute(routesData[0]);
    }

    // Try to find a combination of routes
    // For simplicity, let's use the first and second best route
    const firstRoute = routesData[0].route;
    const secondRoute = routesData[1].route;

    // Find an intersection point (this is simplified - real implementation would be more complex)
    // Here we're just using the nearest points between routes
    const intersectionPoint = findNearestPointsBetweenRoutes(
      firstRoute,
      secondRoute
    );

    // Create the segments
    const walkToFirstRoute = createWalkingPath(
      [origin.lat, origin.lng],
      routesData[0].originAccess.point
    );

    // Create a transfer segment
    const transferSegment = createWalkingPath(
      intersectionPoint.firstRoutePoint,
      intersectionPoint.secondRoutePoint
    );

    const walkToDestination = createWalkingPath(
      routesData[1].destAccess.point,
      [destination.lat, destination.lng]
    );

    // Calculate total journey details
    const totalDistance =
      walkToFirstRoute.properties.distance +
      (intersectionPoint.firstRouteDistance || 0) +
      transferSegment.properties.distance +
      (intersectionPoint.secondRouteDistance || 0) +
      walkToDestination.properties.distance;

    // Estimate times
    let firstRouteDuration = getDurationForMode(
      firstRoute.properties.transportMode,
      intersectionPoint.firstRouteDistance
    );

    let secondRouteDuration = getDurationForMode(
      secondRoute.properties.transportMode,
      intersectionPoint.secondRouteDistance
    );

    const totalDuration =
      walkToFirstRoute.properties.duration +
      firstRouteDuration +
      transferSegment.properties.duration +
      secondRouteDuration +
      walkToDestination.properties.duration;

    // Create partial route segments
    const firstPartialRoute = createPartialRoute(
      firstRoute,
      routesData[0].originAccess.point,
      intersectionPoint.firstRoutePoint,
      intersectionPoint.firstRouteDistance
    );

    const secondPartialRoute = createPartialRoute(
      secondRoute,
      intersectionPoint.secondRoutePoint,
      routesData[1].destAccess.point,
      intersectionPoint.secondRouteDistance
    );

    return {
      name: `${firstRoute.properties.transportMode.toUpperCase()} → ${secondRoute.properties.transportMode.toUpperCase()}`,
      segments: [
        { ...walkToFirstRoute, position: 0 },
        { ...firstPartialRoute, position: 1 },
        { ...transferSegment, position: 2 },
        { ...secondPartialRoute, position: 3 },
        { ...walkToDestination, position: 4 },
      ],
      totalDistance,
      totalDuration,
      transfers: 4, // Number of transfers
      description: `Walk to ${firstRoute.properties.transportMode} → ${firstRoute.properties.name} → Transfer to ${secondRoute.properties.transportMode} → ${secondRoute.properties.name} → Walk to destination`,
    };
  };

  // Get duration based on transport mode
  const getDurationForMode = (mode, distance) => {
    if (mode === "bus") {
      return distance * 3; // 20km/h
    } else if (mode === "jeepney") {
      return distance * 4; // 15km/h
    } else if (mode === "tricycle") {
      return distance * 5; // 12km/h
    } else {
      return distance * 12; // 5km/h for walking
    }
  };

  // Create a partial route segment
  const createPartialRoute = (route, startPoint, endPoint, distance) => {
    // This is a simplified version - in reality you'd need to truncate the actual route geometry
    return {
      ...route,
      properties: {
        ...route.properties,
        length: distance,
        duration: getDurationForMode(route.properties.transportMode, distance),
      },
    };
  };

  // Find potential transfer points between routes
  const findNearestPointsBetweenRoutes = (route1, route2) => {
    const coords1 = extractCoordinates(route1);
    const coords2 = extractCoordinates(route2);

    let minDist = Infinity;
    let bestPoint1 = null;
    let bestPoint2 = null;
    let distanceFromStart1 = 0;
    let distanceFromStart2 = 0;

    // For simplicity, we're doing a brute force search of all points
    // In a real app, you'd use spatial indexing for efficiency
    for (let i = 0; i < coords1.length; i++) {
      for (let j = 0; j < coords2.length; j++) {
        const dist = calculateDistance(
          coords1[i][0],
          coords1[i][1],
          coords2[j][0],
          coords2[j][1]
        );

        if (dist < minDist) {
          minDist = dist;
          bestPoint1 = coords1[i];
          bestPoint2 = coords2[j];

          // Calculate approximate distances along routes
          distanceFromStart1 =
            i > 0 ? calculateRouteDistance(coords1.slice(0, i + 1)) : 0;
          distanceFromStart2 =
            j > 0 ? calculateRouteDistance(coords2.slice(j)) : 0;
        }
      }
    }

    return {
      distance: minDist,
      firstRoutePoint: bestPoint1,
      secondRoutePoint: bestPoint2,
      firstRouteDistance: distanceFromStart1,
      secondRouteDistance: distanceFromStart2,
    };
  };

  // Calculate distance along a route
  const calculateRouteDistance = (coordinates) => {
    let distance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      distance += calculateDistance(
        coordinates[i][0],
        coordinates[i][1],
        coordinates[i + 1][0],
        coordinates[i + 1][1]
      );
    }
    return distance;
  };

  const handleRouteSelect = (route) => {
    setSelectedRoute(route);
    setMapKey((prevKey) => prevKey + 1);
  };

  const formatDuration = (minutes) => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins} min`;
  };

  // Calculate map center and zoom based on origin and destination
  const getMapView = () => {
    if (origin && destination) {
      const center = {
        lat: (origin.lat + destination.lat) / 2,
        lng: (origin.lng + destination.lng) / 2,
      };
      return { center, zoom: 13 };
    }
    return { center: [14.5995, 120.9842], zoom: 12 };
  };

  const mapView = getMapView();

  return (
    <div style={{ display: "flex" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "25%",
          height: "100vh",
          overflowY: "auto",
          padding: "10px",
          borderRight: "1px solid #ccc",
          backgroundColor: "#f8f8f8",
        }}
      >
        <h2
          style={{
            borderBottom: "2px solid #0078d7",
            paddingBottom: "8px",
            color: "#333",
          }}
        >
          Commute Guide
        </h2>

        {origin && destination && (
          <div
            style={{
              marginBottom: "20px",
              padding: "15px",
              backgroundColor: "#fff",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", color: "#0078d7" }}>
              Trip Details
            </h3>
            <p>
              <strong>From:</strong> {origin.lat.toFixed(6)},{" "}
              {origin.lng.toFixed(6)}
            </p>
            <p>
              <strong>To:</strong> {destination.lat.toFixed(6)},{" "}
              {destination.lng.toFixed(6)}
            </p>

            {loading ? (
              <div style={{ textAlign: "center", padding: "20px" }}>
                Loading routes...
              </div>
            ) : suggestedRoutes.length > 0 ? (
              <div style={{ marginTop: "15px" }}>
                <h4
                  style={{
                    borderBottom: "1px solid #eee",
                    paddingBottom: "5px",
                  }}
                >
                  Suggested Routes
                </h4>
                {suggestedRoutes.map((route, index) => (
                  <div
                    key={`route-${index}`}
                    style={{
                      padding: "12px",
                      margin: "10px 0",
                      cursor: "pointer",
                      backgroundColor:
                        selectedRoute === route ? "#e6f7ff" : "#f9f9f9",
                      borderRadius: "6px",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      borderLeft:
                        selectedRoute === route
                          ? "4px solid #0078d7"
                          : "4px solid transparent",
                    }}
                    onClick={() => handleRouteSelect(route)}
                  >
                    <div style={{ fontWeight: "bold", marginBottom: "5px" }}>
                      Option {index + 1}: {route.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666" }}>
                      {route.description}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginTop: "10px",
                        fontSize: "12px",
                      }}
                    >
                      <span>🕒 {formatDuration(route.totalDuration)}</span>
                      <span>📏 {route.totalDistance.toFixed(2)} km</span>
                      <span>🔄 {route.transfers} transfers</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{ textAlign: "center", padding: "20px", color: "#666" }}
              >
                No routes found. Try a different origin or destination.
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: "20px" }}>
          <h3 style={{ borderBottom: "1px solid #ddd", paddingBottom: "5px" }}>
            Transport Legend
          </h3>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              marginTop: "10px",
            }}
          >
            {Object.entries(TRANSPORT_COLORS).map(([mode, color]) => (
              <div
                key={mode}
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <div
                  style={{
                    width: "20px",
                    height: "4px",
                    backgroundColor: color,
                    borderRadius: "2px",
                  }}
                ></div>
                <span style={{ textTransform: "capitalize" }}>{mode}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Map */}
      <MapContainer
        key={mapKey}
        center={mapView.center}
        zoom={mapView.zoom}
        style={{ height: "100vh", width: "75%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Show origin and destination markers */}
        {origin && (
          <Marker position={[origin.lat, origin.lng]}>
            <Popup>Origin</Popup>
          </Marker>
        )}

        {destination && (
          <Marker position={[destination.lat, destination.lng]}>
            <Popup>Destination</Popup>
          </Marker>
        )}

        {/* Show selected route segments */}
        {selectedRoute &&
          selectedRoute.segments.map((segment, index) => {
            const transportMode = segment.properties.transportMode || "walk";
            const color = TRANSPORT_COLORS[transportMode] || "#999";

            if (segment.geometry.type === "LineString") {
              const positions = segment.geometry.coordinates.map((coord) => [
                coord[1],
                coord[0],
              ]);
              return (
                <Polyline
                  key={`segment-${index}`}
                  positions={positions}
                  color={color}
                  weight={5}
                  opacity={0.8}
                >
                  <Popup>
                    <div>
                      <strong>{transportMode.toUpperCase()}</strong>
                      <div>{segment.properties.name}</div>
                      <div>
                        Distance:{" "}
                        {segment.properties.distance?.toFixed(2) ||
                          segment.properties.length?.toFixed(2) ||
                          "?"}{" "}
                        km
                      </div>
                    </div>
                  </Popup>
                </Polyline>
              );
            } else if (segment.geometry.type === "MultiLineString") {
              return segment.geometry.coordinates.map((line, lineIndex) => {
                const positions = line.map((coord) => [coord[1], coord[0]]);
                return (
                  <Polyline
                    key={`segment-${index}-line-${lineIndex}`}
                    positions={positions}
                    color={color}
                    weight={10}
                    opacity={0.8}
                  >
                    <Popup>
                      <div>
                        <strong>{transportMode.toUpperCase()}</strong>
                        <div>{segment.properties.name}</div>
                        <div>
                          Distance:{" "}
                          {segment.properties.distance?.toFixed(2) ||
                            segment.properties.length?.toFixed(2) ||
                            "?"}{" "}
                          km
                        </div>
                      </div>
                    </Popup>
                  </Polyline>
                );
              });
            }
            return null;
          })}
      </MapContainer>
    </div>
  );
};

export default CommuteGuide;
