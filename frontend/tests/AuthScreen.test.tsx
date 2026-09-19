import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthScreen from "@/components/AuthScreen";
import { bodyOf, json, routeFetch } from "./helpers";

afterEach(() => vi.unstubAllGlobals());

async function fill(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText(/^Password/), password);
  return user;
}

describe("AuthScreen", () => {
  it("shows the sign-in form by default, with the draft disclaimer", () => {
    render(<AuthScreen onAuthenticated={() => {}} />);
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled(); // nothing entered yet
    expect(screen.getByText(/subject to legal review/)).toBeInTheDocument();
  });

  it("signs in and reports the user", async () => {
    const fetchMock = routeFetch({ "POST /api/auth/signin": () => json({ email: "ann@example.com" }) });
    const onAuthenticated = vi.fn();
    render(<AuthScreen onAuthenticated={onAuthenticated} />);
    const user = await fill("ann@example.com", "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onAuthenticated).toHaveBeenCalledWith({ email: "ann@example.com" });
    expect(bodyOf(fetchMock, "POST", "/api/auth/signin")).toEqual({ email: "ann@example.com", password: "correct horse" });
  });

  it("shows the server's error for wrong credentials and lets the user try again", async () => {
    routeFetch({ "POST /api/auth/signin": () => json({ detail: "Invalid email or password." }, 401) });
    const onAuthenticated = vi.fn();
    render(<AuthScreen onAuthenticated={onAuthenticated} />);
    const user = await fill("ann@example.com", "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(onAuthenticated).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("switches to sign up, enforces the password length locally, then creates the account", async () => {
    const fetchMock = routeFetch({ "POST /api/auth/signup": () => json({ email: "new@example.com" }, 201) });
    const onAuthenticated = vi.fn();
    render(<AuthScreen onAuthenticated={onAuthenticated} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("heading", { name: "Create your account" })).toBeInTheDocument();
    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText(/^Password/), "short");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("at least 8 characters");
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/^Password/), "-and-longer");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(onAuthenticated).toHaveBeenCalledWith({ email: "new@example.com" });
  });

  it("reports an email that is already registered", async () => {
    routeFetch({ "POST /api/auth/signup": () => json({ detail: "An account with that email already exists." }, 409) });
    render(<AuthScreen onAuthenticated={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email"), "ann@example.com");
    await user.type(screen.getByLabelText(/^Password/), "correct horse");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });

  it("clears a stale error when switching between sign in and sign up", async () => {
    routeFetch({ "POST /api/auth/signin": () => json({ detail: "Invalid email or password." }, 401) });
    render(<AuthScreen onAuthenticated={() => {}} />);
    const user = await fill("ann@example.com", "wrong password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a friendly message if the server can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<AuthScreen onAuthenticated={() => {}} />);
    const user = await fill("ann@example.com", "correct horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });

  it("shows a notice such as an expired session", () => {
    render(<AuthScreen onAuthenticated={() => {}} notice="Your session has ended. Please sign in again." />);
    expect(screen.getByRole("status")).toHaveTextContent("Your session has ended");
  });
});
