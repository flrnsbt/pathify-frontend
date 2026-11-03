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
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { VTracerOptions } from '../vtracer/types';
import { compressSvgString, decompressSvgString } from '../vtracer/compression';
import { SupportedChainKey, SupportedToken } from '../web3/payment-wallets';

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
  status: 'inactive' | 'active' | 'canceled';
  plan?: 'monthly' | 'yearly';
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

export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';
export type PaymentMethod = 'web3' | 'direct';

export interface CryptoTransaction {
  id: string;
  userId: string;
  userEmail?: string | null;
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

const LOCAL_STORAGE_HISTORY_KEY = 'vtracer_local_history';
const LOCAL_STORAGE_PROFILE_KEY = 'vtracer_local_profile';
const LOCAL_STORAGE_TRANSACTIONS_KEY = 'vtracer_local_transactions';

function safeGetStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, val: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, val);
  } catch {}
}

/**
 * Checks the unlock status and generation quota of an image by its hash.
 * Unlocking an image with 1 credit grants 10 generations.
 */
export function getImageUnlockStatus(
  profile: UserProfile | null,
  imageHash?: string
): {
  isUnlocked: boolean;
  generationsRemaining: number;
  generationsUsed: number;
  maxGenerations: number;
} {
  if (!profile || !imageHash) {
    return { isUnlocked: false, generationsRemaining: 0, generationsUsed: 0, maxGenerations: 10 };
  }

  // Admins and active subscribers have unlimited generations
  if (profile.isAdmin || profile.subscription?.status === 'active') {
    return { isUnlocked: true, generationsRemaining: 9999, generationsUsed: 0, maxGenerations: 9999 };
  }

  const info = profile.unlockedImages?.[imageHash];
  if (!info) {
    return { isUnlocked: false, generationsRemaining: 0, generationsUsed: 0, maxGenerations: 10 };
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

export function canAccessSvg(profile: UserProfile | null, svgId?: string, imageHash?: string): boolean {
  if (!profile) return false;
  if (profile.isAdmin) return true;
  if (profile.subscription?.status === 'active') return true;
  if (imageHash) {
    const status = getImageUnlockStatus(profile, imageHash);
    if (status.isUnlocked) return true;
  }
  if (svgId && profile.unlockedSvgIds?.includes(svgId)) return true;
  return false;
}

/**
 * Unlocks an image with 1 credit.
 * Grants the user the right to do 10 generations on the same image (identified by hash).
 */
export async function unlockImageWithCredit(
  userId: string,
  imageHash: string,
  currentSvgId?: string
): Promise<boolean> {
  const profile = await getUserProfile(userId);
  const status = getImageUnlockStatus(profile, imageHash);

  // If already unlocked and has remaining generations, keep it
  if (status.isUnlocked && status.generationsRemaining > 0) {
    return true;
  }

  // User needs at least 1 credit to unlock 10 generations
  if (profile.credits <= 0) {
    return false;
  }

  const newCredits = profile.credits - 1;
  const newUnlockedImages: Record<string, UnlockedImageInfo> = {
    ...(profile.unlockedImages || {}),
    [imageHash]: {
      imageHash,
      generationsUsed: 0,
      maxGenerations: 10,
      unlockedAt: Date.now(),
    },
  };

  const newUnlockedSvgIds = currentSvgId
    ? Array.from(new Set([...(profile.unlockedSvgIds || []), currentSvgId]))
    : profile.unlockedSvgIds || [];

  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          credits: newCredits,
          unlockedImages: newUnlockedImages,
          unlockedSvgIds: newUnlockedSvgIds,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to unlock image in Firestore:', err);
    }
  }

  profile.credits = newCredits;
  profile.unlockedImages = newUnlockedImages;
  profile.unlockedSvgIds = newUnlockedSvgIds;
  profile.updatedAt = Date.now();
  safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  return true;
}

/**
 * Consumes 1 generation from the unlocked quota for the given image hash.
 */
