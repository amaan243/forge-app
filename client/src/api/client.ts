import axios from "axios";
import { toast } from "sonner";

const apiBaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
  (typeof process !== "undefined" && process.env?.VITE_API_URL) ||
  "http://localhost:4000";

const apiClient = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("archforge_token");
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = "An unexpected error occurred.";

    if (error.code === "ECONNABORTED" || error.message?.toLowerCase().includes("timeout")) {
      message = "Request timeout. Backend took too long to respond.";
    } else if (error.code === "ERR_NETWORK" || !error.response) {
      message = "Backend unavailable. Please verify the backend server is running.";
    } else if (error.response?.status >= 500) {
      message = `Backend server error (${error.response.status}). Please try again later.`;
    } else if (error.response?.data?.message) {
      message = String(error.response.data.message);
    }

    // Do not show global error toast if custom error handling is requested or for standard 401/403/404 form errors
    const isFormEndpoint =
      error.config?.url?.includes("/auth/login") ||
      error.config?.url?.includes("/auth/register") ||
      error.config?.url?.includes("/auth/verify-email");

    if (typeof window !== "undefined" && !isFormEndpoint && error.response?.status !== 401) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
