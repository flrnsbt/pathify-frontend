import type { DocumentSnapshot } from "firebase/firestore";
import { VTracerOptions } from "../../vtracer/types";
import { SupportedChainKey, SupportedToken } from "../../web3/payment-wallets";

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

export interface SaveHistoryResult {
  savedId: string;
  /** False when the generation could not be written to Firestore. */
  cloudSaved: boolean;
  /** True when the compressed SVG exceeds the Firestore field limit. */
  tooLarge: boolean;
}

export interface CreatedTransaction {
  id: string;
  /** Server-assigned expected amount (unique for direct payments). */
  expectedAmount?: string;
  /** Server-resolved recipient address. */
  toAddress?: string;
  /** Direct-payment expiry timestamp (ms), when applicable. */
  expiresAt?: number;
}

export interface RefreshCreditsResult {
  updatedCredits: number;
  profile: UserProfile;
  pendingTransactions: CryptoTransaction[];
  confirmedTransactions: CryptoTransaction[];
  cloudFunctionNotified: boolean;
}
