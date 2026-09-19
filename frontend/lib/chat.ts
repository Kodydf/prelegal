import type { DocumentDefinition, DocumentValues } from "@/types/document";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  documentId: string | null;
  values: DocumentValues;
}

export const GENERIC_ERROR = "Something went wrong. Please try again.";

export class ChatError extends Error {}

async function request(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ChatError("Couldn't reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    const detail = await response.json().then((body) => body?.detail).catch(() => null);
    throw new ChatError(typeof detail === "string" ? detail : GENERIC_ERROR);
  }
  return response;
}

/** Send the conversation and current draft; get the AI's reply and the updated draft. */
export async function sendChat(
  messages: ChatMessage[],
  documentId: string | null,
  values: DocumentValues,
): Promise<ChatResponse> {
  const response = await request("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, documentId, values }),
  });
  return response.json();
}

export async function fetchDocument(id: string): Promise<DocumentDefinition> {
  const response = await request(`/api/documents/${encodeURIComponent(id)}`);
  return response.json();
}
