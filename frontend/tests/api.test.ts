import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorMessage, GENERIC_ERROR, request } from "@/lib/api";
import { json } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

/** Make fetch return `response` and return the ApiError that request() throws for it. */
async function failWith(response: Response): Promise<ApiError> {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  try {
    await request("/api/anything");
  } catch (err) {
    return err as ApiError;
  }
  throw new Error("expected request() to fail");
}

describe("request error messages", () => {
  it("uses a string detail as is", async () => {
    const err = await failWith(json({ detail: "An account with that email already exists." }, 409));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toBe("An account with that email already exists.");
    expect(err.status).toBe(409);
  });

  it("turns FastAPI's validation list into one readable sentence", async () => {
    const detail = [{ type: "value_error", loc: ["body", "email"], msg: "Value error, Enter a valid email address." }];
    expect((await failWith(json({ detail }, 422))).message).toBe("Enter a valid email address.");
    expect((await failWith(json({ detail: [{ msg: "Field required" }] }, 422))).message).toBe("Field required");
  });

  it("falls back to a generic message for anything else", async () => {
    expect((await failWith(json({ detail: [] }, 422))).message).toBe(GENERIC_ERROR);
    expect((await failWith(json({}, 500))).message).toBe(GENERIC_ERROR);
    expect((await failWith(new Response("<html>oops</html>", { status: 502 }))).message).toBe(GENERIC_ERROR);
  });

  it("reports an unreachable server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const err = await request("/api/anything").then(
      () => null,
      (e: unknown) => e as ApiError,
    );
    expect(err?.message).toMatch(/Couldn't reach the server/);
  });
});

describe("errorMessage", () => {
  it("shows an ApiError's message and hides anything unexpected", () => {
    expect(errorMessage(new ApiError("Nope.", 400))).toBe("Nope.");
    expect(errorMessage(new Error("internal detail"))).toBe(GENERIC_ERROR);
    expect(errorMessage("a string")).toBe(GENERIC_ERROR);
  });
});
