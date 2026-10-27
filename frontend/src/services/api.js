import axios from "axios";
export class ApiResponseError extends Error {}
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  timeout: 12000,
});
api.interceptors.response.use((response) => {
  if (
    response.status !== 204 &&
    (!response.headers["content-type"]?.includes("application/json") ||
      typeof response.data === "string")
  ) {
    throw new ApiResponseError(
      "The café API returned an unexpected page. Please refresh and try again.",
    );
  }
  return response;
});
export function parseUser(value) {
  if (
    !value ||
    typeof value.id !== "string" ||
    typeof value.full_name !== "string" ||
    !value.full_name.trim() ||
    typeof value.email !== "string" ||
    !["customer", "admin"].includes(value.role)
  ) {
    throw new ApiResponseError(
      "Your account could not be loaded. Please try signing in again.",
    );
  }
  return value;
}
export function parseList(value, label = "data") {
  if (!Array.isArray(value))
    throw new ApiResponseError(
      `The café could not load your ${label}. Please try again shortly.`,
    );
  return value;
}
export const message = (error) =>
  typeof error.response?.data?.error === "string"
    ? error.response.data.error
    : error instanceof ApiResponseError
      ? error.message
      : "Unable to connect. Please try again shortly.";
