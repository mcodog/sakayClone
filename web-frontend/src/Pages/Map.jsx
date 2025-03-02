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

const modePreferences = [
  ["train", "bus", "jeep", "ferry", "tricycle", "walk", "other"],
  ["bus", "jeep", "ferry", "train", "tricycle", "walk", "other"],
  ["jeep", "ferry", "tricycle", "bus", "train", "walk", "other"],
];

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

  const [currentTime, setCurrentTime] = useState(new Date());
  const [trafficLevel, setTrafficLevel] = useState("moderate");
  const [showTraffic, setShowTraffic] = useState(true);

  const [routeOptions, setRouteOptions] = useState([]);
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [allTransferPoints, setAllTransferPoints] = useState([]);
  const [allWalkingRoutes, setAllWalkingRoutes] = useState([]);
  const [mapBounds, setMapBounds] = useState([]);

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

  const findNearestRoute = (
    coordinate,
    routes,
    modePreference = modePreferences[0],
    excludeRouteIds = []
  ) => {
    if (!routes || routes.length === 0) {
      return null;
    }

    let minDistance = Infinity;
    let nearestRoute = null;
    let nearestPoint = null;
    let pointIndex = -1;

    const sortedRoutes = [...routes].sort((a, b) => {
      const aIndex = modePreference.indexOf(a.mode);
      const bIndex = modePreference.indexOf(b.mode);
      return aIndex - bIndex;
    });

    sortedRoutes.forEach((route) => {
      if (excludeRouteIds.includes(route.id)) return;

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

  const getTrafficLevelFromTime = (time) => {
    const hour = time.getHours();
    const day = time.getDay();

    if (
      day >= 1 &&
      day <= 5 &&
      ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19))
    ) {
      return "heavy";
    }

    if ((day === 0 || day === 6) && hour >= 11 && hour <= 15) {
      return "moderate";
    }

    if (hour >= 22 || hour <= 5) {
      return "low";
    }

    return "moderate";
  };

  useEffect(() => {
    setTrafficLevel(getTrafficLevelFromTime(currentTime));
  }, [currentTime]);

  const findRoute = () => {
    if (!source || !destination || !routeData || routeData.length === 0) {
      return;
    }

    setLoading(true);
    const foundRoutes = [];
    const allTransfers = [];
    const allWalking = [];

    for (let prefIndex = 0; prefIndex < modePreferences.length; prefIndex++) {
      const modePreference = modePreferences[prefIndex];
      const excludeRouteIds = foundRoutes.flatMap((route) =>
        route.segments.filter((seg) => seg.route).map((seg) => seg.route.id)
      );

      if (prefIndex === 0) {
        const directDistance = calculateDistance(source, destination);
        if (directDistance <= 500) {
          const walkingFare = calculateFare("walk", directDistance);

          const route = {
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
            label: "Walking Route",
          };

          foundRoutes.push(route);
          allWalking.push([]);
          allTransfers.push([]);

          break;
        }
      }

      if (foundRoutes.length >= 3) break;

      const sourceResult = findNearestRoute(
        source,
        routeData,
        modePreference,
        excludeRouteIds
      );
      if (!sourceResult) continue;

      const destResult = findNearestRoute(
        destination,
        routeData,
        modePreference,
        excludeRouteIds
      );
      if (!destResult) continue;

      if (sourceResult.route.id === destResult.route.id) {
        const sourceIndex = sourceResult.index;
        const destIndex = destResult.index;
        const routeCoords = sourceResult.route.coordinates;

        let routeSegment;
        let routeSegmentDistance = 0;

        if (sourceIndex <= destIndex) {
          routeSegment = routeCoords.slice(sourceIndex, destIndex + 1);
        } else {
          routeSegment = routeCoords
            .slice(destIndex, sourceIndex + 1)
            .reverse();
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
        const totalDistance =
          sourceResult.distance + routeSegmentDistance + destResult.distance;
        const totalTime =
          (sourceResult.distance + destResult.distance) / 1.4 +
          routeSegmentDistance / getSpeed(sourceResult.route.mode);

        foundRoutes.push({
          segments: [initialWalk, transportSegment, finalWalk],
          totalDistance,
          totalTime,
          totalFare,
          label: `${
            sourceResult.route.mode.charAt(0).toUpperCase() +
            sourceResult.route.mode.slice(1)
          } Route`,
        });

        allTransfers.push([
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

        allWalking.push([]);
      } else {
        let minTotalDistance = Infinity;
        let bestSourceRoute = null;
        let bestDestRoute = null;
        let bestTransferPoint = null;
        let bestSourceNearestPoint = null;
        let bestDestNearestPoint = null;

        const routesToTry = routeData.filter(
          (r) => !excludeRouteIds.includes(r.id)
        );

        routesToTry.forEach((route) => {
          if (route.coordinates.length < 2) return;

          if (
            route.id === sourceResult.route.id ||
            route.id === destResult.route.id
          )
            return;

          const sourceRouteResult = findNearestRoute(sourceResult.point, [
            route,
          ]);
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

          foundRoutes.push({
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
            label: `${
              bestSourceRoute.mode.charAt(0).toUpperCase() +
              bestSourceRoute.mode.slice(1)
            } to ${
              bestDestRoute.mode.charAt(0).toUpperCase() +
              bestDestRoute.mode.slice(1)
            }`,
          });

          allTransfers.push([
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

          allWalking.push([]);
        } else {
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

          foundRoutes.push({
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
            label: `Mixed Route (${sourceResult.route.mode}/${destResult.route.mode})`,
          });

          allTransfers.push([
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

          allWalking.push([]);
        }
      }
    }

    foundRoutes.sort((a, b) => a.totalTime - b.totalTime);

    foundRoutes.forEach((route, index) => {
      if (!route.label) {
        if (index === 0) route.label = "Fastest Route";
        else if (
          route.totalFare <= Math.min(...foundRoutes.map((r) => r.totalFare))
        )
          route.label = "Cheapest Route";
        else if (
          route.segments.filter((s) => s.type !== "walk").length <=
          Math.min(
            ...foundRoutes.map(
              (r) => r.segments.filter((s) => s.type !== "walk").length
            )
          )
        )
          route.label = "Simplest Route";
        else route.label = `Alternative Route ${index + 1}`;
      }
    });

    if (foundRoutes.length > 0) {
      const firstRouteBounds = calculateRouteBounds(foundRoutes[0]);

      setRouteOptions(foundRoutes);
      setAllTransferPoints(allTransfers);
      setAllWalkingRoutes(allWalking);
      setCurrentRouteIndex(0);
      setMapBounds(firstRouteBounds);
      setRouteFound(true);
    } else {
      setError("Could not find suitable routes near your locations.");
      setRouteFound(false);
    }

    setLoading(false);
  };

  const calculateRouteBounds = (route) => {
    if (!route) return [];

    const points = [source, destination];

    route.segments.forEach((segment) => {
      if (segment.from) points.push(segment.from);
      if (segment.to) points.push(segment.to);
      if (segment.coordinates) {
        points.push(...segment.coordinates);
      }
    });

    return points;
  };

  const getTrafficFactor = (mode, hour, day) => {
    if (mode === "train" || mode === "ferry" || mode === "walk") {
      return 1;
    }

    const isMorningPeak = hour >= 7 && hour <= 9 && day >= 1 && day <= 5;
    const isEveningPeak = hour >= 17 && hour <= 19 && day >= 1 && day <= 5;
    const isWeekendMidday =
      hour >= 11 && hour <= 14 && (day === 0 || day === 6);

    if (mode === "bus") {
      if (isMorningPeak || isEveningPeak) return 0.6;
      if (isWeekendMidday) return 0.8;
      return 0.9;
    }

    if (mode === "jeep") {
      if (isMorningPeak || isEveningPeak) return 0.55;
      if (isWeekendMidday) return 0.75;
      return 0.85;
    }

    if (mode === "tricycle") {
      if (isMorningPeak || isEveningPeak) return 0.7;
      if (isWeekendMidday) return 0.8;
      return 0.9;
    }

    return 0.8;
  };

  const getSpeed = (mode, useTraffic = true) => {
    let baseSpeed;
    switch (mode) {
      case "train":
        baseSpeed = 13.9;
      case "bus":
        baseSpeed = 8.3;
        break;
      case "jeep":
        baseSpeed = 6.9;
        break;
      case "ferry":
        baseSpeed = 5.6;
        break;
      case "tricycle":
        baseSpeed = 5.6;
        break;
      case "walk":
        baseSpeed = 1.4;
        break;
      default:
        baseSpeed = 8.3;
    }

    if (
      !useTraffic ||
      !showTraffic ||
      mode === "train" ||
      mode === "ferry" ||
      mode === "walk"
    ) {
      return baseSpeed;
    }

    const hour = currentTime.getHours();
    const day = currentTime.getDay();

    const trafficFactor = getTrafficFactor(mode, hour, day);
    return baseSpeed * trafficFactor;
  };

  const formatTime = (seconds) => {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}min`;
    }
  };

  const getTrafficDescription = (level) => {
    switch (level) {
      case "low":
        return "Light traffic, faster travel expected";
      case "moderate":
        return "Moderate traffic, average travel times";
      case "heavy":
        return "Heavy traffic, expect delays";
      default:
        return "Traffic conditions unknown";
    }
  };

  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };

  const handleWalkingRouteGenerated = (
    routeIndex,
    walkingSegmentIndex,
    walkingRoute
  ) => {
    setAllWalkingRoutes((prev) => {
      const newWalkingRoutes = [...prev];

      if (!newWalkingRoutes[routeIndex]) {
        newWalkingRoutes[routeIndex] = [];
      }

      const walkingFare = calculateFare("walk", walkingRoute.distance);
      walkingRoute.fare = walkingFare;

      newWalkingRoutes[routeIndex][walkingSegmentIndex] = walkingRoute;

      if (routeOptions[routeIndex]) {
        const updatedSegments = [...routeOptions[routeIndex].segments];

        if (updatedSegments[walkingSegmentIndex]) {
          updatedSegments[walkingSegmentIndex] = {
            ...updatedSegments[walkingSegmentIndex],
            distance: walkingRoute.distance,
            fare: walkingFare,
          };
        }

        const totalFare = updatedSegments.reduce(
          (sum, segment) => sum + (segment.fare || 0),
          0
        );

        const updatedRouteOptions = [...routeOptions];
        updatedRouteOptions[routeIndex] = {
          ...routeOptions[routeIndex],
          segments: updatedSegments,
          totalFare: totalFare,
        };

        setRouteOptions(updatedRouteOptions);
      }

      return newWalkingRoutes;
    });
  };

  const changeSelectedRoute = (index) => {
    if (index >= 0 && index < routeOptions.length) {
      setCurrentRouteIndex(index);
      setMapBounds(calculateRouteBounds(routeOptions[index]));
    }
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

  const handleTimeChange = (e) => {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const newTime = new Date();
    newTime.setHours(hours, minutes, 0);
    setCurrentTime(newTime);
  };

  const toggleTraffic = () => {
    setShowTraffic(!showTraffic);

    if (routeOptions.length > 0) {
      const updatedRoutes = routeOptions.map((route) => {
        const newTotalTime = route.segments.reduce((total, segment) => {
          if (segment.type === "walk") {
            return total + segment.distance / getSpeed("walk", false);
          } else {
            return (
              total + segment.distance / getSpeed(segment.type, !showTraffic)
            );
          }
        }, 0);

        return {
          ...route,
          totalTime: newTotalTime,
        };
      });

      setRouteOptions(updatedRoutes);
    }
  };

  const getTrafficColor = (level) => {
    switch (level) {
      case "low":
        return "#4CAF50";
      case "moderate":
        return "#FF9800";
      case "heavy":
        return "#F44336";
      default:
        return "#9E9E9E";
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

        {showTraffic && routeFound && (
          <div className="absolute top-4 right-4 z-10 bg-white p-2 rounded-lg shadow-md">
            <div className="flex items-center">
              <div
                className="w-4 h-4 rounded-full mr-2"
                style={{ backgroundColor: getTrafficColor(trafficLevel) }}
              ></div>
              <span className="text-sm font-medium capitalize">
                {trafficLevel} Traffic
              </span>
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

          {allTransferPoints[currentRouteIndex]?.map((point, idx) => (
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

          {routeOptions[currentRouteIndex] &&
            routeOptions[currentRouteIndex].segments.map((segment, idx) => {
              if (segment.type === "walk") {
                return (
                  <WalkingRoute
                    key={`walking-${currentRouteIndex}-${idx}`}
                    from={segment.from}
                    to={segment.to}
                    color={segment.color}
                    onRouteGenerated={(route) =>
                      handleWalkingRouteGenerated(currentRouteIndex, idx, route)
                    }
                  />
                );
              } else if (segment.coordinates) {
                return (
                  <Polyline
                    key={`segment-${currentRouteIndex}-${idx}`}
                    positions={segment.coordinates}
                    color={segment.color}
                    weight={5}
                    opacity={0.7}
                  />
                );
              } else {
                return (
                  <Polyline
                    key={`segment-${currentRouteIndex}-${idx}`}
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
            <p>Finding the best routes for you...</p>
          </div>
        ) : (
          <>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Traffic Analysis</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showTraffic}
                    onChange={toggleTraffic}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center mb-2">
                <span className="text-sm mr-2">Departure Time:</span>
                <input
                  type="time"
                  value={`${currentTime
                    .getHours()
                    .toString()
                    .padStart(2, "0")}:${currentTime
                    .getMinutes()
                    .toString()
                    .padStart(2, "0")}`}
                  onChange={handleTimeChange}
                  className="border rounded px-2 py-1 text-sm w-20"
                />
              </div>

              {showTraffic && (
                <div className="flex items-center mt-2">
                  <div
                    className="w-3 h-3 rounded-full mr-2"
                    style={{ backgroundColor: getTrafficColor(trafficLevel) }}
                  ></div>
                  <span className="text-xs text-gray-600">
                    {getTrafficDescription(trafficLevel)}
                  </span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Recommended Routes</h3>
              <div className="flex flex-col space-y-2">
                {routeOptions.map((route, idx) => (
                  <button
                    key={`route-option-${idx}`}
                    className={`p-2 rounded-lg text-left ${
                      currentRouteIndex === idx
                        ? "bg-blue-100 border-l-4 border-blue-500"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                    onClick={() => changeSelectedRoute(idx)}
                  >
                    <div className="font-medium">{route.label}</div>
                    <div className="text-sm flex justify-between mt-1">
                      <span>{formatTime(route.totalTime)}</span>
                      <span>{formatFare(route.totalFare)}</span>
                    </div>
                    {showTraffic && (
                      <div className="text-xs mt-1">
                        {route.segments.some(
                          (seg) =>
                            seg.type !== "walk" &&
                            seg.type !== "train" &&
                            seg.type !== "ferry"
                        ) ? (
                          <div className="flex items-center">
                            <div
                              className="w-2 h-2 rounded-full mr-1"
                              style={{
                                backgroundColor: getTrafficColor(trafficLevel),
                              }}
                            ></div>
                            <span>Traffic affected</span>
                          </div>
                        ) : (
                          <div className="text-green-600">
                            Not affected by traffic
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold">Summary</h3>
              <p>
                Total Distance:{" "}
                {formatDistance(routeOptions[currentRouteIndex].totalDistance)}
              </p>
              <p>
                Estimated Time:{" "}
                {formatTime(routeOptions[currentRouteIndex].totalTime)}
              </p>
              <p>
                Total Fare:{" "}
                {formatFare(routeOptions[currentRouteIndex].totalFare || 0)}
              </p>
              <p>
                Transfers:{" "}
                {allTransferPoints[currentRouteIndex]?.filter(
                  (p) => p.type === "transfer"
                ).length || 0}
              </p>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Step-by-Step Instructions</h3>
              <ol className="list-decimal pl-5 space-y-4">
                {routeOptions[currentRouteIndex].segments.map(
                  (segment, idx) => (
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
                        <div>
                          <p>
                            Walk{" "}
                            {formatDistance(
                              allWalkingRoutes[currentRouteIndex]?.[idx]
                                ?.distance ||
                                segment.distance ||
                                calculateDistance(segment.from, segment.to)
                            )}
                            {idx === 0 &&
                              " to reach " +
                                (routeOptions[currentRouteIndex].segments[1]
                                  ?.route?.name || "your route")}
                            {idx > 0 &&
                              idx <
                                routeOptions[currentRouteIndex].segments
                                  .length -
                                  1 &&
                              " to transfer to " +
                                (routeOptions[currentRouteIndex].segments[
                                  idx + 1
                                ]?.route?.name || "your next route")}
                            {idx ===
                              routeOptions[currentRouteIndex].segments.length -
                                1 && " to reach your destination"}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Est. time:{" "}
                            {formatTime(
                              (allWalkingRoutes[currentRouteIndex]?.[idx]
                                ?.distance ||
                                segment.distance ||
                                calculateDistance(segment.from, segment.to)) /
                                getSpeed("walk")
                            )}
                          </p>
                        </div>
                      ) : (
                        <div>
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
                          {showTraffic &&
                            segment.type !== "train" &&
                            segment.type !== "ferry" && (
                              <div className="flex items-center mt-1">
                                <div
                                  className="w-2 h-2 rounded-full mr-1"
                                  style={{
                                    backgroundColor:
                                      getTrafficColor(trafficLevel),
                                  }}
                                ></div>
                                <p className="text-xs">
                                  {trafficLevel === "heavy"
                                    ? "Heavy traffic expected"
                                    : trafficLevel === "moderate"
                                    ? "Moderate traffic expected"
                                    : "Light traffic expected"}
                                </p>
                              </div>
                            )}
                          <p className="text-xs text-gray-500 mt-1">
                            Est. time:{" "}
                            {formatTime(
                              segment.distance /
                                getSpeed(segment.type, showTraffic)
                            )}
                          </p>
                        </div>
                      )}

                      {allWalkingRoutes[currentRouteIndex]?.[idx]
                        ?.instructions &&
                        segment.type === "walk" && (
                          <ul className="text-sm text-gray-600 mt-2 list-disc pl-5">
                            {allWalkingRoutes[currentRouteIndex][
                              idx
                            ].instructions
                              .slice(0, -1)
                              .map((instruction, insIdx) => (
                                <li key={`instruction-${idx}-${insIdx}`}>
                                  {instruction.text}
                                </li>
                              ))}
                          </ul>
                        )}
                    </li>
                  )
                )}
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
