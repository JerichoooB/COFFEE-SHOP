import axios from "axios";
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 12000,
});
export const message = (e) =>
  e.response?.data?.error || "Unable to connect. Please try again shortly.";
