// Fake login for the V1 foundation: no authentication, just a client-side flag.
// Replaced by real sign up / sign in against the backend in a later ticket.
const STORAGE_KEY = "prelegal.user";

export interface FakeUser {
  email: string;
}

export function loadUser(): FakeUser | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof (parsed as FakeUser).email === "string") {
      return { email: (parsed as FakeUser).email };
    }
  } catch {
    // Storage unavailable or corrupt: treat as signed out.
  }
  return null;
}

export function saveUser(user: FakeUser): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Non-fatal: the user stays signed in for this page view only.
  }
}

export function clearUser(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
