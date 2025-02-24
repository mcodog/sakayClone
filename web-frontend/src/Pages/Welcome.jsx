import React, { useState, useRef } from "react";
import { FaLocationCrosshairs } from "react-icons/fa6";
import { LoadScript, Autocomplete } from "@react-google-maps/api";
import { useNavigate } from "react-router-dom";

const GOOGLE_MAPS_API_KEY = "AIzaSyA95PKITYX6vnFS2d4gIS2J9caKnP0w-bA"; // Replace with your API key

const containerStyle = { width: "100%", height: "400px" };
const metroManilaBounds = {
  north: 15.0,
  south: 14.0,
  west: 120.5,
  east: 121.5,
};

const Welcome = () => {
  const [currentAddress, setCurrentAddress] = useState("");
  const [currentCoordinates, setCurrentCoordinates] = useState(null);
  const [destination, setDestination] = useState("");
  const [destinationCoordinates, setDestinationCoordinates] = useState(null);
  const autocompleteRef = useRef(null);
  const navigate = useNavigate();

  // Get user's current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentCoordinates({ lat: latitude, lng: longitude });

          // Reverse geocode to get the address
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results, status) => {
              if (status === "OK" && results[0]) {
                setCurrentAddress(results[0].formatted_address);
              } else {
                setCurrentAddress("Location not found");
              }
            }
          );
        },
        () => setCurrentAddress("Unable to fetch location")
      );
    } else {
      setCurrentAddress("Geolocation is not supported");
    }
  };

  // Handle place selection
  const handlePlaceSelect = () => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place && place.formatted_address && place.geometry) {
        setDestination(place.formatted_address);
        setDestinationCoordinates({
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        });
      }
    }
  };

  // useEffect(() => {
  //   getCurrentLocation();
  // }, []);

  const goToMap = () => {
    if (!currentCoordinates || !destinationCoordinates) {
      alert("Please select a starting and destination point.");
      return;
    }

    // Construct URL with query parameters
    const queryString = new URLSearchParams({
      originLat: currentCoordinates.lat,
      originLng: currentCoordinates.lng,
      destinationLat: destinationCoordinates.lat,
      destinationLng: destinationCoordinates.lng,
    }).toString();

    navigate(`/map?${queryString}`);
  };

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={["places"]}>
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100">
        {/* Current Location */}
        <div className="flex flex-col gap-4 my-4 w-1/3">
          <div className="font-bold text-3xl text-center">Your location</div>
          <div className="border rounded-lg flex p-2 bg-white">
            <input
              className="flex w-full focus:outline-none focus:ring-0 pl-2"
              type="text"
              placeholder="Your location"
              value={currentAddress}
              readOnly
            />
            <button
              onClick={getCurrentLocation}
              className="bg-slate-800 text-white p-4 rounded-lg"
            >
              <FaLocationCrosshairs />
            </button>
          </div>
        </div>

        {/* Destination with Google Places Autocomplete */}
        <div className="flex flex-col gap-4 my-4 w-1/3">
          <div className="font-bold text-3xl text-center">
            Where would you like to go?
          </div>
          <div className="border rounded-lg flex p-2 bg-white">
            <Autocomplete
              className="flex w-full focus:outline-none focus:ring-0 p-2 pl-2"
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
                autocomplete.setBounds(metroManilaBounds); // Restrict search to Metro Manila
              }}
              onPlaceChanged={handlePlaceSelect}
              options={{
                componentRestrictions: { country: "PH" },
                types: ["geocode"], // Prioritize addresses
              }}
            >
              <input
                className="flex w-full focus:outline-none focus:ring-0 pl-2"
                type="text"
                placeholder="Enter destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </Autocomplete>
          </div>
        </div>

        {/* Display Map */}
        {/* <GoogleMap
          mapContainerStyle={containerStyle}
          center={currentCoordinates || { lat: 14.5995, lng: 120.9842 }}
          zoom={currentCoordinates ? 14 : 12}
        /> */}
        <button
          onClick={goToMap}
          className="bg-green-600 text-white p-4 rounded-lg mt-4"
        >
          View Route on Map
        </button>
      </div>
    </LoadScript>
  );
};

export default Welcome;
