import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  onSnapshot,
  Unsubscribe,
  updateDoc,
  setDoc,
  getDoc,
  getCountFromServer,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import type { DocumentSnapshot, QueryConstraint, QueryDocumentSnapshot } from "firebase/firestore";
import { db, auth, getAppCheckToken } from "./config";
import { handleAuthExpired } from "./auth-context";
import { VTracerOptions } from "../vtracer/types";
import { compressSvgString, decompressSvgString, decompressSvgBytes } from "../vtracer/compression";
import { SupportedChainKey, SupportedToken } from "../web3/payment-wallets";
import { getGenerationsPerUnlock } from "../app-config";
import {
  requestServerHandshake,
  hasValidSessionTicket,
  getSessionTicket,
} from "../security/handshake";
import { APP_CONFIG } from "@/config/app.config";
import { buildApiHeaders } from "../api-headers";

/**
 * A history entry groups all generations produced from the same source image.
 * Stored at users/{uid}/history/{imageHash}; the raw source image is not stored
 * in Firestore — it lives in browser-local storage keyed by imageHash.
 */
export interface HistoryEntry {
  id: string; // == imageHash when available
  userId: string;
  imageHash: string;
  fileName: string;
  originalDimensions: { width: number; height: number };
  originalSize?: number;
  createdAt: number; // first generation for this image
  updatedAt: number; // most recent generation
  /** True for synthetic entries backed only by the browser-local fallback store. */
  localOnly?: boolean;
}

/** A single validated generation, stored in the entry's `generations` subcollection. */
export interface HistoryGeneration {
  id: string; // == generationId (SVG content hash) when available
  generationId?: string;
  userId: string;
  imageHash?: string;
  fileName: string;
  originalDimensions: { width: number; height: number };
  originalSize?: number;
  nodeCount: number;
  executionTimeMs: number;
  parameters: VTracerOptions;
  svg: string; // In-memory decompressed SVG string
  svgSize: number;
  createdAt: number; // unix timestamp ms
  /** True when stored only in the browser-local fallback (oversized SVGs). */
  localOnly?: boolean;
}

export const HISTORY_PAGE_SIZE = 5;

export interface HistoryPage<T> {
  items: T[];
  /** Pass back as `cursor` to fetch the next page; null when exhausted. */
  lastCursor: DocumentSnapshot | null;
  hasMore: boolean;
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

/** Parses a JSON response body, tolerating empty/non-JSON payloads. */
async function readApiJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json().catch(() => ({}))) as Record<string, unknown>;
}

/**
 * Handles a 401 from a backend call: refreshes the ID token when the server
 * reports an expired/invalid token, otherwise expires the session.
 */