export async function consumeImageGeneration(
  userId: string,
  imageHash: string
): Promise<number> {
  const profile = await getUserProfile(userId);
  if (profile.isAdmin || profile.subscription?.status === 'active') {
    return 9999;
  }

  const currentInfo = profile.unlockedImages?.[imageHash];
  if (!currentInfo) {
    return 0;
  }

  const newUsed = (currentInfo.generationsUsed || 0) + 1;
  const maxGen = currentInfo.maxGenerations || 10;
  const remaining = Math.max(0, maxGen - newUsed);

  const updatedInfo: UnlockedImageInfo = {
    ...currentInfo,
    generationsUsed: newUsed,
  };

  const newUnlockedImages: Record<string, UnlockedImageInfo> = {
    ...(profile.unlockedImages || {}),
    [imageHash]: updatedInfo,
  };

  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          unlockedImages: newUnlockedImages,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to update generation quota in Firestore:', err);
    }
  }

  profile.unlockedImages = newUnlockedImages;
  profile.updatedAt = Date.now();
  safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  return remaining;
}

/**
 * Backward compatibility wrapper for unlockSvgWithCredit.
 */
export async function unlockSvgWithCredit(
  userId: string,
  svgId: string,
  imageHash?: string
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
  const newUnlocked = Array.from(new Set([...(profile.unlockedSvgIds || []), svgId]));

  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          credits: newCredits,
          unlockedSvgIds: newUnlocked,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to unlock in Firestore:', err);
    }
  }

  profile.credits = newCredits;
  profile.unlockedSvgIds = newUnlocked;
  profile.updatedAt = Date.now();
  safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  return true;
}

/**
 * Saves a vectorization history item.
 * Compresses the SVG data using gzip before storing in Firestore and localStorage.
 * Only paid generations should be passed to this function.
 */
