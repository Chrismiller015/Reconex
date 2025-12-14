import axios from "axios";

const baseURL = typeof window === "undefined" ? process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000" : "/";

export const apiClient = axios.create({
  baseURL: `${baseURL.replace(/\/$/, "")}/api`,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (process.env.NODE_ENV !== "production") {
      console.error("API error", error);
    }
    return Promise.reject(error);
  },
);
