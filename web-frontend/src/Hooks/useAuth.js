import { useDispatch } from "react-redux";
import Cookies from "js-cookie";
import axiosInstance from "../Utils/axiosInstance";
import {
  setEmail,
  setFirstName,
  setLastName,
  setName,
  toggleAdmin,
  toggleLogin,
  triggerLogout,
} from "../Redux/Slice/AuthSlice";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogin = async (formstate) => {
    try {
      const result = await axiosInstance.post("/api/token/", formstate);
      Cookies.set("token", result.data.access, {
        expires: 1,
        secure: true,
        sameSite: "Strict",
      });
      await fetchUserProfile(result.data.access);
    } catch (e) {
      console.log(e);
    }
  };

  const handleRegister = async (formstate) => {
    try {
      const result = await axiosInstance.post("/User/", formstate);
      console.log(result);
      await handleLogin(formstate);
      window.location.reload();
    } catch (e) {
      console.log(e);
    }
  };

  const fetchUserProfile = async (token) => {
    try {
      const response = await axiosInstance.get("api/user/profile/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      // console.log(response.data);
      dispatch(setName(response.data.username));
      dispatch(setEmail(response.data.email));
      dispatch(setFirstName(response.data.first_name));
      dispatch(setLastName(response.data.last_name));
      dispatch(toggleLogin());

      if (response.data.isAdmin) {
        dispatch(toggleAdmin());
      }

      navigate("/");
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const handleLogout = async () => {
    try {
      Cookies.remove("token");
      dispatch(triggerLogout());
      navigate("/");
      window.location.reload();
    } catch (e) {
      console.log(e);
    }
  };

  return {
    handleLogin,
    handleLogout,
    handleRegister,
  };
};