export async function saveVectorizationHistory(
  userId: string,
  data: Omit<VectorizationHistoryItem, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  // Gzip-compress SVG for compact storage
  const compressedSvg = await compressSvgString(data.svg);

  const itemToStore = {
    ...data,
    svg: compressedSvg,
    userId,
    createdAt: Date.now(),
  };

  // 1. If Firebase is configured and online, save to Firestore users/{userId}/history
  if (isFirebaseConfigured && db) {
    try {
      const historyCollection = collection(db, 'users', userId, 'history');
      const docRef = await addDoc(historyCollection, {
        ...itemToStore,
        serverTimestamp: serverTimestamp(),
      });
      return docRef.id;
    } catch (err) {
      console.warn('Failed to write to Firestore, falling back to local storage:', err);
    }
  }

  // 2. Fallback / offline / demo mode via localStorage
  try {
    const existingRaw = safeGetStorage(LOCAL_STORAGE_HISTORY_KEY);
    const existing: VectorizationHistoryItem[] = existingRaw ? JSON.parse(existingRaw) : [];
    const id = `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newItem: VectorizationHistoryItem = { ...itemToStore, id, svg: compressedSvg };
    const updated = [newItem, ...existing].slice(0, 50); // keep last 50
    safeSetStorage(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return id;
  } catch (err) {
    console.error('Error saving to local history:', err);
    return `local-${Date.now()}`;
  }
}

/**
 * Fetches user history and automatically decompresses stored gzip SVGs.
 */
export async function fetchUserHistory(userId: string): Promise<VectorizationHistoryItem[]> {
  if (isFirebaseConfigured && db) {
    try {
      const historyCollection = collection(db, 'users', userId, 'history');
      const q = query(historyCollection, orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const items: VectorizationHistoryItem[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const decompressedSvg = await decompressSvgString(data.svg || '');
        items.push({
          id: docSnap.id,
          userId,
          fileName: data.fileName || 'traced-vector.svg',
          originalDimensions: data.originalDimensions || { width: 0, height: 0 },
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
    } catch (err) {
      console.warn('Failed to fetch from Firestore, falling back to localStorage:', err);
    }
  }

  // Fallback to localStorage
  try {
    const existingRaw = safeGetStorage(LOCAL_STORAGE_HISTORY_KEY);
    if (!existingRaw) return [];
    const list: VectorizationHistoryItem[] = JSON.parse(existingRaw);
    const filtered = list.filter((i) => i.userId === userId || !userId || userId === 'guest');
    const decompressedList = await Promise.all(
      filtered.map(async (i) => ({
        ...i,
        svg: await decompressSvgString(i.svg),
      }))
    );
    return decompressedList;
  } catch {
    return [];
  }
}

export async function deleteHistoryItem(userId: string, itemId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, 'users', userId, 'history', itemId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Failed to delete from Firestore, falling back to local storage:', err);
    }
  }

  try {
    const existingRaw = safeGetStorage(LOCAL_STORAGE_HISTORY_KEY);
    if (existingRaw) {
      const list: VectorizationHistoryItem[] = JSON.parse(existingRaw);
      const updated = list.filter((item) => item.id !== itemId);
      safeSetStorage(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Error deleting from local history:', err);
  }
}

export async function linkWalletToUser(userId: string, walletAddress: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, { walletAddress, updatedAt: serverTimestamp() }, { merge: true });
    } catch (err) {
      console.warn('Failed to link wallet in Firestore:', err);
    }
  }

  try {
    const existingRaw = safeGetStorage(LOCAL_STORAGE_PROFILE_KEY);
    const profile: UserProfile = existingRaw
      ? JSON.parse(existingRaw)
      : {
          uid: userId,
          credits: 0,
          isAdmin: false,
          subscription: { status: 'inactive' },
          isPro: false,
          unlockedSvgIds: [],
          updatedAt: Date.now(),
        };
    profile.walletAddress = walletAddress;
    profile.updatedAt = Date.now();
    safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Error linking wallet locally:', err);
  }
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, 'users', userId);
      const docSnap = await getDoc(userRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          uid: userId,
          email: data.email || null,
          displayName: data.displayName || null,
          walletAddress: data.walletAddress || null,
          credits: typeof data.credits === 'number' ? data.credits : 0,
          isAdmin: Boolean(data.isAdmin || safeGetStorage('vtracer_admin_override') === 'true'),
          subscription: data.subscription || { status: 'inactive' },
          isPro: Boolean(data.isPro),
          unlockedSvgIds: Array.isArray(data.unlockedSvgIds) ? data.unlockedSvgIds : [],
          unlockedImages: data.unlockedImages || {},
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
        };
      }
    } catch (err) {
      console.warn('Failed to get Firestore profile, using local fallback:', err);
    }
  }

  try {
    const existingRaw = safeGetStorage(LOCAL_STORAGE_PROFILE_KEY);
    if (existingRaw) {
      const parsed: UserProfile = JSON.parse(existingRaw);
      return {
        ...parsed,
        isAdmin: Boolean(parsed.isAdmin || safeGetStorage('vtracer_admin_override') === 'true'),
        subscription: parsed.subscription || { status: 'inactive' },
        unlockedSvgIds: parsed.unlockedSvgIds || [],
        unlockedImages: parsed.unlockedImages || {},
      };
    }
  } catch {}

  const defaultProfile: UserProfile = {
    uid: userId,
    credits: 0,
    isAdmin: safeGetStorage('vtracer_admin_override') === 'true',
    subscription: { status: 'inactive' },
    isPro: false,
    unlockedSvgIds: [],
    unlockedImages: {},
    updatedAt: Date.now(),
  };
  return defaultProfile;
}

export async function updateUserCredits(
  userId: string,
  newCredits: number,
  isPro?: boolean,
  isAdmin?: boolean
): Promise<void> {
  if (isFirebaseConfigured && db) {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(
        userRef,
        {
          credits: newCredits,
          ...(typeof isPro === 'boolean' ? { isPro } : {}),
          ...(typeof isAdmin === 'boolean' ? { isAdmin } : {}),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('Failed to update credits in Firestore:', err);
    }
  }

  try {
    const existingRaw = safeGetStorage(LOCAL_STORAGE_PROFILE_KEY);
    const profile: UserProfile = existingRaw
      ? JSON.parse(existingRaw)
      : {
          uid: userId,
          credits: 0,
          isAdmin: false,
          subscription: { status: 'inactive' },
          isPro: false,
          unlockedSvgIds: [],
          unlockedImages: {},
          updatedAt: Date.now(),
        };
    profile.credits = newCredits;
    if (typeof isPro === 'boolean') {
      profile.isPro = isPro;
    }
    if (typeof isAdmin === 'boolean') {
      profile.isAdmin = isAdmin;
    }
    profile.updatedAt = Date.now();
    safeSetStorage(LOCAL_STORAGE_PROFILE_KEY, JSON.stringify(profile));
  } catch (err) {
    console.error('Error saving updated profile locally:', err);
  }
}

/**
 * Creates a new crypto transaction record in Firestore (and localStorage fallback).
 */
export async function createCryptoTransaction(
  data: Omit<CryptoTransaction, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: TransactionStatus;
  }
): Promise<string> {
  const now = Date.now();
  const status: TransactionStatus = data.status || 'pending';

  const txData = {
    ...data,
    status,
    createdAt: now,
    updatedAt: now,
  };

  let createdId = `tx-${now}-${Math.random().toString(36).slice(2, 7)}`;

  if (isFirebaseConfigured && db) {
    try {
      const txCollection = collection(db, 'transactions');
      const docRef = await addDoc(txCollection, {
        ...txData,
        serverCreatedAt: serverTimestamp(),
        serverUpdatedAt: serverTimestamp(),
      });
      createdId = docRef.id;
    } catch (err) {
      console.warn('Failed to save transaction to Firestore, storing locally:', err);
    }
  }

  // Also save to localStorage
  try {
    const raw = safeGetStorage(LOCAL_STORAGE_TRANSACTIONS_KEY);
    const existing: CryptoTransaction[] = raw ? JSON.parse(raw) : [];
    const item: CryptoTransaction = { ...txData, id: createdId };
    const updated = [item, ...existing.filter((t) => t.id !== createdId)].slice(0, 100);
    safeSetStorage(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving transaction locally:', err);
  }

  return createdId;
}

/**
 * Fetches all transactions for a specific user from Firestore or localStorage.
 */
export async function fetchUserTransactions(userId: string): Promise<CryptoTransaction[]> {
  if (isFirebaseConfigured && db) {
    try {
      const txCollection = collection(db, 'transactions');
      const q = query(
        txCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(q);
      const items: CryptoTransaction[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        items.push({
          id: docSnap.id,
          userId: d.userId,
          userEmail: d.userEmail,
          packId: d.packId,
          credits: d.credits || 0,
          usdPrice: d.usdPrice || 0,
          cryptoAmount: d.cryptoAmount || '0',
          cryptoToken: d.cryptoToken,
          chainKey: d.chainKey,
          chainId: d.chainId,
          paymentMethod: d.paymentMethod || 'web3',
          fromAddress: d.fromAddress,
          toAddress: d.toAddress,
          txHash: d.txHash,
          status: d.status || 'pending',
          statusMessage: d.statusMessage,
          createdAt: d.createdAt || Date.now(),
          updatedAt: d.updatedAt || Date.now(),
          confirmedAt: d.confirmedAt,
        });
      });
      return items;
    } catch (err) {
      console.warn('Failed to query transactions from Firestore, using local fallback:', err);
    }
  }

  try {
    const raw = safeGetStorage(LOCAL_STORAGE_TRANSACTIONS_KEY);
    if (!raw) return [];
    const items: CryptoTransaction[] = JSON.parse(raw);
    return items.filter((t) => t.userId === userId || !userId || userId === 'guest');
  } catch {
    return [];
  }
}

/**
 * Subscribes to real-time updates for a user's transactions.
 */
export function listenToUserTransactions(
  userId: string,
  onUpdate: (transactions: CryptoTransaction[]) => void
): Unsubscribe {
  if (isFirebaseConfigured && db && userId) {
    try {
      const txCollection = collection(db, 'transactions');
      const q = query(
        txCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(100)
      );

      return onSnapshot(
        q,
        (snapshot) => {
          const items: CryptoTransaction[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            items.push({
              id: docSnap.id,
              userId: d.userId,
              userEmail: d.userEmail,
              packId: d.packId,
              credits: d.credits || 0,
              usdPrice: d.usdPrice || 0,
              cryptoAmount: d.cryptoAmount || '0',
              cryptoToken: d.cryptoToken,
              chainKey: d.chainKey,
              chainId: d.chainId,
              paymentMethod: d.paymentMethod || 'web3',
              fromAddress: d.fromAddress,
              toAddress: d.toAddress,
              txHash: d.txHash,
              status: d.status || 'pending',
              statusMessage: d.statusMessage,
              createdAt: d.createdAt || Date.now(),
              updatedAt: d.updatedAt || Date.now(),
              confirmedAt: d.confirmedAt,
            });
          });
          onUpdate(items);
        },
        (err) => {
          console.warn('Firestore transactions snapshot error:', err);
          fetchUserTransactions(userId).then(onUpdate);
        }
      );
    } catch (err) {
      console.warn('Error setting up transaction snapshot listener:', err);
    }
  }

  // Fallback to initial local fetch
  fetchUserTransactions(userId).then(onUpdate);
  return () => {};
}

/**
 * Subscribes to real-time updates for a single transaction.
 */
export function listenToTransaction(
  transactionId: string,
  onUpdate: (tx: CryptoTransaction | null) => void
): Unsubscribe {
  if (isFirebaseConfigured && db && transactionId) {
    try {
      const txDocRef = doc(db, 'transactions', transactionId);
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
            userEmail: d.userEmail,
            packId: d.packId,
            credits: d.credits || 0,
            usdPrice: d.usdPrice || 0,
            cryptoAmount: d.cryptoAmount || '0',
            cryptoToken: d.cryptoToken,
            chainKey: d.chainKey,
            chainId: d.chainId,
            paymentMethod: d.paymentMethod || 'web3',
            fromAddress: d.fromAddress,
            toAddress: d.toAddress,
            txHash: d.txHash,
            status: d.status || 'pending',
            statusMessage: d.statusMessage,
            createdAt: d.createdAt || Date.now(),
            updatedAt: d.updatedAt || Date.now(),
            confirmedAt: d.confirmedAt,
          });
        },
        (err) => {
          console.warn('Error listening to single transaction:', err);
        }
      );
    } catch (err) {
      console.warn('Error setting up single transaction listener:', err);
    }
  }

  return () => {};
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
  }
): Promise<void> {
  const now = Date.now();
  if (isFirebaseConfigured && db) {
    try {
      const txDocRef = doc(db, 'transactions', transactionId);
      await updateDoc(txDocRef, {
        status,
        ...(options?.txHash ? { txHash: options.txHash } : {}),
        ...(options?.statusMessage ? { statusMessage: options.statusMessage } : {}),
        ...(options?.confirmedAt ? { confirmedAt: options.confirmedAt } : {}),
        updatedAt: now,
        serverUpdatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Failed to update transaction in Firestore:', err);
    }
  }

  // Update in localStorage
  try {
    const raw = safeGetStorage(LOCAL_STORAGE_TRANSACTIONS_KEY);
    if (raw) {
      const items: CryptoTransaction[] = JSON.parse(raw);
      const updated = items.map((item) =>
        item.id === transactionId
          ? {
              ...item,
              status,
              ...(options?.txHash ? { txHash: options.txHash } : {}),
              ...(options?.statusMessage ? { statusMessage: options.statusMessage } : {}),
              ...(options?.confirmedAt ? { confirmedAt: options.confirmedAt } : {}),
              updatedAt: now,
            }
          : item
      );
      safeSetStorage(LOCAL_STORAGE_TRANSACTIONS_KEY, JSON.stringify(updated));
    }
  } catch {}
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
export async function refreshUserCredits(userId: string): Promise<RefreshCreditsResult> {
  const transactions = await fetchUserTransactions(userId);
  const pending = transactions.filter((t) => t.status === 'pending');
  const confirmed = transactions.filter((t) => t.status === 'confirmed');

  let cloudFunctionNotified = false;

  // Cloud Function webhook/endpoint trigger
  const functionUrl =
    process.env.NEXT_PUBLIC_REFRESH_CREDITS_FUNCTION_URL ||
    process.env.NEXT_PUBLIC_CLOUD_FUNCTION_URL;

  if (functionUrl && pending.length > 0) {
    try {
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
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
      if (res.ok) {
        cloudFunctionNotified = true;
      }
    } catch (err) {
      console.warn('Cloud Function refresh invocation error:', err);
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
