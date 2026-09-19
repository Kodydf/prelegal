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

/** The message to show for any caught error. */
export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : GENERIC_ERROR;
}

/**
 * FastAPI sends `detail` as a string for our own errors, but as a list of {msg} objects for request
 * validation failures (e.g. a malformed email). Turn either into one readable sentence.
 */
function detailMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && typeof detail[0]?.msg === "string") {
    return detail[0].msg.replace(/^Value error, /, "");
  }
  return GENERIC_ERROR;
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
    throw new ApiError(detailMessage(detail), response.status);
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
