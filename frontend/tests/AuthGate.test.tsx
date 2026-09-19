import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthGate from "@/components/AuthGate";
import { request } from "@/lib/api";
import { json, noContent, routeFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

function renderGate() {
  return render(
    <AuthGate>
      {(user, signOut) => (
        <div>
          <p>Signed in as {user.email}</p>
          <button onClick={signOut}>Sign out</button>
        </div>
      )}
    </AuthGate>,
  );
}

describe("AuthGate", () => {
  it("shows a loading state, then the sign-in screen when there is no session", async () => {
    routeFetch({ "GET /api/auth/me": () => json({ detail: "Please sign in." }, 401) });
    renderGate();
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("goes straight into the app when the session is valid", async () => {
    routeFetch({ "GET /api/auth/me": () => json({ email: "ann@example.com" }) });
    renderGate();
    expect(await screen.findByText("Signed in as ann@example.com")).toBeInTheDocument();
  });

  it("falls back to the sign-in screen if the session check itself fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderGate();
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
  });

  it("signs in through the form and then shows the app", async () => {
    routeFetch({
      "GET /api/auth/me": () => json({ detail: "Please sign in." }, 401),
      "POST /api/auth/signin": () => json({ email: "ann@example.com" }),
    });
    renderGate();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "ann@example.com");
    await user.type(screen.getByLabelText(/^Password/), "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Signed in as ann@example.com")).toBeInTheDocument();
  });

  it("signing out returns to the sign-in screen and ends the server session", async () => {
    const fetchMock = routeFetch({
      "GET /api/auth/me": () => json({ email: "ann@example.com" }),
      "POST /api/auth/signout": () => noContent(),
    });
    renderGate();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signout", { method: "POST" });
  });

  it("tells the user if the server could not end the session when signing out", async () => {
    routeFetch({
      "GET /api/auth/me": () => json({ email: "ann@example.com" }),
      "POST /api/auth/signout": () => json({ detail: "boom" }, 500),
    });
    renderGate();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/could not reach the server to end your session/);
  });

  it("returns to the sign-in screen with a notice when any API call reports an expired session", async () => {
    routeFetch({
      "GET /api/auth/me": () => json({ email: "ann@example.com" }),
      "GET /api/drafts": () => json({ detail: "Please sign in." }, 401),
    });
    renderGate();
    await screen.findByText("Signed in as ann@example.com");

    await expect(request("/api/drafts")).rejects.toThrow();

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Your session has ended");
  });

  it("does not treat a wrong-password 401 from the sign-in form as an expired session", async () => {
    routeFetch({
      "GET /api/auth/me": () => json({ detail: "Please sign in." }, 401),
      "POST /api/auth/signin": () => json({ detail: "Invalid email or password." }, 401),
    });
    renderGate();
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Email"), "ann@example.com");
    await user.type(screen.getByLabelText(/^Password/), "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(screen.queryByText(/session has ended/)).not.toBeInTheDocument();
  });
});
