'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  CryptoTransaction,
  listenToUserTransactions,
  refreshUserCredits,
  RefreshCreditsResult,
} from '../lib/firebase/firestore';

interface UseTransactionListenerOptions {
  userId?: string | null;
  onTransactionFinished?: (tx: CryptoTransaction) => void;
  onRefreshCompleted?: (result: RefreshCreditsResult) => void;
}

export function useTransactionListener({
  userId,
  onTransactionFinished,
  onRefreshCompleted,
}: UseTransactionListenerOptions) {
  const [rawTransactions, setRawTransactions] = useState<CryptoTransaction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const pendingSetRef = useRef<Set<string>>(new Set());
  const initialLoadRef = useRef(true);

  // Keep callback refs up to date so changing callback references never re-trigger listener effect
  const onTransactionFinishedRef = useRef(onTransactionFinished);
  onTransactionFinishedRef.current = onTransactionFinished;

  const onRefreshCompletedRef = useRef(onRefreshCompleted);
  onRefreshCompletedRef.current = onRefreshCompleted;

  // Derive active transactions based on current userId
  const transactions = userId ? rawTransactions : [];

  // Manual or automatic refresh trigger
  const triggerRefresh = useCallback(async () => {
    if (!userId) return null;
    setIsRefreshing(true);
    try {
      const result = await refreshUserCredits(userId);
      onRefreshCompletedRef.current?.(result);
      return result;
    } catch (err) {
      console.warn('Failed to refresh user credits:', err);
      return null;
    } finally {
      setIsRefreshing(false);
    }
  }, [userId]);

  const triggerRefreshRef = useRef(triggerRefresh);
  triggerRefreshRef.current = triggerRefresh;

  useEffect(() => {
    if (!userId) {
      setRawTransactions([]);
      pendingSetRef.current.clear();
      initialLoadRef.current = true;
      return;
    }

    pendingSetRef.current.clear();
    initialLoadRef.current = true;

    const unsubscribe = listenToUserTransactions(userId, (txList) => {
      setRawTransactions(txList);

      const currentPendingIds = new Set(
        txList.filter((t) => t.status === 'pending').map((t) => t.id)
      );

      // Detect any transactions that were pending and have now finished (confirmed, failed, cancelled)
      if (!initialLoadRef.current) {
        for (const prevId of pendingSetRef.current) {
          if (!currentPendingIds.has(prevId)) {
            const finishedTx = txList.find((t) => t.id === prevId);
            if (finishedTx && finishedTx.status !== 'pending') {
              // Trigger cloud function / refresh logic
              triggerRefreshRef.current();
              onTransactionFinishedRef.current?.(finishedTx);
            }
          }
        }
      }

      pendingSetRef.current = currentPendingIds;
      initialLoadRef.current = false;
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const pendingCount = transactions.filter((t) => t.status === 'pending').length;

  return {
    transactions,
    pendingCount,
    isRefreshing,
    refreshCredits: triggerRefresh,
  };
}