async function handleUnauthorizedResponse(res: Response): Promise<void> {
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

export interface SaveHistoryResult {
  savedId: string;
  /** False when the generation could not be written to Firestore. */
  cloudSaved: boolean;
  /** True when the compressed SVG exceeds the Firestore field limit. */
  tooLarge: boolean;
}

// Keep in sync with MAX_SVG_STORAGE_BYTES in backend/src/services/firestore.ts.
// The 'gz:' payload is base64, so raw gzip bytes ≈ length * 3/4.
const MAX_REMOTE_SVG_GZIP_BYTES = 1_000_000;

/**
 * Saves a vectorization history item via the backend server endpoint (service account auth).
 * Compresses the SVG data using gzip before storing.
 * Client-side Firestore direct writes are removed for security.
 * Only paid generations should be passed to this function.
 *
 * Returns cloudSaved=false (with tooLarge set when applicable) when the
 * backend rejects the write — callers should fall back to local storage.
 */
export async function saveVectorizationHistory(
  userId: string,
  data: Omit<HistoryGeneration, "id" | "userId" | "createdAt">,
): Promise<SaveHistoryResult> {
  // Gzip-compress SVG for compact storage
  const compressedSvg = await compressSvgString(data.svg);

  const savedId = `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // Oversized payloads can never fit the Firestore field limit — skip the
  // upload entirely and let the caller store the generation locally.
  const estGzipBytes = Math.floor(((compressedSvg?.length ?? 0) - 3) * 0.75);
  if (compressedSvg?.startsWith("gz:") && estGzipBytes > MAX_REMOTE_SVG_GZIP_BYTES) {
    return { savedId, cloudSaved: false, tooLarge: true };
  }

  // Exclude userId from the API body — the backend extracts it from the Firebase ID token
  const itemToStore = {
    ...data,
    svg: compressedSvg,
    createdAt: Date.now(),
  };

  let result: SaveHistoryResult = { savedId, cloudSaved: false, tooLarge: false };

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
      await handleUnauthorizedResponse(res);
    }

    if (res.ok) {
      const resJson = await readApiJson(res);
      result = {
        savedId:
          typeof resJson.generationId === "string"
            ? resJson.generationId
            : savedId,
        cloudSaved: true,
        tooLarge: false,
      };
    } else {
      result.tooLarge = res.status === 413;
      console.warn(
        "Backend history saving returned error status:",
        res.status,
        result.tooLarge ? "(SVG too large for Firestore)" : "",
      );
    }
  } catch (err) {
    console.warn("Failed to write history to backend:", err);
  }

  return result;
}

function mapHistoryEntry(docSnap: QueryDocumentSnapshot, userId: string): HistoryEntry {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    userId,
    imageHash: data.imageHash || docSnap.id,
    fileName: data.fileName || "traced-vector.svg",
    originalDimensions: data.originalDimensions || { width: 0, height: 0 },
    originalSize: data.originalSize || 0,
    createdAt: data.createdAt || Date.now(),
    updatedAt: data.updatedAt || data.createdAt || Date.now(),
  };
}

async function mapHistoryGeneration(
  docSnap: QueryDocumentSnapshot,
  userId: string,
): Promise<HistoryGeneration> {
  const data = docSnap.data();
  // svg is stored as Firestore bytesValue (raw gzip). The client SDK surfaces
  // it as a `Bytes` object (not a Uint8Array) — unwrap via toUint8Array().
  // Tolerate Uint8Array/ArrayBuffer and the legacy 'gz:' string format too.
  const rawSvg = data.svg as unknown;
  let svgBytes: Uint8Array | null = null;
  if (rawSvg instanceof Uint8Array) {
    svgBytes = rawSvg;
  } else if (rawSvg instanceof ArrayBuffer) {
    svgBytes = new Uint8Array(rawSvg);
  } else if (rawSvg && typeof (rawSvg as { toUint8Array?: unknown }).toUint8Array === 'function') {
    svgBytes = (rawSvg as { toUint8Array: () => Uint8Array }).toUint8Array();
  }
  const decompressedSvg =
    typeof rawSvg === "string"
      ? await decompressSvgString(rawSvg)
      : svgBytes
        ? await decompressSvgBytes(svgBytes)
        : "";
  return {
    id: docSnap.id,
    generationId: data.generationId || docSnap.id,
    userId,
    imageHash: data.imageHash,
    fileName: data.fileName || "traced-vector.svg",
    originalDimensions: data.originalDimensions || { width: 0, height: 0 },
    originalSize: data.originalSize || 0,
    nodeCount: data.nodeCount || 0,
    executionTimeMs: data.executionTimeMs || 0,
    parameters: data.parameters || {},
    svg: decompressedSvg,
    svgSize: data.svgSize || decompressedSvg.length,
    createdAt: data.createdAt || Date.now(),
  };
}

/**
 * Fetches one page of history entries (one per source image), newest activity
 * first. Pass `page.lastCursor` back as `cursor` for the next page.
 */
export async function fetchHistoryEntries(
  userId: string,
  cursor?: DocumentSnapshot | null,
  pageSize: number = HISTORY_PAGE_SIZE,
): Promise<HistoryPage<HistoryEntry>> {
  const historyCollection = collection(db, "users", userId, "history");
  const constraints: QueryConstraint[] = [
    orderBy("updatedAt", "desc"),
    orderBy("createdAt", "desc"),
  ];
  if (cursor) constraints.push(startAfter(cursor));
  constraints.push(limit(pageSize + 1));
  const q = query(historyCollection, ...constraints);
  const snapshot = await getDocs(q);

  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = snapshot.docs.slice(0, pageSize);
  return {
    items: pageDocs.map((d) => mapHistoryEntry(d, userId)),
    lastCursor: hasMore ? (pageDocs[pageDocs.length - 1] ?? null) : null,
    hasMore,
  };
}

/** Total number of history entries (source images) for the badge counter. */
export async function fetchHistoryCount(userId: string): Promise<number> {
  const historyCollection = collection(db, "users", userId, "history");
  const snap = await getCountFromServer(query(historyCollection));
  return snap.data().count;
}

/**
 * Fetches all generations for a history entry (its source image), newest first.
 * SVGs are gzip-compressed in Firestore and decompressed here.
 */
export async function fetchHistoryGenerations(
  userId: string,
  entryId: string,
  pageSize: number = 100,
): Promise<HistoryGeneration[]> {
  const gensCollection = collection(
    db,
    "users",
    userId,
    "history",
    entryId,
    "generations",
  );
  const q = query(gensCollection, orderBy("createdAt", "desc"), limit(pageSize));
  const snapshot = await getDocs(q);
  return Promise.all(
    snapshot.docs.map((d) => mapHistoryGeneration(d, userId)),
  );
}

/**
 * Checks whether a generation (by SVG content hash) already exists under the
 * history entry for the given source image — used for paid-generation dedupe.
 */
export async function historyGenerationExists(
  userId: string,
  imageHash: string,
  generationId: string,
): Promise<boolean> {
  const genRef = doc(
    db,
    "users",
    userId,
    "history",
    imageHash,
    "generations",
    generationId,
  );
  const snap = await getDoc(genRef);
  return snap.exists();
}

/**
 * Checks the account-scoped validated-generation marker
 * (users/{uid}/validatedGenerations/{svgHash}). Written server-side when
 * quota is consumed, so it survives history deletion and is independent of
 * which source image produced the SVG.
 */
export async function validatedGenerationExists(
  userId: string,
  generationId: string,
): Promise<boolean> {
  if (!userId || !generationId) return false;
  const ref = doc(db, "users", userId, "validatedGenerations", generationId);
  const snap = await getDoc(ref);
  return snap.exists();
}

/** Deletes a single generation from a history entry. */
export async function deleteHistoryGeneration(
  userId: string,
  entryId: string,
  generationId: string,
): Promise<void> {
  const genRef = doc(
    db,
    "users",
    userId,
    "history",
    entryId,
    "generations",
    generationId,
  );
  await deleteDoc(genRef);
}

/** Deletes a history entry and every generation under it. */
export async function deleteHistoryEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  const gensCollection = collection(
    db,
    "users",
    userId,
    "history",
    entryId,
    "generations",
  );

  // Page through generations (Firestore batches cap at 500 writes)
  let lastDoc: DocumentSnapshot | undefined;
  for (;;) {
    let q = query(gensCollection, orderBy("createdAt", "desc"), limit(400));
    if (lastDoc) q = query(gensCollection, orderBy("createdAt", "desc"), startAfter(lastDoc), limit(400));
    const snap = await getDocs(q);
    if (snap.empty) break;
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const d of snap.docs.slice(i, i + 400)) batch.delete(d.ref);
      await batch.commit();
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 400) break;
  }

  await deleteDoc(doc(db, "users", userId, "history", entryId));
}

/** Deletes every history entry (and its generations) for the user. */
export async function deleteAllHistoryEntries(userId: string): Promise<void> {
  const historyCollection = collection(db, "users", userId, "history");
  let lastDoc: DocumentSnapshot | undefined;
  for (;;) {
    let q = query(historyCollection, orderBy("updatedAt", "desc"), limit(50));
    if (lastDoc) q = query(historyCollection, orderBy("updatedAt", "desc"), startAfter(lastDoc), limit(50));
    const snap = await getDocs(q);
    if (snap.empty) break;
    for (const d of snap.docs) {
      await deleteHistoryEntry(userId, d.id);
    }
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < 50) break;
  }
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
      await handleUnauthorizedResponse(res);
    }

    if (res.ok) {
      const resJson = await readApiJson(res);
      if (typeof resJson.transactionId === "string") {
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
        await handleUnauthorizedResponse(res);
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
