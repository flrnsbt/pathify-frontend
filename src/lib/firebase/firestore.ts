import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  Unsubscribe,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth, getAppCheckToken } from "./config";
import { handleAuthExpired } from "./auth-context";
import { VTracerOptions } from "../vtracer/types";
import { compressSvgString, decompressSvgString } from "../vtracer/compression";
import { SupportedChainKey, SupportedToken } from "../web3/payment-wallets";
import {
  requestServerHandshake,
  hasValidSessionTicket,
  getSessionTicket,
} from "../security/handshake";
import { APP_CONFIG } from "@/config/app.config";
import { buildApiHeaders } from "../api-headers";

export interface VectorizationHistoryItem {
  id: string;
  userId: string;
  fileName: string;
  originalDimensions: { width: number; height: number };
  originalSize?: number;
  originalBase64?: string; // Compressed base64 data URL of the original file
  imageHash?: string; // Stable SHA-256 hash identifying the image
  nodeCount: number;
  executionTimeMs: number;
  parameters: VTracerOptions;
  svg: string; // In-memory decompressed SVG string
  svgSize: number;
  createdAt: number; // unix timestamp ms
}

export interface SubscriptionInfo {
  status: "inactive" | "active" | "canceled";
  plan?: "monthly" | "yearly";
  validUntil?: number;
}

export interface UnlockedImageInfo {
  imageHash: string;
  generationsUsed: number;
  maxGenerations: number;
  unlockedAt: number;
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  walletAddress?: string | null;
  credits: number;
  isAdmin: boolean;
  subscription: SubscriptionInfo;
  isPro: boolean;
  unlockedSvgIds: string[];
  unlockedImages?: Record<string, UnlockedImageInfo>;
  updatedAt: number;
}

export type TransactionStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "cancelled";
export type PaymentMethod = "web3" | "direct";

export interface CryptoTransaction {
  id: string;
  userId: string;
  packId: string;
  credits: number;
  usdPrice: number;
  cryptoAmount: string;
  cryptoToken: SupportedToken;
  chainKey: SupportedChainKey;
  chainId?: number;
  paymentMethod: PaymentMethod;
  fromAddress?: string;
  toAddress: string;
  txHash?: string;
  status: TransactionStatus;
  statusMessage?: string;
  createdAt: number;
  updatedAt: number;
  confirmedAt?: number;
}

const LOCAL_STORAGE_HISTORY_KEY = "vtracer_local_history";
const LOCAL_STORAGE_PROFILE_KEY = "vtracer_local_profile";
const LOCAL_STORAGE_TRANSACTIONS_KEY = "vtracer_local_transactions";

function safeGetStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, val: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, val);
  } catch { }
}

/**
 * Checks the unlock status and generation quota of an image by its hash.
 * Unlocking an image with 1 credit grants 10 generations.
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
      maxGenerations: 10,
    };
  }

  // Admins (if enabled) and active subscribers have unlimited generations
  if (profile.isAdmin || profile.subscription?.status === "active") {
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
      maxGenerations: 10,
    };
  }

  const maxGen = info.maxGenerations || 10;
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
  svgId?: string,
  imageHash?: string,
): boolean {
  if (!profile) return false;
  if (profile.isAdmin) return true;
  if (profile.subscription?.status === "active") return true;
  if (imageHash) {
    const status = getImageUnlockStatus(profile, imageHash);
    if (status.isUnlocked) return true;
  }
  if (svgId && profile.unlockedSvgIds?.includes(svgId)) return true;
  return false;
}

/**
 * Unlocks an image with 1 credit using a Cryptographic Server Handshake.
 * Protects against client-side exploitation by having the server verify App Check,
 * validate user authorization, deduct credit in Firestore, and sign a cryptographic ticket.
 * Grants the user the right to do 10 generations on the same image (identified by hash).
 */
