export function getHomeServerUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/api/proxy${normalized}`;
}
