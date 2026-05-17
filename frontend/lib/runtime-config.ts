const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export const API_BASE_URL = trimTrailingSlash(rawApiUrl);

export function requireApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured.");
  }

  return API_BASE_URL;
}

export function buildApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${requireApiBaseUrl()}${normalizedPath}`;
}

export function buildStorageUrl(path?: string | null): string {
  if (!path) {
    return "";
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const normalizedPath = path.replace(/^\/+/, "").replace(/^storage\/+/, "");
  return `${requireApiBaseUrl()}/storage/${normalizedPath}`;
}
