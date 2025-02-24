import React from "react";
import { Route, Routes } from "react-router-dom";
import "./App.css";

import Welcome from "./Pages/Welcome";
import Map from "./Pages/Map";
import { Provider } from "react-redux";
import store from "./Redux/store";

const App = () => {
  return (
    <Provider store={store}>
      <Routes>
        <Route index element={<Welcome />} />
        <Route path="/map" element={<Map />} />
      </Routes>
    </Provider>
  );
};

export default App;
