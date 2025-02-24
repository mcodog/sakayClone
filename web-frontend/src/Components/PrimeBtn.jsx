import React from "react";

const PrimeBtn = ({ text, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="font-comfortaa p-4 px-8 bg-slate-800 text-white rounded-2xl cursor-pointer hover:text-slate-800 hover:border-2 hover:border-slate-800 hover:bg-gray-200 transition-all duration-300 ease-in-out transform hover:scale-105 w-full"
    >
      {text}
    </button>
  );
};

export default PrimeBtn;
