import routesData from "../data/routes.json";
import stopsData from "../data/stops.json";
import shapesData from "../data/shapes.json";
import tripsData from "../data/trips.json";
import stopTimesData from "../data/stop_times.json";

const getNearestStop = (lat, lng) => {
  return stopsData.reduce(
    (nearest, stop) => {
      // console.log(
      //   `Checking stop: ${stop.stop_name}, lat: ${stop.stop_lat}, lng: ${stop.stop_lon}`
      // );

      const distance = Math.sqrt(
        Math.pow(lat - stop.stop_lat, 2) + Math.pow(lng - stop.stop_lon, 2)
      );

      // console.log(`Distance to stop: ${distance}`);

      return distance < nearest.distance ? { stop, distance } : nearest;
    },
    { stop: null, distance: Infinity }
  ).stop;
};

export function getRoutesPassingStop(stopId) {
  const relevantTrips = stopTimesData
    .filter((stopTime) => stopTime.stop_id === stopId)
    .map((stopTime) => stopTime.trip_id);

  const relevantRouteIds = tripsData
    .filter((trip) => relevantTrips.includes(trip.trip_id))
    .map((trip) => trip.route_id);

  const routes = routesData
    .filter((route) => relevantRouteIds.includes(route.route_id))
    .map((route) => {
      const routeStops = tripsData
        .filter((trip) => trip.route_id === route.route_id)
        .flatMap((trip) =>
          stopTimesData
            .filter((stopTime) => stopTime.trip_id === trip.trip_id)
            .map((stopTime) => stopTime.stop_id)
        );

      console.log(`Route ${route.route_id} has stops:`, routeStops);

      return { ...route, stops: routeStops };
    });

  return routes;
}

const getRouteShape = (routeId) => {
  const shapePoints = shapesData
    .filter((shape) => shape.shape_id === routeId) // Match route
    .sort((a, b) => a.shape_pt_sequence - b.shape_pt_sequence) // Sort by sequence
    .map((shape) => [shape.shape_pt_lat, shape.shape_pt_lon]); // Convert to [lat, lon]

  console.log("Shape for route", routeId, shapePoints); // Debugging

  return shapePoints;
};

export default { getNearestStop, getRoutesPassingStop, getRouteShape };
