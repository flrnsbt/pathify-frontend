/**
 * Firestore domain — barrel re-export.
 *
 * All public symbols are re-exported from their domain modules so that
 * existing import paths (`from '../lib/firebase/firestore'`) continue to
 * work without any changes across the codebase.
 *
 * Internal modules:
 *   firestore/types.ts        — TypeScript interfaces & types
 *   firestore/utils.ts        — Private helpers (not re-exported)
 *   firestore/profiles.ts     — User profile, unlock & credit functions
 *   firestore/history.ts      — History CRUD & generation management
 *   firestore/transactions.ts — Crypto transaction lifecycle
 */

export * from './firestore/types';
export * from './firestore/profiles';
export * from './firestore/history';
export * from './firestore/transactions';
