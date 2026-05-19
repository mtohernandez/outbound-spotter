import { env } from "@/config/env";

type RequestOptions = Omit<RequestInit, "headers"> & {
  readonly json?: unknown;
  readonly token?: string | null;
  readonly headers?: Record<string, string>;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API ${String(status)}`);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, token, headers, body, ...rest } = options;
  const hasJson = json !== undefined;
  const bodyToSend: BodyInit | null | undefined = hasJson ? JSON.stringify(json) : body;

  const init: RequestInit = {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(hasJson ? { "Content-Type": "application/json" } : {}),
      ...(token === undefined || token === null ? {} : { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    ...(bodyToSend === undefined ? {} : { body: bodyToSend }),
  };

  const response = await fetch(`${env.VITE_API_URL}${path}`, init);

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, errorBody);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
