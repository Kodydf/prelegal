"use client";

import { useEffect, useRef, useState } from "react";
import AppHeader, { type View } from "@/components/AppHeader";
import AuthGate from "@/components/AuthGate";
import DraftingApp from "@/components/DraftingApp";
import MyDocuments from "@/components/MyDocuments";
import { Alert } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { SITE_DISCLAIMER } from "@/lib/disclaimer";
import { getDraft, type DraftDetail } from "@/lib/drafts";

function Platform({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [view, setView] = useState<View>("draft");
  // The draft being resumed (null = a new document). `session` remounts the drafting screen.
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [session, setSession] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);

  // After switching screens, move keyboard focus to the new content instead of leaving it on a removed button.
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [view, session]);

  const startNew = () => {
    setDraft(null);
    setSession((n) => n + 1);
    setOpenError(null);
    setView("draft");
  };

  const navigate = (next: View) => {
    setOpenError(null);
    if (next === "draft") startNew();
    else setView(next);
  };

  const open = async (id: number) => {
    setOpenError(null);
    try {
      setDraft(await getDraft(id));
      setSession((n) => n + 1);
      setView("draft");
    } catch (err) {
      setOpenError(errorMessage(err));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader user={{ email }} view={view} onNavigate={navigate} onSignOut={onSignOut} />
      <main ref={mainRef} tabIndex={-1} className="flex-1 outline-none">
        {view === "documents" ? (
          <>
            {openError ? (
              <Alert className="mx-auto mt-6 max-w-4xl">{openError}</Alert>
            ) : null}
            <MyDocuments onOpen={(id) => void open(id)} onNew={startNew} />
          </>
        ) : (
          <DraftingApp key={session} initialDraft={draft} />
        )}
      </main>
      <footer className="border-t border-silver px-4 py-4 text-center text-xs text-black/60">
        {SITE_DISCLAIMER}
      </footer>
    </div>
  );
}

export default function PlatformApp() {
  return <AuthGate>{(user, signOut) => <Platform email={user.email} onSignOut={signOut} />}</AuthGate>;
}
