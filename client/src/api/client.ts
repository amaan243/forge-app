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
  timeout: 60000,
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

// In-flight GET request deduplication and short-lived read cache
const inFlightRequests = new Map<string, Promise<any>>();
const queryCache = new Map<string, { res: any; time: number }>();
const CACHE_TTL_MS = 2500; // 2.5 seconds: eliminates duplicate requests during mounting and quick tab switches without serving stale data

export function invalidateApiCache(pattern?: string) {
  if (!pattern) {
    queryCache.clear();
  } else {
    for (const key of queryCache.keys()) {
      if (key.includes(pattern)) {
        queryCache.delete(key);
      }
    }
  }
}

// Invalidate cache immediately on any mutation (POST, PUT, PATCH, DELETE)
apiClient.interceptors.response.use(
  (response) => {
    const method = response.config?.method?.toLowerCase();
    if (method && method !== "get") {
      queryCache.clear();
    }
    return response;
  },
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

// Intercept apiClient.get to deduplicate in-flight requests and reuse warm reads
const originalGet = apiClient.get.bind(apiClient);
apiClient.get = function <T = any, R = any, D = any>(url: string, config?: any): Promise<R> {
  const token = typeof window !== "undefined" ? localStorage.getItem("archforge_token") || "" : "";
  const paramStr = config?.params ? JSON.stringify(config.params) : "";
  const cacheKey = `${url}::${paramStr}::${token}`;

  const bypassCache = config?.headers?.["x-skip-cache"] || config?.cache === false;

  if (!bypassCache) {
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      return Promise.resolve(cached.res as R);
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)! as Promise<R>;
    }
  }

  const promise = originalGet<T, R, D>(url, config)
    .then((res: any) => {
      inFlightRequests.delete(cacheKey);
      if (!bypassCache && res.status >= 200 && res.status < 300) {
        queryCache.set(cacheKey, { res, time: Date.now() });
      }
      return res;
    })
    .catch((err: any) => {
      inFlightRequests.delete(cacheKey);
      throw err;
    });

  if (!bypassCache) {
    inFlightRequests.set(cacheKey, promise);
  }

  return promise;
};

export default apiClient;
