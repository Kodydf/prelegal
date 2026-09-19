"use client";

import { useEffect, useState } from "react";
import { ApiError, GENERIC_ERROR } from "@/lib/api";
import { deleteDraft, listDrafts, type DraftSummary } from "@/lib/drafts";

/** "2026-09-19T02:49:09+00:00" -> "Sep 19, 2026, 2:49 AM" in the viewer's locale and time zone. */
export function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

interface MyDocumentsProps {
  onOpen: (id: number) => void;
  onNew: () => void;
}

const buttonClass =
  "rounded-lg border border-navy px-3 py-1.5 text-sm font-medium text-navy transition-colors hover:bg-silver/30 focus:outline-none focus:ring-2 focus:ring-gold";

export default function MyDocuments({ onOpen, onNew }: MyDocumentsProps) {
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Deleting takes two clicks so a document isn't lost by accident.
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    listDrafts()
      .then((list) => {
        if (cancelled) return;
        setDrafts(list);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : GENERIC_ERROR);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const remove = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteDraft(id);
      setDrafts((current) => current?.filter((d) => d.id !== id) ?? null);
      setConfirmingId(null);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : GENERIC_ERROR);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-navy">My documents</h1>
          <p className="mt-1 text-sm text-black/60">Your saved drafts. Open one to keep editing or download it again.</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
        >
          New document
        </button>
      </div>

      {error ? (
        <div role="alert" className="mt-6 flex items-center gap-3 rounded-lg border border-navy border-l-4 border-l-gold px-4 py-3 text-sm">
          <span>{error}</span>
          {drafts === null ? (
            <button type="button" className={buttonClass} onClick={() => setAttempt((n) => n + 1)}>
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {drafts === null ? (
        error ? null : <p className="mt-10 text-sm italic text-black/60">Loading your documents…</p>
      ) : drafts.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-silver px-6 py-14 text-center">
          <p className="text-base font-medium text-black">No documents yet</p>
          <p className="mt-1 text-sm text-black/60">Start a conversation and your draft will be saved here automatically.</p>
          <button type="button" onClick={onNew} className={`${buttonClass} mt-5`}>
            Draft your first document
          </button>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {drafts.map((draft) => (
            <li
              key={draft.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-silver bg-white px-5 py-4 shadow-sm"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-black">{draft.documentName}</p>
                <p className="mt-0.5 truncate text-sm text-black/70">
                  {draft.parties.length > 0 ? draft.parties.join(" & ") : "Parties not filled in yet"}
                </p>
                <p className="mt-1 text-xs text-black/50">Updated {formatUpdated(draft.updatedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {confirmingId === draft.id ? (
                  <>
                    <span className="text-sm text-black/70">Delete this document?</span>
                    <button
                      type="button"
                      disabled={deletingId === draft.id}
                      onClick={() => void remove(draft.id)}
                      className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-50"
                    >
                      Confirm delete
                    </button>
                    <button type="button" className={buttonClass} onClick={() => setConfirmingId(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className={buttonClass} onClick={() => onOpen(draft.id)}>
                      Open
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${draft.documentName}`}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-black/60 transition-colors hover:bg-silver/30 hover:text-black focus:outline-none focus:ring-2 focus:ring-gold"
                      onClick={() => setConfirmingId(draft.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
