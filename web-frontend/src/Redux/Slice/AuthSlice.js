import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isLoggedIn: false,
  isAdmin: false,
  name: "",
  email: "",
  firstName: "",
  lastName: "",
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    toggleLogin: (state, action) => {
      state.isLoggedIn = !state.isLoggedIn;
    },
    toggleAdmin: (state, action) => {
      state.isAdmin = !state.isAdmin;
    },
    setName: (state, action) => {
      state.name = action.payload;
    },
    setEmail: (state, action) => {
      state.email = action.payload;
    },
    setFirstName: (state, action) => {
      state.firstName = action.payload;
    },
    setLastName: (state, action) => {
      state.lastName = action.payload;
    },
    triggerLogout: () => initialState,
  },
});

export const {
  toggleLogin,
  toggleAdmin,
  setName,
  setEmail,
  setFirstName,
  setLastName,
  triggerLogout,
} = authSlice.actions;
export default authSlice.reducer;