export async function unlockImageWithCredit(
  userId: string,
  imageHash: string,
  currentSvgId?: string,
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
    if (currentSvgId) {
      profile.unlockedSvgIds = Array.from(
        new Set([...(profile.unlockedSvgIds || []), currentSvgId]),
      );
    }
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
): Promise<number> {
  const profile = await getUserProfile(userId);
  if (profile.isAdmin || profile.subscription?.status === "active") {
    return 9999;
  }

  // Request server to consume 1 generation from quota and re-sign ticket
  const handshake = await requestServerHandshake({
    action: "consume_generation",
    imageHash,
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

  // Fallback to local profile count if offline
  const currentInfo = profile.unlockedImages?.[imageHash];
  if (!currentInfo) {
    return 0;
  }

  const newUsed = (currentInfo.generationsUsed || 0) + 1;
  const maxGen = currentInfo.maxGenerations || 10;
  return Math.max(0, maxGen - newUsed);
}

/**
 * Backward compatibility wrapper for unlockSvgWithCredit.
 */
export async function unlockSvgWithCredit(
  userId: string,
  svgId: string,
  imageHash?: string,
): Promise<boolean> {
  if (imageHash) {
    return unlockImageWithCredit(userId, imageHash, svgId);
  }

  const profile = await getUserProfile(userId);
  if (canAccessSvg(profile, svgId)) {
    return true;
  }
  if (profile.credits <= 0) {
    return false;
  }

  const newCredits = profile.credits - 1;
  const newUnlocked = Array.from(
    new Set([...(profile.unlockedSvgIds || []), svgId]),
  );


  const userRef = doc(db, "users", userId);
  await setDoc(
    userRef,
    {
      credits: newCredits,
      unlockedSvgIds: newUnlocked,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );


  profile.credits = newCredits;
  profile.unlockedSvgIds = newUnlocked;
  profile.updatedAt = Date.now();
  safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  return true;
}

/**
 * Saves a vectorization history item via the backend server endpoint (service account auth).
 * Compresses the SVG data using gzip before storing.
 * Client-side Firestore direct writes are removed for security.
 * Only paid generations should be passed to this function.
 */
export async function saveVectorizationHistory(
  userId: string,
  data: Omit<VectorizationHistoryItem, "id" | "userId" | "createdAt">,
): Promise<string> {
  // Gzip-compress SVG for compact storage
  const compressedSvg = await compressSvgString(data.svg);

  // Exclude userId from the API body — the backend extracts it from the Firebase ID token
  const itemToStore = {
    ...data,
    svg: compressedSvg,
    createdAt: Date.now(),
  };

  let savedId = `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const endpoint = APP_CONFIG.api.saveHistoryUrl || "/api/save-history";
  try {
    let idToken: string | undefined;
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        idToken = await currentUser.getIdToken();
      } catch (tokenErr) {
        console.warn("[History] Token retrieval failed:", tokenErr);
        await handleAuthExpired();
      }
    }

    const appCheckToken = await getAppCheckToken();
    const headers = buildApiHeaders({ appCheckToken, idToken });

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(itemToStore),
    });

    if (res.status === 401) {
      const errData = (await res
        .clone()
        .json()
        .catch(() => ({}))) as any;
      if (errData.error && /expired|invalid.*token/i.test(errData.error)) {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            await currentUser.getIdToken(true);
            console.warn(
              "[History] Session confirmed active with Google. Skipping disconnect.",
            );
          } else {
            await handleAuthExpired();
          }
        } catch {
          await handleAuthExpired();
        }
      }
    }

    if (res.ok) {
      const resJson = (await res.json().catch(() => ({}))) as any;
      if (resJson.historyId) {
        savedId = resJson.historyId;
      }
    } else {
      console.warn("Backend history saving returned error status:", res.status);
    }
    // Backend history saving returned an error; no local fallback
  } catch (err) {
    console.warn("Failed to write history to backend:", err);
  }

  return savedId;
}

/**
 * Fetches user history and automatically decompresses stored gzip SVGs.
 */
export async function fetchUserHistory(
  userId: string,
): Promise<VectorizationHistoryItem[]> {
  const historyCollection = collection(db, "users", userId, "history");
  const q = query(
    historyCollection,
    orderBy("createdAt", "desc"),
    limit(50),
  );
  const snapshot = await getDocs(q);
  const items: VectorizationHistoryItem[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const decompressedSvg = await decompressSvgString(data.svg || "");
    items.push({
      id: docSnap.id,
      userId,
      fileName: data.fileName || "traced-vector.svg",
      originalDimensions: data.originalDimensions || {
        width: 0,
        height: 0,
      },
      originalSize: data.originalSize || 0,
      originalBase64: data.originalBase64,
      imageHash: data.imageHash,
      nodeCount: data.nodeCount || 0,
      executionTimeMs: data.executionTimeMs || 0,
      parameters: data.parameters || {},
      svg: decompressedSvg,
      svgSize: data.svgSize || decompressedSvg.length,
      createdAt: data.createdAt || Date.now(),
    });
  }
  return items;




}

export async function deleteHistoryItem(
  userId: string,
  itemId: string,
): Promise<void> {

  const docRef = doc(db, "users", userId, "history", itemId);
  await deleteDoc(docRef);



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
        unlockedSvgIds: [],
        updatedAt: Date.now(),
      };
    profile.walletAddress = walletAddress;
    profile.updatedAt = Date.now();
    safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error("Error linking wallet locally:", err);
  }
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
      unlockedSvgIds: Array.isArray(data.unlockedSvgIds)
        ? data.unlockedSvgIds
        : [],
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
    unlockedSvgIds: [],
    unlockedImages: {},
    updatedAt: Date.now(),
  };
  return defaultProfile;
}

/**
 * Creates a new crypto transaction record via the backend server endpoint (service account auth).
 * Client-side Firestore direct writes are removed for security.
 * Falls back to localStorage if offline/guest mode.
 */
export async function createCryptoTransaction(
  data: Omit<CryptoTransaction, "id" | "createdAt" | "updatedAt" | "status" | "userId"> & {
    status?: TransactionStatus;
  },
): Promise<string> {
  const now = Date.now();
  const status: TransactionStatus = data.status || "pending";

  // userId is excluded from the API body — the backend extracts it from the Firebase ID token
  const txData = {
    ...data,
    status,
    createdAt: now,
    updatedAt: now,
  };

  let createdId = `tx-${now}-${Math.random().toString(36).slice(2, 7)}`;
  let backendSuccess = false;

  // 1. Post to backend server endpoint (service account writes to transactions collection)
  const endpoint =
    APP_CONFIG.api.createTransactionUrl ;
  try {
    let idToken: string | undefined;
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        idToken = await currentUser.getIdToken();
      } catch (tokenErr) {
        console.warn("[Transaction] Token retrieval failed:", tokenErr);
        await handleAuthExpired();
      }
    }

    const appCheckToken = await getAppCheckToken();
    const headers = buildApiHeaders({ appCheckToken, idToken });
    console.info('[Transaction] Creating transaction via backend:', { endpoint, hasIdToken: !!idToken, hasAppCheck: !!appCheckToken, txData });

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(txData),
    });

    console.info('[Transaction] Backend response:', res.status, res.statusText);

    if (res.status === 401) {
      const errData = (await res
        .clone()
        .json()
        .catch(() => ({}))) as any;
      if (errData.error && /expired|invalid.*token/i.test(errData.error)) {
        try {
          const currentUser = auth.currentUser;
          if (currentUser) {
            await currentUser.getIdToken(true);
            console.warn(
              "[History] Session confirmed active with Google. Skipping disconnect.",
            );
          } else {
            await handleAuthExpired();
          }
        } catch {
          await handleAuthExpired();
        }
      }
    }

    if (res.ok) {
      const resJson = (await res.json().catch(() => ({}))) as any;
      if (resJson.transactionId) {
        createdId = resJson.transactionId;
        backendSuccess = true;
      }
      console.info('[Transaction] Backend confirmed transaction:', createdId);
    } else {
      const errorBody = await res.text().catch(() => '');
      console.error('[Transaction] Backend returned error:', res.status, errorBody);
      throw new Error(`Failed to create transaction: backend returned ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Re-throw if the error is not already about backend failure (avoid double-wrapping)
    if (!msg.startsWith('Failed to create transaction:')) {
      console.error('[Transaction] Failed to save transaction to backend:', err);
      throw new Error(`Failed to create transaction: ${msg}`);
    }
    throw err;
  }

  // 3. Trigger backend lazy scheduler for transaction verification
  if (backendSuccess) {
    const currentUser = auth.currentUser;
    if (currentUser && !currentUser.isAnonymous) {
      refreshUserCredits(currentUser.uid).catch(() => { });
    }
  }

  return createdId;
}

/**
 * Fetches all transactions for a specific user from Firestore or localStorage.
 */
export async function fetchUserTransactions(
  userId: string,
): Promise<CryptoTransaction[]> {

  const txCollection = collection(db, "transactions");
  const q = query(txCollection, where("userId", "==", userId), limit(100));
  const snapshot = await getDocs(q);
  const items: CryptoTransaction[] = [];
  snapshot.forEach((docSnap) => {
    const d = docSnap.data();
    items.push({
      id: docSnap.id,
      userId: d.userId,
      packId: d.packId,
      credits: d.credits || 0,
      usdPrice: d.usdPrice || 0,
      cryptoAmount: d.cryptoAmount || "0",
      cryptoToken: d.cryptoToken,
      chainKey: d.chainKey,
      chainId: d.chainId,
      paymentMethod: d.paymentMethod || "web3",
      fromAddress: d.fromAddress,
      toAddress: d.toAddress,
      txHash: d.txHash,
      status: d.status || "pending",
      statusMessage: d.statusMessage,
      createdAt: d.createdAt || Date.now(),
      updatedAt: d.updatedAt || Date.now(),
      confirmedAt: d.confirmedAt,
    });
  });
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return items;
}

/**
 * Subscribes to real-time updates for a user's transactions.
 */
export function listenToUserTransactions(
  userId: string,
  onUpdate: (transactions: CryptoTransaction[]) => void,
): Unsubscribe {

  const txCollection = collection(db, "transactions");
  const q = query(txCollection, where("userId", "==", userId), limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: CryptoTransaction[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: d.userId,
          packId: d.packId,
          credits: d.credits || 0,
          usdPrice: d.usdPrice || 0,
          cryptoAmount: d.cryptoAmount || "0",
          cryptoToken: d.cryptoToken,
          chainKey: d.chainKey,
          chainId: d.chainId,
          paymentMethod: d.paymentMethod || "web3",
          fromAddress: d.fromAddress,
          toAddress: d.toAddress,
          txHash: d.txHash,
          status: d.status || "pending",
          statusMessage: d.statusMessage,
          createdAt: d.createdAt || Date.now(),
          updatedAt: d.updatedAt || Date.now(),
          confirmedAt: d.confirmedAt,
        });
      });
      items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onUpdate(items);
    },
    (err) => {
      console.warn("Firestore transactions snapshot error:", err);
      try {
        const raw = safeGetStorage(LOCAL_STORAGE_TRANSACTIONS_KEY);
        if (raw) {
          const localItems: CryptoTransaction[] = JSON.parse(raw);
          onUpdate(
            localItems.filter(
              (t) => t.userId === userId || !userId || userId === "guest",
            ),
          );
        } else {
          onUpdate([]);
        }
      } catch {
        onUpdate([]);
      }
    },
  );

}

