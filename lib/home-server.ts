const HOME_SERVER_URL =
  process.env.NEXT_PUBLIC_HOME_SERVER_URL ||
  process.env.HOME_SERVER_URL ||
  "http://localhost:8000";

export function getHomeServerUrl(path: string): string {
  const base = HOME_SERVER_URL.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
