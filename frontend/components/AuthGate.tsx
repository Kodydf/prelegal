"use client";

import { useCallback, useEffect, useState } from "react";
import AuthScreen from "@/components/AuthScreen";
import { setUnauthorizedHandler } from "@/lib/api";
import { fetchMe, signOut as signOutRequest, type User } from "@/lib/auth";

const SESSION_ENDED = "Your session has ended. Please sign in again.";
const SIGN_OUT_INCOMPLETE =
  "You are signed out on this screen, but we could not reach the server to end your session. If this is a shared computer, please close the browser window.";

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
    // Wait for the server to end the session, so "signed out" is true; if it can't, say so.
    signOutRequest().then(
      () => setState({ status: "anonymous", notice: null }),
      () => setState({ status: "anonymous", notice: SIGN_OUT_INCOMPLETE }),
    );
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