/**
 * Subscribes to real-time updates for a single transaction.
 */
export function listenToTransaction(
  transactionId: string,
  onUpdate: (tx: CryptoTransaction | null) => void,
): Unsubscribe {

  const txDocRef = doc(db, "transactions", transactionId);
  return onSnapshot(
    txDocRef,
    (docSnap) => {
      if (!docSnap.exists()) {
        onUpdate(null);
        return;
      }
      const d = docSnap.data();
      onUpdate({
        id: docSnap.id,
        userId: d.userId,
        packId: d.packId,
        credits: d.credits || 0,
        usdPrice: d.usdPrice || 0,
        cryptoAmount: d.cryptoAmount || "0",
        cryptoToken: d.cryptoToken,
        chainKey: d.chainKey,
        chainId: d.chainId,
        paymentMethod: d.paymentMethod || "web3",
        fromAddress: d.fromAddress,
        toAddress: d.toAddress,
        txHash: d.txHash,
        status: d.status || "pending",
        statusMessage: d.statusMessage,
        createdAt: d.createdAt || Date.now(),
        updatedAt: d.updatedAt || Date.now(),
        confirmedAt: d.confirmedAt,
      });
    },
    (err) => {
      console.warn("Error listening to single transaction:", err);
    },
  );


}

/**
 * Updates the status of an existing transaction.
 */
