"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, buttonClass, focusRing, primaryButtonClass } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { sendChat, type ChatMessage } from "@/lib/chat";
import type { DocumentValues } from "@/types/document";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm here to help you draft a legal agreement. Tell me what you need, for example an NDA, a cloud service agreement, or a partnership, and I'll guide you through it and fill in the document as we go.",
};

// Only the most recent messages are sent (and saved): the draft values carry everything settled so far,
// and this keeps a long conversation within what the server accepts.
const CLIENT_HISTORY = 100;

const STARTERS = ["I need an NDA", "A contract for my SaaS product", "A partnership agreement"];

interface ChatPanelProps {
  documentId: string | null;
  values: DocumentValues;
  /** The saved draft this conversation belongs to, if it has one yet. */
  draftId: number | null;
  /** The saved conversation when resuming a draft (without the greeting). */
  initialMessages?: ChatMessage[];
  onChange: (documentId: string | null, values: DocumentValues, draftId: number | null) => void;
}

export default function ChatPanel({ documentId, values, draftId, initialMessages = [], onChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING, ...initialMessages]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  // "Start over" remounts this panel; a reply still in flight must not repopulate the new draft.
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, isSending, error]);

  // The greeting is UI-only; the model only sees the real conversation.
  const send = async (history: ChatMessage[]) => {
    setIsSending(true);
    setError(null);
    try {
      const result = await sendChat(history.filter((m) => m !== GREETING).slice(-CLIENT_HISTORY), documentId, values, draftId);
      if (!mounted.current) return;
      setMessages([...history, { role: "assistant", content: result.reply }]);
      onChange(result.documentId, result.values, result.draftId);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSending(false);
    }
  };

  const submit = (raw: string) => {
    const text = raw.trim();
    if (!text || isSending) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    void send(history);
  };

  return (
    <div className="flex h-[70vh] min-h-[440px] flex-col overflow-hidden rounded-xl border border-silver bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-silver bg-silver/10 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-gold" aria-hidden />
        <span className="text-sm font-semibold text-navy">Drafting assistant</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, i) => (
          <div key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                message.role === "user"
                  ? "rounded-br-sm bg-navy text-white"
                  : "rounded-bl-sm border border-silver bg-white text-black"
              }`}
            >
              {message.content}
            </p>
          </div>
        ))}
        {messages.length === 1 && !isSending ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {STARTERS.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => submit(starter)}
                className={`rounded-full border border-navy px-3 py-1 text-xs font-medium text-navy transition-colors hover:bg-navy hover:text-white ${focusRing}`}
              >
                {starter}
              </button>
            ))}
          </div>
        ) : null}
        {isSending ? <p className="text-sm italic text-black/60">Thinking…</p> : null}
        {error ? (
          <Alert className="flex items-center gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void send(messages)}
              disabled={isSending}
              className={`${buttonClass} shrink-0 px-2 py-1 disabled:opacity-50`}
            >
              Retry
            </button>
          </Alert>
        ) : null}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        className="flex gap-2 border-t border-silver p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your message…"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-lg border border-silver px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
        <button
          type="submit"
          disabled={isSending || input.trim().length === 0}
          className={primaryButtonClass}
        >
          Send
        </button>
      </form>
    </div>
  );
}
