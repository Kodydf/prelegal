"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { setUnauthorizedHandler } from "@/lib/api";
import { fetchMe, signOut as signOutRequest, type User } from "@/lib/auth";

const SESSION_ENDED = "Your session has ended. Please sign in again.";

type State = { status: "loading" } | { status: "anonymous"; notice: string | null } | { status: "signed-in"; user: User };

export default function AuthGate({
  children,
}: {
  children: (user: User, signOut: () => void) => React.ReactNode;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((user) => {
        if (!cancelled) setState(user ? { status: "signed-in", user } : { status: "anonymous", notice: null });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "anonymous", notice: null });
      });
    // Any API call that comes back 401 means the session is gone: return to the sign-in screen.
    setUnauthorizedHandler(() => setState({ status: "anonymous", notice: SESSION_ENDED }));
    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const signOut = useCallback(() => {
    // Go back to the sign-in screen straight away; ending the server session is best-effort.
    setState({ status: "anonymous", notice: null });
    void signOutRequest().catch(() => {});
  }, []);

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-black/60" role="status">
        Loading…
      </div>
    );
  }
  if (state.status === "anonymous") {
    return <AuthScreen notice={state.notice} onAuthenticated={(user) => setState({ status: "signed-in", user })} />;
  }
  return children(state.user, signOut);
}
