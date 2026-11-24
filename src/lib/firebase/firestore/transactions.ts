import {
  collection,
  doc,
  getDocs,
  query,
  where,
  limit,
  onSnapshot,
  Unsubscribe,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth, getAppCheckToken } from "../config";
import { handleAuthExpired } from "../auth-context";
import { APP_CONFIG } from "@/config/app.config";
import { buildApiHeaders } from "../../api-headers";
import {
  CryptoTransaction,
  CreatedTransaction,
  RefreshCreditsResult,
  TransactionStatus,
} from "./types";
import {
  LOCAL_STORAGE_TRANSACTIONS_KEY,
  safeGetStorage,
  readApiJson,
  handleUnauthorizedResponse,
} from "./utils";
import { getUserProfile } from "./profiles";

/**
 * Creates a new crypto transaction record via the backend server endpoint (service account auth).
 * Client-side Firestore direct writes are removed for security.
 * Falls back to localStorage if offline/guest mode.
 */
export async function createCryptoTransaction(
  data: Omit<CryptoTransaction, "id" | "createdAt" | "updatedAt" | "status" | "userId"> & {
    status?: TransactionStatus;
  },
): Promise<CreatedTransaction> {
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
  let serverAmount: string | undefined;
  let serverToAddress: string | undefined;
  let serverExpiresAt: number | undefined;

  // 1. Post to backend server endpoint (service account writes to transactions collection)
  const endpoint =
    APP_CONFIG.api.createTransactionUrl;
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
      if (typeof resJson.expectedAmount === "string") {
        serverAmount = resJson.expectedAmount;
      }
      if (typeof resJson.toAddress === "string") {
        serverToAddress = resJson.toAddress;
      }
      if (typeof resJson.expiresAt === "number") {
        serverExpiresAt = resJson.expiresAt;
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

  return {
    id: createdId,
    expectedAmount: serverAmount,
    toAddress: serverToAddress,
    expiresAt: serverExpiresAt,
  };
}

/**
 * Fetches all transactions for a specific user from Firestore or localStorage.
 */
export async function fetchUserTransactions(
  userId: string,
  limitCount: number = 100,
): Promise<CryptoTransaction[]> {
  const txCollection = collection(db, "transactions");
  const q = query(txCollection, where("userId", "==", userId), limit(limitCount));
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

/**
 * Checks pending transactions and refreshes the user's credits.
 * If a Cloud Function URL is configured (NEXT_PUBLIC_REFRESH_CREDITS_FUNCTION_URL),
 * it triggers the function to verify blockchain receipts and finalize pending transactions.
 */
export async function refreshUserCredits(
  userId: string,
  opts?: { pendingCount?: number },
): Promise<RefreshCreditsResult> {
  // When the caller already knows the pending count (e.g. from the live
  // onSnapshot listener), skip re-fetching transaction docs entirely — the
  // backend re-queries pending transactions itself. Otherwise fetch a
  // bounded recent window: pending txs are virtually always the newest, and
  // the DO scheduler verifies anything older regardless.
  const transactions =
    opts?.pendingCount !== undefined
      ? []
      : await fetchUserTransactions(userId, 30);
  const pending = transactions.filter((t) => t.status === "pending");
  const confirmed = transactions.filter((t) => t.status === "confirmed");
  const hasPending =
    opts?.pendingCount !== undefined ? opts.pendingCount > 0 : pending.length > 0;

  let cloudFunctionNotified = false;

  // Server endpoint trigger (proxied server-side so no secret is exposed to client)
  const functionUrl =
    APP_CONFIG.api.refreshCreditsUrl || "/api/refresh-credits";

  if (functionUrl && hasPending) {
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
