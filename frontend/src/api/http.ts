import type { ApiError } from "../types/api";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

function buildApiError(status: number, detail: string): ApiError {
  const error = new Error(detail) as ApiError;
  error.name = "ApiError";
  error.status = status;
  error.detail = detail;
  return error;
}

async function parseError(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as { detail?: unknown };
      if (typeof data.detail === "string") return data.detail;
      if (Array.isArray(data.detail)) return "Request validation failed.";
      return JSON.stringify(data.detail ?? data);
    }
    const text = await response.text();
    return text || response.statusText || "Request failed.";
  } catch {
    return response.statusText || "Request failed.";
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const hasBody = options.body !== undefined;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw buildApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
