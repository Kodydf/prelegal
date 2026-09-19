export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** An API call failed. `message` is safe to show to the user. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 0,
  ) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;

/** Register a callback for when the server says the session is gone (401 on a non-auth call). */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** fetch wrapper: sends the session cookie and turns failures into ApiError with a readable message. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    const detail = await response.json().then((body) => body?.detail).catch(() => null);
    // A 401 from the sign-in form just means wrong credentials; anywhere else it means the session ended.
    if (response.status === 401 && !url.startsWith("/api/auth/")) onUnauthorized?.();
    throw new ApiError(typeof detail === "string" ? detail : GENERIC_ERROR, response.status);
  }
  return response;
}

export function postJson(url: string, body: unknown): Promise<Response> {
  return request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
