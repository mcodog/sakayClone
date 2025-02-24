import React from "react";

const FloatingIcon = ({ icon: Icon }) => {
  return (
    <div className="inline-flex items-center justify-center shadow-lg rounded-lg p-5 cursor-pointer">
      <Icon />
    </div>
  );
};

export default FloatingIcon;
