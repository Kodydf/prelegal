import { ApiError, postJson, request } from "@/lib/api";

export interface User {
  email: string;
}

export const MIN_PASSWORD_LENGTH = 8;

export async function signUp(email: string, password: string): Promise<User> {
  return (await postJson("/api/auth/signup", { email, password })).json();
}

export async function signIn(email: string, password: string): Promise<User> {
  return (await postJson("/api/auth/signin", { email, password })).json();
}

export async function signOut(): Promise<void> {
  await request("/api/auth/signout", { method: "POST" });
}

/** The signed-in user, or null if there is no valid session. */
export async function fetchMe(): Promise<User | null> {
  try {
    return await (await request("/api/auth/me")).json();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}
