

// Centralized API configuration
// In development with Vite proxy, requests to /api are proxied to http://localhost:5000
// In production, VITE_API_URL environment variable can override the base URL.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

export default API_BASE_URL;


