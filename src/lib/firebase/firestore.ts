import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  orderBy,
  limit,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './config';
import { VTracerOptions } from '../vtracer/types';

export interface VectorizationHistoryItem {
  id: string;
  userId: string;
  fileName: string;
  originalDimensions: { width: number; height: number };
  originalSize?: number;
  nodeCount: number;
  executionTimeMs: number;
  parameters: VTracerOptions;
  svg: string;
  svgSize: number;
  createdAt: number; // unix timestamp ms
}

export interface SubscriptionInfo {
  status: 'inactive' | 'active' | 'canceled';
  plan?: 'monthly' | 'yearly';
  validUntil?: number;
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
  updatedAt: number;
}

const LOCAL_STORAGE_HISTORY_KEY = 'vtracer_local_history';
const LOCAL_STORAGE_PROFILE_KEY = 'vtracer_local_profile';

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

export function canAccessSvg(profile: UserProfile | null, svgId?: string): boolean {
  if (!profile) return false;
  if (profile.isAdmin) return true;
  if (profile.subscription?.status === 'active') return true;
  if (svgId && profile.unlockedSvgIds?.includes(svgId)) return true;
  return false;
}

export async function unlockSvgWithCredit(userId: string, svgId: string): Promise<boolean> {
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

export async function saveVectorizationHistory(
  userId: string,
  data: Omit<VectorizationHistoryItem, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const item: Omit<VectorizationHistoryItem, 'id'> = {
    ...data,
    userId,
    createdAt: Date.now(),
  };

  // 1. If Firebase is configured and online, save to Firestore users/{userId}/history
  if (isFirebaseConfigured && db) {
    try {
      const historyCollection = collection(db, 'users', userId, 'history');
      const docRef = await addDoc(historyCollection, {
        ...item,
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
    const newItem: VectorizationHistoryItem = { ...item, id };
    const updated = [newItem, ...existing].slice(0, 50); // keep last 50
    safeSetStorage(LOCAL_STORAGE_HISTORY_KEY, JSON.stringify(updated));
    return id;
  } catch (err) {
    console.error('Error saving to local history:', err);
    return `local-${Date.now()}`;
  }
}

export async function fetchUserHistory(userId: string): Promise<VectorizationHistoryItem[]> {
  if (isFirebaseConfigured && db) {
    try {
      const historyCollection = collection(db, 'users', userId, 'history');
      const q = query(historyCollection, orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const items: VectorizationHistoryItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          userId,
          fileName: data.fileName || 'traced-vector.svg',
          originalDimensions: data.originalDimensions || { width: 0, height: 0 },
          originalSize: data.originalSize || 0,
          nodeCount: data.nodeCount || 0,
          executionTimeMs: data.executionTimeMs || 0,
          parameters: data.parameters || {},
          svg: data.svg || '',
          svgSize: data.svgSize || (data.svg ? data.svg.length : 0),
          createdAt: data.createdAt || Date.now(),
        });
      });
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
    return list.filter((i) => i.userId === userId || !userId || userId === 'guest');
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
