import React from "react";
import { Outlet } from "react-router-dom";
import Header from "../Partials/Header";

const ClientLayout = () => {
  return (
    <>
      <Header />
      <div className="mt-20 px-14">
        <Outlet />
      </div>
    </>
  );
};

export default ClientLayout;