export async function updateTransactionStatus(
  transactionId: string,
  status: TransactionStatus,
  options?: {
    txHash?: string;
    statusMessage?: string;
    confirmedAt?: number;
  },
): Promise<void> {
  const now = Date.now();
  const txDocRef = doc(db, "transactions", transactionId);
  await updateDoc(txDocRef, {
    status,
    ...(options?.txHash ? { txHash: options.txHash } : {}),
    ...(options?.statusMessage
      ? { statusMessage: options.statusMessage }
      : {}),
    ...(options?.confirmedAt ? { confirmedAt: options.confirmedAt } : {}),
    updatedAt: now,
    serverUpdatedAt: serverTimestamp(),
  });


}

export interface RefreshCreditsResult {
  updatedCredits: number;
  profile: UserProfile;
  pendingTransactions: CryptoTransaction[];
  confirmedTransactions: CryptoTransaction[];
  cloudFunctionNotified: boolean;
}

/**
 * Checks pending transactions and refreshes the user's credits.
 * If a Cloud Function URL is configured (NEXT_PUBLIC_REFRESH_CREDITS_FUNCTION_URL),
 * it triggers the function to verify blockchain receipts and finalize pending transactions.
 */
export async function refreshUserCredits(
  userId: string,
): Promise<RefreshCreditsResult> {
  const transactions = await fetchUserTransactions(userId);
  const pending = transactions.filter((t) => t.status === "pending");
  const confirmed = transactions.filter((t) => t.status === "confirmed");

  let cloudFunctionNotified = false;

  // Server endpoint trigger (proxied server-side so no secret is exposed to client)
  const functionUrl =
    APP_CONFIG.api.refreshCreditsUrl || "/api/refresh-credits";

  if (functionUrl && pending.length > 0) {
    try {
      let idToken: string | undefined;
      // 1. Authenticate with Firebase Auth ID token if signed in
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          idToken = await currentUser.getIdToken();
        } catch (tokenErr) {
          console.warn(
            "[Firestore] Failed to obtain valid ID token, session expired:",
            tokenErr,
          );
          await handleAuthExpired();
        }
      }

      // 2. Attach App Check token
      const appCheckToken = await getAppCheckToken();
      const headers = buildApiHeaders({ appCheckToken, idToken });

      const res = await fetch(functionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          pendingTransactions: pending.map((t) => ({
            id: t.id,
            chainKey: t.chainKey,
            txHash: t.txHash,
            cryptoAmount: t.cryptoAmount,
            cryptoToken: t.cryptoToken,
            credits: t.credits,
          })),
        }),
      });

      if (res.status === 401) {
        const errorData = (await res
          .clone()
          .json()
          .catch(() => ({}))) as any;
        if (
          errorData.error &&
          /expired|invalid.*token/i.test(errorData.error)
        ) {
          try {
            const currentUser = auth.currentUser;
            if (currentUser) {
              await currentUser.getIdToken(true);
              console.warn(
                "[Firestore] Google confirmed session is active. Skipping disconnect.",
              );
            } else {
              await handleAuthExpired();
            }
          } catch (authErr) {
            console.warn(
              "[Firestore] Google confirmed session is revoked, signing out:",
              authErr,
            );
            await handleAuthExpired();
          }
        }
      } else if (res.ok) {
        cloudFunctionNotified = true;
      }
    } catch (err) {
      console.warn("Cloud Function refresh invocation error:", err);
    }
  }

  // Fetch updated user profile from Firestore (which reflects the latest credits balance)
  const profile = await getUserProfile(userId);

  return {
    updatedCredits: profile.credits,
    profile,
    pendingTransactions: pending,
    confirmedTransactions: confirmed,
    cloudFunctionNotified,
  };
}
