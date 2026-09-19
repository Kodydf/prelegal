"use client";

import { useState } from "react";
import AppHeader, { type View } from "@/components/AppHeader";
import AuthGate from "@/components/AuthGate";
import DraftingApp from "@/components/DraftingApp";
import MyDocuments from "@/components/MyDocuments";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import { getDraft, type DraftDetail } from "@/lib/drafts";

function Platform({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [view, setView] = useState<View>("draft");
  // The draft being resumed (null = a new document). `session` remounts the drafting screen.
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [session, setSession] = useState(0);
  const [openError, setOpenError] = useState<string | null>(null);

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
      setOpenError(err instanceof ApiError ? err.message : GENERIC_ERROR);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <AppHeader user={{ email }} view={view} onNavigate={navigate} onSignOut={onSignOut} />
      <main className="flex-1">
        {view === "documents" ? (
          <>
            {openError ? (
              <p role="alert" className="mx-auto mt-6 max-w-4xl rounded-lg border border-navy border-l-4 border-l-gold px-4 py-3 text-sm">
                {openError}
              </p>
            ) : null}
            <MyDocuments onOpen={(id) => void open(id)} onNew={startNew} />
          </>
        ) : (
          <DraftingApp key={session} initialDraft={draft} />
        )}
      </main>
      <footer className="border-t border-silver px-4 py-4 text-center text-xs text-black/60">
        Prelegal provides drafting assistance, not legal advice. Documents are drafts and are subject to legal review.
      </footer>
    </div>
  );
}

export default function PlatformApp() {
  return <AuthGate>{(user, signOut) => <Platform email={user.email} onSignOut={signOut} />}</AuthGate>;
}
