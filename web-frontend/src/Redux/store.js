import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./Slice/AuthSlice";

export default configureStore({
  reducer: {
    auth: authReducer,
  },
});
