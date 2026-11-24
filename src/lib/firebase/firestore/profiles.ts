import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { db, auth, getAppCheckToken } from "../config";
import { handleAuthExpired } from "../auth-context";
import { getGenerationsPerUnlock } from "../../app-config";
import {
  requestServerHandshake,
  hasValidSessionTicket,
  getSessionTicket,
} from "../../security/handshake";
import { APP_CONFIG } from "@/config/app.config";
import { buildApiHeaders } from "../../api-headers";
import { UserProfile } from "./types";
import {
  LOCAL_STORAGE_PROFILE_KEY,
  safeGetStorage,
  safeSetStorage,
  handleUnauthorizedResponse,
} from "./utils";

/**
 * Checks the unlock status and generation quota of an image by its hash.
 * Unlocking an image with 1 credit grants a fixed number of generations.
 */
export function getImageUnlockStatus(
  profile: UserProfile | null,
  imageHash?: string,
): {
  isUnlocked: boolean;
  generationsRemaining: number;
  generationsUsed: number;
  maxGenerations: number;
} {
  if (!profile || !imageHash) {
    return {
      isUnlocked: false,
      generationsRemaining: 0,
      generationsUsed: 0,
      maxGenerations: getGenerationsPerUnlock(),
    };
  }

  // Active subscribers have unlimited generations
  if (profile.subscription?.status === "active") {
    return {
      isUnlocked: true,
      generationsRemaining: 9999,
      generationsUsed: 0,
      maxGenerations: 9999,
    };
  }

  // Check active cryptographic session ticket
  if (hasValidSessionTicket(imageHash)) {
    const sessionTicket = getSessionTicket(imageHash);
    if (sessionTicket) {
      return {
        isUnlocked: sessionTicket.generationsRemaining > 0,
        generationsRemaining: sessionTicket.generationsRemaining,
        generationsUsed: sessionTicket.generationsUsed,
        maxGenerations: sessionTicket.maxGenerations,
      };
    }
  }

  const info = profile.unlockedImages?.[imageHash];
  if (!info) {
    return {
      isUnlocked: false,
      generationsRemaining: 0,
      generationsUsed: 0,
      maxGenerations: getGenerationsPerUnlock(),
    };
  }

  const maxGen = Math.min(
    info.maxGenerations || getGenerationsPerUnlock(),
    getGenerationsPerUnlock(),
  );
  const used = info.generationsUsed || 0;
  const remaining = Math.max(0, maxGen - used);

  return {
    isUnlocked: remaining > 0,
    generationsRemaining: remaining,
    generationsUsed: used,
    maxGenerations: maxGen,
  };
}

export function canAccessSvg(
  profile: UserProfile | null,
  imageHash?: string,
): boolean {
  if (!profile) return false;
  if (profile.subscription?.status === "active") return true;
  if (imageHash) {
    const status = getImageUnlockStatus(profile, imageHash);
    if (status.isUnlocked) return true;
  }
  return false;
}

/**
 * Unlocks an image with 1 credit using a Cryptographic Server Handshake.
 * Protects against client-side exploitation by having the server verify App Check,
 * validate user authorization, deduct credit in Firestore, and sign a cryptographic ticket.
 * Grants the user the right to do a fixed number of generations on the same image (identified by hash).
 */
export async function unlockImageWithCredit(
  userId: string,
  imageHash: string,
): Promise<boolean> {
  const profile = await getUserProfile(userId);
  const status = getImageUnlockStatus(profile, imageHash);

  // If already unlocked and has remaining generations, keep it
  if (status.isUnlocked && status.generationsRemaining > 0) {
    return true;
  }

  // Perform Cryptographic Server Handshake
  const handshake = await requestServerHandshake({
    action: "unlock_image",
    imageHash,
  });

  if (handshake.success && handshake.ticket) {
    // Re-sync local profile state
    if (typeof handshake.creditsRemaining === "number") {
      profile.credits = handshake.creditsRemaining;
    }
    profile.unlockedImages = {
      ...(profile.unlockedImages || {}),
      [imageHash]: {
        imageHash,
        generationsUsed: handshake.ticket.generationsUsed,
        maxGenerations: handshake.ticket.maxGenerations,
        unlockedAt: handshake.ticket.issuedAt,
      },
    };
    profile.updatedAt = Date.now();
    safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
    return true;
  }

  console.warn("[Handshake] Server handshake rejected:", handshake.error);
  return false;
}

