import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const GeoJSONMap = () => {
  const [geojsonData, setGeojsonData] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    const loadGeoJSON = async (file) => {
      try {
        const response = await fetch(`../data/${file}`);
        const data = await response.json();
        return data.features;
      } catch (error) {
        console.error(`Error loading ${file}:`, error);
        return [];
      }
    };

    const loadAllGeoJSON = async () => {
      const features1 = await loadGeoJSON("routes-1.geojson");
      const features2 = await loadGeoJSON("routes-2.geojson");
      setGeojsonData([...features1, ...features2]); // Merge both sets of features
    };

    loadAllGeoJSON();
  }, []); // Runs once when component mounts

  const handleRouteClick = (feature) => {
    setSelectedRoute(feature);
    setMapKey((prevKey) => prevKey + 1); // Force re-render of the GeoJSON layer
  };

  // Handle click to view all routes
  const handleViewAllRoutes = () => {
    setSelectedRoute(null);
    setMapKey((prevKey) => prevKey + 1);
  };

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
        }}
      >
        <h2>Routes</h2>
        <div
          style={{
            padding: "10px",
            marginBottom: "10px",
            cursor: "pointer",
            backgroundColor: "#f0f0f0",
            borderRadius: "4px",
            fontWeight: selectedRoute === null ? "bold" : "normal",
          }}
          onClick={handleViewAllRoutes}
        >
          View All Routes
        </div>
        {geojsonData.map((feature, index) => (
          <div
            key={index}
            style={{
              padding: "10px",
              cursor: "pointer",
              borderBottom: "1px solid #ddd",
              backgroundColor:
                selectedRoute &&
                selectedRoute.properties.name === feature.properties.name
                  ? "#e6f7ff"
                  : "transparent",
              fontWeight:
                selectedRoute &&
                selectedRoute.properties.name === feature.properties.name
                  ? "bold"
                  : "normal",
            }}
            onClick={() => handleRouteClick(feature)}
          >
            {feature.properties.name}
          </div>
        ))}
      </div>

      {/* Map */}
      <MapContainer
        key={mapKey}
        center={[14.5995, 120.9842]}
        zoom={12}
        style={{ height: "100vh", width: "75%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.carto.com/">CARTO</a> contributors'
        />

        {/* Show all routes when no route is selected */}
        {!selectedRoute && geojsonData.length > 0 && (
          <GeoJSON
            data={{ type: "FeatureCollection", features: geojsonData }}
            style={{ color: "blue", weight: 3, opacity: 0.7 }}
          />
        )}

        {/* Show only the selected route */}
        {selectedRoute && (
          <GeoJSON
            data={selectedRoute}
            style={{ color: "red", weight: 4, opacity: 1 }}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default GeoJSONMap;
