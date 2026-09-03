// Placeholder client-side session — NOT real security. This only exists so the
// dashboard can be gated behind a "signed in" state before the real Zoho SSO
// flow (backend OAuth callback + issued session/token) lands. It's just a flag
// in localStorage; anyone with devtools can flip it. Swap this out once the
// backend issues real sessions.

const SESSION_KEY = "tgo-workforce-session";

export function isSignedIn(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SESSION_KEY) === "true";
  } catch {
    return false;
  }
}

export function signIn(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_KEY, "true");
  } catch {
    // Storage unavailable (e.g. private browsing) — nothing to do.
  }
}

export function signOut(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable — nothing to do.
  }
}