/**
 * Consumes 1 generation from the unlocked quota for the given image hash
 * via Cryptographic Server Handshake to prevent client-side counter manipulation.
 */
export async function consumeImageGeneration(
  userId: string,
  imageHash: string,
  generationId?: string,
): Promise<number | null> {
  const profile = await getUserProfile(userId);
  if (profile.subscription?.status === "active") {
    return 9999;
  }

  // Request server to consume 1 generation from quota and re-sign ticket.
  // Fails closed: returns null when the server cannot confirm consumption,
  // so callers must not record the generation as validated.
  // generationId (SVG content hash) lets the server record an account-scoped
  // validated marker so re-exports of the same SVG stay free.
  const handshake = await requestServerHandshake({
    action: "consume_generation",
    imageHash,
    generationId,
  });

  if (handshake.success && handshake.ticket) {
    const remaining = handshake.ticket.generationsRemaining;
    if (profile.unlockedImages?.[imageHash]) {
      profile.unlockedImages[imageHash].generationsUsed =
        handshake.ticket.generationsUsed;
      profile.updatedAt = Date.now();
      safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
    }
    return remaining;
  }

  console.warn("[Handshake] Generation consume rejected:", handshake.error);
  return null;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const userRef = doc(db, "users", userId);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    const data = docSnap.data();
    return {
      uid: userId,
      email: data.email || null,
      displayName: data.displayName || null,
      walletAddress: data.walletAddress || null,
      credits: typeof data.credits === "number" ? data.credits : 0,
      isAdmin: Boolean(data.isAdmin),
      subscription: data.subscription || { status: "inactive" },
      isPro: Boolean(data.isPro),
      unlockedImages: data.unlockedImages || {},
      updatedAt: data.updatedAt?.toMillis
        ? data.updatedAt.toMillis()
        : Date.now(),
    };
  }

  const defaultProfile: UserProfile = {
    uid: userId,
    credits: 0,
    isAdmin: false,
    subscription: { status: "inactive" },
    isPro: false,
    unlockedImages: {},
    updatedAt: Date.now(),
  };
  return defaultProfile;
}

export async function linkWalletToUser(
  userId: string,
  walletAddress: string,
): Promise<void> {
  const userRef = doc(db, "users", userId);
  await setDoc(
    userRef,
    { walletAddress, updatedAt: serverTimestamp() },
    { merge: true },
  );

  try {
    const existingRaw = safeGetStorage(LOCAL_STORAGE_PROFILE_KEY);
    const profile: UserProfile = existingRaw
      ? JSON.parse(existingRaw)
      : {
        uid: userId,
        credits: 0,
        isAdmin: false,
        subscription: { status: "inactive" },
        isPro: false,
        updatedAt: Date.now(),
      };
    profile.walletAddress = walletAddress;
    profile.updatedAt = Date.now();
    safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Error linking wallet locally:", err);
  }
}

let fingerprintAgentPromise: ReturnType<typeof FingerprintJS.load> | null = null;

/**
 * Returns the FingerprintJS visitorId for this browser, or null when it
 * cannot be computed (privacy settings, blockers, unsupported browser).
 * The agent is loaded lazily and cached for the session.
 */
async function getFingerprintId(): Promise<string | null> {
  try {
    fingerprintAgentPromise ??= FingerprintJS.load();
    const agent = await fingerprintAgentPromise;
    const result = await agent.get();
    return result.visitorId || null;
  } catch (err) {
    console.warn("[WelcomeCredits] Fingerprint unavailable:", err);
    return null;
  }
}

/**
 * Claims the one-time welcome credit bonus for a new account.
 * The backend grant is idempotent and fingerprint-gated, so this is safe
 * to call on every login. Returns true when credits were actually granted.
 */
export async function claimWelcomeCredits(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  try {
    let idToken: string;
    try {
      idToken = await currentUser.getIdToken();
    } catch {
      return false;
    }

    const fingerprintId = await getFingerprintId();
    const appCheckToken = await getAppCheckToken();
    const res = await fetch(APP_CONFIG.api.claimWelcomeCreditsUrl, {
      method: "POST",
      headers: buildApiHeaders({ appCheckToken, idToken }),
      body: JSON.stringify({ fingerprintId }),
    });

    if (res.status === 401) {
      await handleAuthExpired();
      return false;
    }
    if (!res.ok) return false;

    const data = (await res.json().catch(() => ({}))) as { granted?: boolean };
    return Boolean(data.granted);
  } catch (err) {
    console.warn("[WelcomeCredits] Claim failed:", err);
    return false;
  }
}
