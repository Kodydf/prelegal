"use client";

import { useEffect, useRef, useState } from "react";
import { ChatError, GENERIC_ERROR, sendChat, type ChatMessage } from "@/lib/chat";
import type { NdaFormData } from "@/types/nda";

const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm here to help you draft a Mutual NDA. Tell me a bit about the deal, such as who the two parties are and what you'll be sharing, and I'll fill in the document as we go.",
};

interface ChatPanelProps {
  data: NdaFormData;
  onChange: (data: NdaFormData) => void;
}

export default function ChatPanel({ data, onChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, isSending, error]);

  // The greeting is UI-only; the model only sees the real conversation.
  const send = async (history: ChatMessage[]) => {
    setIsSending(true);
    setError(null);
    try {
      const result = await sendChat(history.filter((m) => m !== GREETING), data);
      setMessages([...history, { role: "assistant", content: result.reply }]);
      onChange(result.fields);
    } catch (err) {
      setError(err instanceof ChatError ? err.message : GENERIC_ERROR);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isSending) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    void send(history);
  };

  return (
    <div className="flex h-[70vh] min-h-[420px] flex-col rounded-lg border border-silver bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.map((message, i) => (
          <div key={i} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "bg-navy text-white"
                  : "border border-silver bg-white text-black"
              }`}
            >
              {message.content}
            </p>
          </div>
        ))}
        {isSending ? <p className="text-sm italic text-black/60">Thinking…</p> : null}
        {error ? (
          <div role="alert" className="flex items-center gap-3 rounded-md border border-navy border-l-4 border-l-gold bg-white px-3 py-2 text-sm text-black">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void send(messages)}
              disabled={isSending}
              className="shrink-0 rounded-md border border-navy px-2 py-1 font-medium text-navy hover:bg-silver/30 disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-silver p-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Type your message…"
          aria-label="Message"
          className="min-w-0 flex-1 rounded-md border border-silver px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
        />
        <button
          type="submit"
          disabled={isSending || input.trim().length === 0}
          className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-gold disabled:cursor-not-allowed disabled:bg-silver"
        >
          Send
        </button>
      </form>
    </div>
  );
}
