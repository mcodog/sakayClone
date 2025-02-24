import React, { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap, // Import useMap hook
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "leaflet-routing-machine"; // Import routing machine library

const Map = () => {
  const [stops, setStops] = useState([]);
  const [groupedStops, setGroupedStops] = useState({});

  // Define the bounding box for Makati, Taguig, Pasay, Paranaque, and Pasig
  const minLat = 14.5;
  const maxLat = 14.6;
  const minLon = 121.0;
  const maxLon = 121.1;

  // Parse URL parameters for the new route
  const urlParams = new URLSearchParams(window.location.search);
  const originLat = parseFloat(urlParams.get("originLat"));
  const originLng = parseFloat(urlParams.get("originLng"));
  const destinationLat = parseFloat(urlParams.get("destinationLat"));
  const destinationLng = parseFloat(urlParams.get("destinationLng"));

  useEffect(() => {
    // Load the stops data
    fetch("../data/stops.json")
      .then((response) => response.json())
      .then((data) => {
        const filteredStops = data.filter((stop) => {
          const lat = parseFloat(stop.stop_lat);
          const lon = parseFloat(stop.stop_lon);
          return (
            lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon
          );
        });

        const grouped = filteredStops.reduce((acc, stop) => {
          const { stop_name, stop_lat, stop_lon, stop_id } = stop;
          if (!acc[stop_name]) {
            acc[stop_name] = [];
          }
          acc[stop_name].push({
            id: stop_id,
            name: stop_name,
            lat: parseFloat(stop_lat),
            lon: parseFloat(stop_lon),
          });
          return acc;
        }, {});

        setStops(filteredStops);
        setGroupedStops(grouped);
      });
  }, []);

  const getRandomColor = () => {
    const letters = "0123456789ABCDEF";
    let color = "#";
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  };

  const RoutingControl = () => {
    const map = useMap(); // Access the map instance

    useEffect(() => {
      if (originLat && originLng && destinationLat && destinationLng) {
        const routeControl = L.Routing.control({
          waypoints: [
            L.latLng(originLat, originLng),
            L.latLng(destinationLat, destinationLng),
          ],
          routeWhileDragging: true, // Allow route dragging
          createMarker: () => null, // Disable markers on route
          lineOptions: {
            styles: [{ color: "blue", weight: 12, opacity: 0.7 }],
          },
        }).addTo(map); // Add routing control to the map
        return () => {
          routeControl.remove(); // Clean up routing control on unmount
        };
      }
    }, [originLat, originLng, destinationLat, destinationLng, map]);

    return null; // This component doesn't need to render anything
  };

  return (
    <MapContainer
      center={[14.551, 121.047]}
      zoom={13}
      style={{ width: "100%", height: "100vh" }}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png" />
      <RoutingControl /> {/* Add the routing control component here */}
      {Object.keys(groupedStops).map((stopName) => {
        const group = groupedStops[stopName];
        const color = getRandomColor();

        return (
          <React.Fragment key={stopName}>
            <Polyline
              positions={group.map((stop) => [stop.lat, stop.lon])}
              color={"#6e6e6e"}
              weight={10}
            />
            {group.map((stop) => (
              <Marker key={stop.id} position={[stop.lat, stop.lon]}>
                <Popup>
                  <strong>{stop.name}</strong> <br />
                  Lat: {stop.lat} <br />
                  Lng: {stop.lon}
                </Popup>
              </Marker>
            ))}
          </React.Fragment>
        );
      })}
    </MapContainer>
  );
};

export default Map;
