import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const GeoJSONMap = () => {
  const [geojsonData, setGeojsonData] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    fetch("../data/export.geojson")
      .then((response) => response.json())
      .then((data) => setGeojsonData(data))
      .catch((error) => console.error("Error loading GeoJSON:", error));
  }, []);

  const handleRouteClick = (feature) => {
    setSelectedRoute(feature);
    setMapKey((prevKey) => prevKey + 1); // Force re-render of the GeoJSON layer
  };

  return (
    <div style={{ display: "flex" }}>
      <div
        style={{
          width: "25%",
          height: "100vh",
          overflowY: "auto",
          padding: "10px",
          borderRight: "1px solid #ccc",
        }}
      >
        <h2>Routes</h2>
        {geojsonData &&
          geojsonData.features.map((feature, index) => (
            <div
              key={index}
              style={{
                padding: "10px",
                cursor: "pointer",
                borderBottom: "1px solid #ddd",
              }}
              onClick={() => handleRouteClick(feature)}
            >
              {feature.properties.name}
            </div>
          ))}
      </div>
      <MapContainer
        key={mapKey}
        center={[14.5995, 120.9842]}
        zoom={12}
        style={{ height: "100vh", width: "75%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {selectedRoute && (
          <GeoJSON data={selectedRoute} style={{ color: "blue" }} />
        )}
      </MapContainer>
    </div>
  );
};

export default GeoJSONMap;
