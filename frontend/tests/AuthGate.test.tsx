import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AuthGate from "@/components/AuthGate";
import AppHeader from "@/components/AppHeader";

function renderGate() {
  return render(
    <AuthGate>
      {(user, signOut) => (
        <div>
          <AppHeader user={user} onSignOut={signOut} />
          <p>Inside the platform</p>
        </div>
      )}
    </AuthGate>,
  );
}

describe("AuthGate (fake login)", () => {
  it("shows the login screen when signed out", async () => {
    renderGate();
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText("Inside the platform")).not.toBeInTheDocument();
  });

  it("lets anyone in without credentials", async () => {
    const user = userEvent.setup();
    renderGate();
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Inside the platform")).toBeInTheDocument();
    expect(screen.getByText("guest@prelegal.local")).toBeInTheDocument();
  });

  it("uses the entered email and stays signed in after a remount", async () => {
    const user = userEvent.setup();
    const first = renderGate();
    await user.type(await screen.findByLabelText("Email"), "  a@b.com ");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByText("a@b.com")).toBeInTheDocument();
    first.unmount();

    renderGate();
    expect(await screen.findByText("Inside the platform")).toBeInTheDocument();
  });

  it("signs out back to the login screen", async () => {
    const user = userEvent.setup();
    const first = renderGate();
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    first.unmount();

    renderGate();
    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
