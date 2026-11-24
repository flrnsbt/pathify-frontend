import { auth } from "../config";
import { handleAuthExpired } from "../auth-context";

export const LOCAL_STORAGE_PROFILE_KEY = "vtracer_local_profile";
export const LOCAL_STORAGE_TRANSACTIONS_KEY = "vtracer_local_transactions";

export function safeGetStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetStorage(key: string, val: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, val);
  } catch { }
}

/** Parses a JSON response body, tolerating empty/non-JSON payloads. */
export async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/**
 * Handles a 401 from a backend call: refreshes the ID token when the server
 * reports an expired/invalid token, otherwise expires the session.
 */
export async function handleUnauthorizedResponse(res: Response): Promise<void> {
  const errData = await readApiJson(res.clone());
  const msg = typeof errData.error === "string" ? errData.error : "";
  if (!/expired|invalid.*token/i.test(msg)) return;
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      await currentUser.getIdToken(true);
      console.warn(
        "[API] Session confirmed active with Google. Skipping disconnect.",
      );
    } else {
      await handleAuthExpired();
    }
  } catch (authErr) {
    console.warn(
      "[API] Google confirmed session is revoked, signing out:",
      authErr,
    );
    await handleAuthExpired();
  }
}
