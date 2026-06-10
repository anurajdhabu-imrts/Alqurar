import axios from "axios";

export const TOKEN_KEY = "alqarar.token";

const baseURL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000/api/v1";

// Default 15s timeout so a down/unreachable backend fails fast instead of
// hanging the app on boot. Long-running calls override this per-request.
export const api = axios.create({ baseURL, timeout: 15_000 });

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401: drop the token and bounce to /login (unless we're already there).
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem("alqarar.user");
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  },
);

/** Pull a user-friendly message out of an axios error. */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (err.message) return err.message;
  }
  return fallback;
}
