/**
 * Per-user EVM deposit wallet.
 * The backend generates and stores the keypair on first call; only the public
 * address is ever returned to the client.
 */

import { APP_CONFIG } from "@/config/app.config";
import { auth, getAppCheckToken } from "./firebase/config";
import { buildApiHeaders } from "./api-headers";

let cachedAddress: string | null = null;
let inFlight: Promise<string | null> | null = null;

export function getCachedUserWalletAddress(): string | null {
  return cachedAddress;
}

/**
 * Fetches (or creates on first login) the user's EVM wallet address.
 * Requires a signed-in Firebase user — the endpoint is auth-protected.
 */
export async function fetchUserWalletAddress(): Promise<string | null> {
  if (cachedAddress) return cachedAddress;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return null;

      let idToken: string | undefined;
      try {
        idToken = await currentUser.getIdToken();
      } catch {
        return null;
      }

      const appCheckToken = await getAppCheckToken();
      const res = await fetch(APP_CONFIG.api.userWalletUrl, {
        method: "GET",
        headers: buildApiHeaders({ appCheckToken, idToken }),
      });
      if (!res.ok) {
        console.warn("Failed to fetch user wallet:", res.status);
        return null;
      }
      const data = (await res.json()) as { address?: string };
      if (data.address) {
        cachedAddress = data.address;
        return data.address;
      }
      return null;
    } catch (err) {
      console.warn("Failed to fetch user wallet:", err);
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** Fire-and-forget prefetch — call after login. */
export function ensureUserWalletAddress(): void {
  void fetchUserWalletAddress();
}

/** Reset the cached address (e.g. on logout / account switch). */
export function resetUserWalletAddress(): void {
  cachedAddress = null;
}
