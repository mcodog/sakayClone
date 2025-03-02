import {
  MapContainer,
  TileLayer,
  GeoJSON,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { Icon } from "leaflet";
import L from "leaflet";
import "leaflet-routing-machine";
import { useSearchParams } from "react-router-dom";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const createCustomIcon = (color) => {
  return new L.Icon({
    iconUrl: `https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl:
      "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
};

const sourceIcon = createCustomIcon("green");
const destinationIcon = createCustomIcon("red");
const transferIcon = createCustomIcon("orange");

const modeColors = {
  bus: "#1a73e8",
  jeep: "#0d8f33",
  train: "#e53935",
  ferry: "#8e24aa",
  tricycle: "#f57c00",
  walk: "#000000",
  other: "#607d8b",
};

const MapViewSetter = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds && bounds.length > 0) {
      const leafletBounds = L.latLngBounds(bounds);
      map.fitBounds(leafletBounds, { padding: [50, 50] });
    }
  }, [bounds, map]);

  return null;
};

const WalkingRoute = ({ from, to, color, onRouteGenerated }) => {
  const map = useMap();
  const routingControlRef = useRef(null);

  useEffect(() => {
    if (from && to) {
      if (routingControlRef.current) {
        map.removeControl(routingControlRef.current);
      }

      const routingControl = L.Routing.control({
        waypoints: [L.latLng(from[0], from[1]), L.latLng(to[0], to[1])],
        lineOptions: {
          styles: [{ color, weight: 4, opacity: 0.7 }],
          extendToWaypoints: true,
          missingRouteTolerance: 0,
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: false,
        fitSelectedRoutes: false,
        showAlternatives: false,
      });

      routingControl.on("routesfound", function (e) {
        const routes = e.routes;
        const route = routes[0];

        if (onRouteGenerated) {
          onRouteGenerated({
            coordinates: route.coordinates.map((c) => [c.lat, c.lng]),
            distance: route.summary.totalDistance,
            time: route.summary.totalTime,
            instructions: route.instructions,
          });
        }
      });

      routingControl.addTo(map);
      routingControlRef.current = routingControl;

      return () => {
        if (routingControlRef.current) {
          map.removeControl(routingControlRef.current);
        }
      };
    }
  }, [from, to, color, map, onRouteGenerated]);

  return null;
};

const TransportRoutesMap = () => {
  const [searchParams] = useSearchParams();
  const [geojsonData, setGeojsonData] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeFound, setRouteFound] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(null);
  const [mapBounds, setMapBounds] = useState([]);
  const [walkingRoutes, setWalkingRoutes] = useState([]);
  const [transferPoints, setTransferPoints] = useState([]);

  const defaultCenter = [14.5995, 120.9842];

  const calculateFare = (mode, distanceInMeters) => {
    const distanceInKm = distanceInMeters / 1000;

    switch (mode) {
      case "jeep":
        return distanceInKm <= 4
          ? 13
          : 13 + Math.ceil((distanceInKm - 4) * 1.8);

      case "bus":
        return distanceInKm <= 5
          ? 13
          : 13 + Math.ceil((distanceInKm - 5) * 2.2);

      case "train":
        const trainFare =
          distanceInKm <= 5 ? 15 : 15 + Math.ceil((distanceInKm - 5) * 1.5);
        return Math.min(trainFare, 35);

      case "tricycle":
        return distanceInKm <= 2 ? 25 : 25 + Math.ceil((distanceInKm - 2) * 8);

      case "ferry":
        if (distanceInKm <= 5) return 50;
        if (distanceInKm <= 10) return 80;
        return 100;

      case "walk":
        return 0;

      default:
        return distanceInKm <= 5
          ? 13
          : 13 + Math.ceil((distanceInKm - 5) * 2.2);
    }
  };

  const formatFare = (fare) => {
    return `₱${fare.toFixed(2)}`;
  };

  useEffect(() => {
    const srcLat = searchParams.get("srcLat");
    const srcLng = searchParams.get("srcLng");
    const destLat = searchParams.get("destLat");
    const destLng = searchParams.get("destLng");

    if (srcLat && srcLng) {
      setSource([parseFloat(srcLat), parseFloat(srcLng)]);
    }

    if (destLat && destLng) {
      setDestination([parseFloat(destLat), parseFloat(destLng)]);
    }
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    fetch("/data/export.geojson")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setGeojsonData(data);
        processRouteData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading GeoJSON:", error);
        setError(error.message);
        setLoading(false);
      });
  }, []);

  const processRouteData = (data) => {
    if (!data || !data.features) return;

    const routes = data.features.map((feature) => {
      const { geometry, properties } = feature;
      const mode = extractModeFromName(properties?.name || "");

      let coordinates = [];
      if (geometry.type === "LineString") {
        coordinates = geometry.coordinates.map((coord) => [coord[1], coord[0]]);
      } else if (geometry.type === "MultiLineString") {
        geometry.coordinates.forEach((line) => {
          coordinates = coordinates.concat(
            line.map((coord) => [coord[1], coord[0]])
          );
        });
      }

      return {
        id: properties.id || `route-${Math.random().toString(36).substr(2, 9)}`,
        name: properties.name || "Unnamed Route",
        mode,
        color: modeColors[mode] || modeColors.other,
        coordinates,
        properties,
      };
    });

    setRouteData(routes);
  };

  const extractModeFromName = (name) => {
    if (!name) return "other";

    name = name.toLowerCase();

    if (name.includes("bus route") || name.includes("city bus")) return "bus";
    if (name.includes("jeep") || name.includes("jeepney")) return "jeep";
    if (
      name.includes("train") ||
      name.includes("railway") ||
      name.includes("lrt") ||
      name.includes("mrt")
    )
      return "train";
    if (
      name.includes("ferry") ||
      name.includes("boat") ||
      name.includes("water")
    )
      return "ferry";
    if (name.includes("tricycle") || name.includes("trike")) return "tricycle";

    return "other";
  };

  const getColor = (feature) => {
    const name = feature.properties?.name || "";
    const mode = extractModeFromName(name);
    return modeColors[mode] || modeColors.other;
  };

  const calculateDistance = (coord1, coord2) => {
    if (!coord1 || !coord2) return Infinity;

    const lat1 = coord1[0];
    const lon1 = coord1[1];
    const lat2 = coord2[0];
    const lon2 = coord2[1];

    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  };

  const findNearestPointOnRoute = (coordinate, route) => {
    if (!route || !route.coordinates || route.coordinates.length === 0) {
      return null;
    }

    let minDistance = Infinity;
    let nearestPoint = null;
    let pointIndex = -1;

    route.coordinates.forEach((coord, index) => {
      const distance = calculateDistance(coordinate, coord);
      if (distance < minDistance) {
        minDistance = distance;
        nearestPoint = coord;
        pointIndex = index;
      }
    });

    return { point: nearestPoint, distance: minDistance, index: pointIndex };
  };

  const findNearestRoute = (coordinate, routes) => {
    if (!routes || routes.length === 0) {
      return null;
    }

    let minDistance = Infinity;
    let nearestRoute = null;
    let nearestPoint = null;
    let pointIndex = -1;

    routes.forEach((route) => {
      const result = findNearestPointOnRoute(coordinate, route);
      if (result && result.distance < minDistance) {
        minDistance = result.distance;
        nearestRoute = route;
        nearestPoint = result.point;
        pointIndex = result.index;
      }
    });

    return {
      route: nearestRoute,
      point: nearestPoint,
      distance: minDistance,
      index: pointIndex,
    };
  };

  const findRoute = () => {
    if (!source || !destination || !routeData || routeData.length === 0) {
      return;
    }

    setLoading(true);

    const directDistance = calculateDistance(source, destination);

    if (directDistance <= 500) {
      const walkingFare = calculateFare("walk", directDistance);

      setCurrentRoute({
        segments: [
          {
            type: "walk",
            from: source,
            to: destination,
            color: modeColors.walk,
            distance: directDistance,
            fare: walkingFare,
          },
        ],
        totalDistance: directDistance,
        totalTime: directDistance / 1.4,
        totalFare: walkingFare,
      });

      setMapBounds([source, destination]);
      setRouteFound(true);
      setLoading(false);
      return;
    }

    const sourceResult = findNearestRoute(source, routeData);
    const destResult = findNearestRoute(destination, routeData);

    if (!sourceResult || !destResult) {
      setError("Could not find suitable routes near your locations.");
      setRouteFound(false);
      setLoading(false);
      return;
    }

    if (sourceResult.route.id === destResult.route.id) {
      const sourceIndex = sourceResult.index;
      const destIndex = destResult.index;
      const routeCoords = sourceResult.route.coordinates;

      let routeSegment;
      let routeSegmentDistance = 0;

      if (sourceIndex <= destIndex) {
        routeSegment = routeCoords.slice(sourceIndex, destIndex + 1);
      } else {
        routeSegment = routeCoords.slice(destIndex, sourceIndex + 1).reverse();
      }

      for (let i = 0; i < routeSegment.length - 1; i++) {
        routeSegmentDistance += calculateDistance(
          routeSegment[i],
          routeSegment[i + 1]
        );
      }

      const initialWalkFare = calculateFare("walk", sourceResult.distance);
      const transportFare = calculateFare(
        sourceResult.route.mode,
        routeSegmentDistance
      );
      const finalWalkFare = calculateFare("walk", destResult.distance);

      const initialWalk = {
        type: "walk",
        from: source,
        to: sourceResult.point,
        color: modeColors.walk,
        distance: sourceResult.distance,
        fare: initialWalkFare,
      };

      const finalWalk = {
        type: "walk",
        from: destResult.point,
        to: destination,
        color: modeColors.walk,
        distance: destResult.distance,
        fare: finalWalkFare,
      };

      const transportSegment = {
        type: sourceResult.route.mode,
        from: sourceResult.point,
        to: destResult.point,
        route: sourceResult.route,
        color: sourceResult.route.color,
        coordinates: routeSegment,
        distance: routeSegmentDistance,
        fare: transportFare,
      };

      const totalFare = initialWalkFare + transportFare + finalWalkFare;

      setCurrentRoute({
        segments: [initialWalk, transportSegment, finalWalk],
        totalDistance:
          sourceResult.distance + routeSegmentDistance + destResult.distance,
        totalTime:
          (sourceResult.distance + destResult.distance) / 1.4 +
          routeSegmentDistance / getSpeed(sourceResult.route.mode),
        totalFare: totalFare,
      });

      setTransferPoints([
        {
          position: sourceResult.point,
          type: "boarding",
          route: sourceResult.route.name,
        },
        {
          position: destResult.point,
          type: "alighting",
          route: sourceResult.route.name,
        },
      ]);

      setMapBounds([source, ...routeSegment, destination]);
      setRouteFound(true);
      setLoading(false);
      return;
    }

    let minTotalDistance = Infinity;
    let bestSourceRoute = null;
    let bestDestRoute = null;
    let bestTransferPoint = null;
    let bestSourceNearestPoint = null;
    let bestDestNearestPoint = null;

    routeData.forEach((route) => {
      if (route.coordinates.length < 2) return;

      if (
        route.id === sourceResult.route.id ||
        route.id === destResult.route.id
      )
        return;

      const sourceRouteResult = findNearestRoute(sourceResult.point, [route]);
      const destRouteResult = findNearestRoute(destResult.point, [route]);

      if (!sourceRouteResult || !destRouteResult) return;

      const totalDistance =
        sourceResult.distance +
        calculateDistance(sourceResult.point, sourceRouteResult.point) +
        calculateDistance(sourceRouteResult.point, destRouteResult.point) +
        destResult.distance;

      if (totalDistance < minTotalDistance) {
        minTotalDistance = totalDistance;
        bestSourceRoute = sourceResult.route;
        bestDestRoute = destResult.route;
        bestTransferPoint = sourceRouteResult.point;
        bestSourceNearestPoint = sourceResult.point;
        bestDestNearestPoint = destResult.point;
      }
    });

    if (bestTransferPoint) {
      const initialWalkDistance = sourceResult.distance;
      const finalWalkDistance = destResult.distance;
      const firstTransportDistance = calculateDistance(
        bestSourceNearestPoint,
        bestTransferPoint
      );
      const secondTransportDistance = calculateDistance(
        bestTransferPoint,
        bestDestNearestPoint
      );

      const initialWalkFare = calculateFare("walk", initialWalkDistance);
      const finalWalkFare = calculateFare("walk", finalWalkDistance);
      const firstTransportFare = calculateFare(
        bestSourceRoute.mode,
        firstTransportDistance
      );
      const secondTransportFare = calculateFare(
        bestDestRoute.mode,
        secondTransportDistance
      );

      const initialWalk = {
        type: "walk",
        from: source,
        to: bestSourceNearestPoint,
        color: modeColors.walk,
        distance: initialWalkDistance,
        fare: initialWalkFare,
      };

      const finalWalk = {
        type: "walk",
        from: bestDestNearestPoint,
        to: destination,
        color: modeColors.walk,
        distance: finalWalkDistance,
        fare: finalWalkFare,
      };

      const firstTransportSegment = {
        type: bestSourceRoute.mode,
        from: bestSourceNearestPoint,
        to: bestTransferPoint,
        route: bestSourceRoute,
        color: bestSourceRoute.color,
        distance: firstTransportDistance,
        fare: firstTransportFare,
      };

      const secondTransportSegment = {
        type: bestDestRoute.mode,
        from: bestTransferPoint,
        to: bestDestNearestPoint,
        route: bestDestRoute,
        color: bestDestRoute.color,
        distance: secondTransportDistance,
        fare: secondTransportFare,
      };

      const totalFare =
        initialWalkFare +
        firstTransportFare +
        secondTransportFare +
        finalWalkFare;

      setCurrentRoute({
        segments: [
          initialWalk,
          firstTransportSegment,
          secondTransportSegment,
          finalWalk,
        ],
        totalDistance: minTotalDistance,
        totalTime:
          (sourceResult.distance + destResult.distance) / 1.4 +
          calculateDistance(bestSourceNearestPoint, bestTransferPoint) /
            getSpeed(bestSourceRoute.mode) +
          calculateDistance(bestTransferPoint, bestDestNearestPoint) /
            getSpeed(bestDestRoute.mode),
        totalFare: totalFare,
      });

      setTransferPoints([
        {
          position: bestSourceNearestPoint,
          type: "boarding",
          route: bestSourceRoute.name,
        },
        {
          position: bestTransferPoint,
          type: "transfer",
          route1: bestSourceRoute.name,
          route2: bestDestRoute.name,
        },
        {
          position: bestDestNearestPoint,
          type: "alighting",
          route: bestDestRoute.name,
        },
      ]);

      setMapBounds([
        source,
        bestSourceNearestPoint,
        bestTransferPoint,
        bestDestNearestPoint,
        destination,
      ]);

      setRouteFound(true);
      setLoading(false);
      return;
    }

    const initialWalkDistance = sourceResult.distance;
    const transferWalkDistance = calculateDistance(
      sourceResult.point,
      destResult.point
    );
    const finalWalkDistance = destResult.distance;

    const initialWalkFare = calculateFare("walk", initialWalkDistance);
    const transferWalkFare = calculateFare("walk", transferWalkDistance);
    const finalWalkFare = calculateFare("walk", finalWalkDistance);
    const firstTransportFare = calculateFare(sourceResult.route.mode, 0);
    const secondTransportFare = calculateFare(destResult.route.mode, 0);

    const initialWalk = {
      type: "walk",
      from: source,
      to: sourceResult.point,
      color: modeColors.walk,
      distance: initialWalkDistance,
      fare: initialWalkFare,
    };

    const transferWalk = {
      type: "walk",
      from: sourceResult.point,
      to: destResult.point,
      color: modeColors.walk,
      distance: transferWalkDistance,
      fare: transferWalkFare,
    };

    const finalWalk = {
      type: "walk",
      from: destResult.point,
      to: destination,
      color: modeColors.walk,
      distance: finalWalkDistance,
      fare: finalWalkFare,
    };

    const firstTransportSegment = {
      type: sourceResult.route.mode,
      from: sourceResult.point,
      to: sourceResult.point,
      route: sourceResult.route,
      color: sourceResult.route.color,
      distance: 0,
      fare: firstTransportFare,
    };

    const secondTransportSegment = {
      type: destResult.route.mode,
      from: destResult.point,
      to: destResult.point,
      route: destResult.route,
      color: destResult.route.color,
      distance: 0,
      fare: secondTransportFare,
    };

    const totalFare =
      initialWalkFare +
      firstTransportFare +
      transferWalkFare +
      secondTransportFare +
      finalWalkFare;

    setCurrentRoute({
      segments: [
        initialWalk,
        firstTransportSegment,
        transferWalk,
        secondTransportSegment,
        finalWalk,
      ],
      totalDistance:
        sourceResult.distance +
        calculateDistance(sourceResult.point, destResult.point) +
        destResult.distance,
      totalTime:
        (sourceResult.distance + destResult.distance) / 1.4 +
        calculateDistance(sourceResult.point, destResult.point) / 1.4,
      totalFare: totalFare,
    });

    setTransferPoints([
      {
        position: sourceResult.point,
        type: "boarding",
        route: sourceResult.route.name,
      },
      {
        position: destResult.point,
        type: "alighting",
        route: destResult.route.name,
      },
    ]);

    setMapBounds([source, sourceResult.point, destResult.point, destination]);

    setRouteFound(true);
    setLoading(false);
  };

  const getSpeed = (mode) => {
    switch (mode) {
      case "train":
        return 13.9;
      case "bus":
        return 8.3;
      case "jeep":
        return 6.9;
      case "ferry":
        return 5.6;
      case "tricycle":
        return 5.6;
      case "walk":
        return 1.4;
      default:
        return 8.3;
    }
  };

  const formatTime = (seconds) => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };

  const handleWalkingRouteGenerated = (routeIndex, walkingRoute) => {
    setWalkingRoutes((prev) => {
      const newWalkingRoutes = [...prev];

      const walkingFare = calculateFare("walk", walkingRoute.distance);
      walkingRoute.fare = walkingFare;

      newWalkingRoutes[routeIndex] = walkingRoute;

      if (currentRoute) {
        const updatedSegments = [...currentRoute.segments];

        if (updatedSegments[routeIndex]) {
          updatedSegments[routeIndex] = {
            ...updatedSegments[routeIndex],
            distance: walkingRoute.distance,
            fare: walkingFare,
          };
        }

        const totalFare = updatedSegments.reduce(
          (sum, segment) => sum + (segment.fare || 0),
          0
        );

        setCurrentRoute({
          ...currentRoute,
          segments: updatedSegments,
          totalFare: totalFare,
        });
      }

      return newWalkingRoutes;
    });
  };

  useEffect(() => {
    if (source && destination && routeData && routeData.length > 0) {
      findRoute();
    }
  }, [source, destination, routeData]);

  const getModeIcon = (mode) => {
    switch (mode) {
      case "train":
        return "🚆";
      case "bus":
        return "🚌";
      case "jeep":
        return "🚐";
      case "ferry":
        return "⛴️";
      case "tricycle":
        return "🛺";
      case "walk":
        return "🚶";
      default:
        return "🚌";
    }
  };

  return (
    <div className="relative w-full h-screen flex">
      <div className="relative w-3/4 h-screen">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <p className="text-lg font-semibold">Loading map data...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
            <div className="text-red-500 p-4 bg-red-50 rounded-lg">
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          className="z-0"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {mapBounds.length > 0 && <MapViewSetter bounds={mapBounds} />}

          {source && (
            <Marker position={source} icon={sourceIcon}>
              <Popup>Starting Point</Popup>
            </Marker>
          )}

          {destination && (
            <Marker position={destination} icon={destinationIcon}>
              <Popup>Destination</Popup>
            </Marker>
          )}

          {transferPoints.map((point, idx) => (
            <Marker
              key={`transfer-${idx}`}
              position={point.position}
              icon={transferIcon}
            >
              <Popup>
                {point.type === "boarding" && `Board ${point.route}`}
                {point.type === "alighting" && `Alight from ${point.route}`}
                {point.type === "transfer" &&
                  `Transfer from ${point.route1} to ${point.route2}`}
              </Popup>
            </Marker>
          ))}

          {!routeFound && geojsonData && (
            <GeoJSON
              data={geojsonData}
              style={(feature) => ({
                color: getColor(feature),
                weight: 3,
                opacity: 0.5,
                fillOpacity: 0.2,
              })}
              onEachFeature={(feature, layer) => {
                if (feature.properties) {
                  const { name, route, operator, ref, from, to, via } =
                    feature.properties;
                  const mode = extractModeFromName(name);

                  layer.bindPopup(`
                    <div>
                      <strong>${name || "Unnamed Route"}</strong>
                      <p>Mode: <span style="text-transform: capitalize">${mode}</span></p>
                      ${ref ? `<p>Route Number: ${ref}</p>` : ""}
                      ${from && to ? `<p>From: ${from} → To: ${to}</p>` : ""}
                      ${via ? `<p>Via: ${via}</p>` : ""}
                      ${operator ? `<p>Operator: ${operator}</p>` : ""}
                    </div>
                  `);
                }
              }}
            />
          )}

          {currentRoute &&
            currentRoute.segments.map((segment, idx) => {
              if (segment.type === "walk") {
                return (
                  <WalkingRoute
                    key={`walking-${idx}`}
                    from={segment.from}
                    to={segment.to}
                    color={segment.color}
                    onRouteGenerated={(route) =>
                      handleWalkingRouteGenerated(idx, route)
                    }
                  />
                );
              } else if (segment.coordinates) {
                return (
                  <Polyline
                    key={`segment-${idx}`}
                    positions={segment.coordinates}
                    color={segment.color}
                    weight={5}
                    opacity={0.7}
                  />
                );
              } else {
                return (
                  <Polyline
                    key={`segment-${idx}`}
                    positions={[segment.from, segment.to]}
                    color={segment.color}
                    weight={5}
                    opacity={0.7}
                    dashArray="10,10"
                  />
                );
              }
            })}
        </MapContainer>
      </div>

      <div className="w-1/4 h-screen p-4 bg-white shadow-lg overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Commute Guide</h2>

        {!source || !destination ? (
          <div className="p-4 bg-yellow-50 rounded-lg">
            <p>Please set source and destination coordinates in the URL.</p>
            <p className="text-sm text-gray-600 mt-2">
              Example: ?srcLat=14.59&srcLng=120.98&destLat=14.62&destLng=120.96
            </p>
          </div>
        ) : !routeFound ? (
          <div className="p-4 bg-blue-50 rounded-lg">
            <p>Finding the best route for you...</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold">Summary</h3>
              <p>
                Total Distance: {formatDistance(currentRoute.totalDistance)}
              </p>
              <p>Estimated Time: {formatTime(currentRoute.totalTime)}</p>
              <p>Total Fare: {formatFare(currentRoute.totalFare || 0)}</p>
              <p>
                Transfers:{" "}
                {transferPoints.filter((p) => p.type === "transfer").length}
              </p>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Step-by-Step Instructions</h3>
              <ol className="list-decimal pl-5 space-y-4">
                {currentRoute.segments.map((segment, idx) => (
                  <li key={`step-${idx}`} className="border-b pb-2">
                    <div className="flex items-center mb-2">
                      <span
                        className="w-6 h-6 rounded-full mr-2 flex items-center justify-center text-white"
                        style={{ backgroundColor: segment.color }}
                      >
                        {getModeIcon(segment.type)}
                      </span>
                      <span className="font-medium capitalize">
                        {segment.type}
                      </span>
                      <span className="ml-auto text-blue-600 font-medium">
                        {formatFare(segment.fare || 0)}
                      </span>
                    </div>

                    {segment.type === "walk" ? (
                      <p>
                        Walk{" "}
                        {formatDistance(
                          walkingRoutes[idx]?.distance ||
                            segment.distance ||
                            calculateDistance(segment.from, segment.to)
                        )}
                        {idx === 0 &&
                          " to reach " +
                            (currentRoute.segments[1]?.route?.name ||
                              "your route")}
                        {idx > 0 &&
                          idx < currentRoute.segments.length - 1 &&
                          " to transfer to " +
                            (currentRoute.segments[idx + 1]?.route?.name ||
                              "your next route")}
                        {idx === currentRoute.segments.length - 1 &&
                          " to reach your destination"}
                      </p>
                    ) : (
                      <p>
                        Take {segment.route.name}{" "}
                        {segment.route.properties?.ref
                          ? `(${segment.route.properties.ref})`
                          : ""}
                        {segment.route.properties?.from &&
                        segment.route.properties?.to
                          ? ` from ${segment.route.properties.from} to ${segment.route.properties.to}`
                          : ""}
                      </p>
                    )}

                    {walkingRoutes[idx]?.instructions &&
                      segment.type === "walk" && (
                        <ul className="text-sm text-gray-600 mt-2 list-disc pl-5">
                          {walkingRoutes[idx].instructions
                            .slice(0, -1)
                            .map((instruction, insIdx) => (
                              <li key={`instruction-${idx}-${insIdx}`}>
                                {instruction.text}
                              </li>
                            ))}
                        </ul>
                      )}
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-2">Legend</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(modeColors).map(([mode, color]) => (
                  <div key={mode} className="flex items-center">
                    <span
                      className="inline-block w-4 h-4 mr-1 rounded-sm"
                      style={{ backgroundColor: color }}
                    ></span>
                    <span className="text-xs capitalize">{mode}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TransportRoutesMap;
