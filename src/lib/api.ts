// Base URL for the FastAPI backend. Set VITE_API_URL in the environment (a
// Railway variable on the frontend service, baked in at build time — or a
// local .env.local for dev) — falls back to localhost:8000 for local dev
// against a locally-running backend.
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}
