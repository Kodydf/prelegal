import type { NdaFormData } from "@/types/nda";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatResponse {
  reply: string;
  fields: NdaFormData;
}

export class ChatError extends Error {}

/** Send the conversation and current document fields; get the AI's reply and the updated fields. */
export async function sendChat(messages: ChatMessage[], fields: NdaFormData): Promise<ChatResponse> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, fields }),
    });
  } catch {
    throw new ChatError("Couldn't reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    const detail = await response.json().then((body) => body?.detail).catch(() => null);
    throw new ChatError(
      typeof detail === "string" ? detail : "Something went wrong. Please try again.",
    );
  }
  return response.json();
}
