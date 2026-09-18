"use client";

import { useEffect, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import { clearUser, loadUser, saveUser, type FakeUser } from "@/lib/auth";

export default function AuthGate({
  children,
}: {
  children: (user: FakeUser, signOut: () => void) => React.ReactNode;
}) {
  const [user, setUser] = useState<FakeUser | null>(null);
  // Static export: localStorage is only readable after hydration.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after hydration
    setUser(loadUser());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!user) {
    return (
      <LoginScreen
        onSignIn={(email) => {
          const next = { email };
          saveUser(next);
          setUser(next);
        }}
      />
    );
  }

  return children(user, () => {
    clearUser();
    setUser(null);
  });
}
