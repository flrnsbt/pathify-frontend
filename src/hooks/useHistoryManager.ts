'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  fetchHistoryEntries,
  fetchHistoryCount,
  deleteHistoryEntry,
  deleteHistoryGeneration,
  deleteAllHistoryEntries,
  historyGenerationExists,
  validatedGenerationExists,
  saveVectorizationHistory,
  getUserProfile,
  getImageUnlockStatus,
  consumeImageGeneration,
  HistoryEntry,
  HistoryGeneration,
} from '../lib/firebase/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';
import {
  fetchLocalImages,
  saveLocalGeneration,
  localGenerationExists,
  deleteLocalGeneration,
  deleteLocalGenerationsForImage,
  clearLocalGenerations,
  LocalHistoryImage,
} from '../lib/local-history';
import { useAuth } from '../lib/firebase/auth-context';
import { useI18n } from '../lib/i18n';
import { VTracerOptions } from '../lib/vtracer/types';
import { LoadedImageInfo } from '../components/Uploader';

/** Content hash of an SVG string — the uniqueness key for a "generation". */
async function hashSvgContent(svgStr: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(svgStr)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useHistoryManager(
  currentImage: LoadedImageInfo | null,
  svg: string | null,
  options: VTracerOptions,
  refreshProfile: () => Promise<void>,
  setSourceNotice: (msg: string | null) => void,
) {
  const { t } = useI18n();
  const { user } = useAuth();

  // History list (paginated — one entry per source image)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyCursor, setHistoryCursor] = useState<DocumentSnapshot | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);

  // Browser-local fallback history (IndexedDB) — holds generations that could
  // not be written to Firestore (e.g. oversized SVGs). Rollup index only;
  // SVG payloads are fetched lazily when an entry is expanded.
  const [localImages, setLocalImages] = useState<LocalHistoryImage[]>([]);
  const refreshLocalImages = useCallback(async () => {
    setLocalImages(await fetchLocalImages());
  }, []);

  const loadHistory = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const [page, count] = await Promise.all([
        fetchHistoryEntries(user.uid),
        fetchHistoryCount(user.uid),
      ]);
      setHistoryEntries(page.items);
      setHistoryCursor(page.lastCursor);
      setHistoryHasMore(page.hasMore);
      setHistoryTotal(count);
      await refreshLocalImages();
    } catch (err) {
      console.warn('Could not load history:', err);
    }
  }, [user, refreshLocalImages]);

  // Load first page of history when user changes
  useEffect(() => {
    let active = true;
    if (user?.uid) {
      Promise.all([
        fetchHistoryEntries(user.uid),
        fetchHistoryCount(user.uid),
      ]).then(([page, count]) => {
        if (active) {
          setHistoryEntries(page.items);
          setHistoryCursor(page.lastCursor);
          setHistoryHasMore(page.hasMore);
          setHistoryTotal(count);
        }
      });
      fetchLocalImages().then((imgs) => {
        if (active) setLocalImages(imgs);
      });
    }
    return () => {
      active = false;
    };
  }, [user]);

  const loadMoreHistory = useCallback(async () => {
    if (!user?.uid || !historyCursor || historyLoadingMore) return;
    setHistoryLoadingMore(true);
    try {
      const page = await fetchHistoryEntries(user.uid, historyCursor);
      setHistoryEntries((prev) => [...prev, ...page.items]);
      setHistoryCursor(page.lastCursor);
      setHistoryHasMore(page.hasMore);
    } catch (err) {
      console.warn('Could not load more history:', err);
    } finally {
      setHistoryLoadingMore(false);
    }
  }, [user, historyCursor, historyLoadingMore]);

  // Generations already counted this session, keyed `${imageHash}:${svgHash}`
  // (dedupe across repeated exports, scoped per source image)
  const [sessionValidatedGenerations, setSessionValidatedGenerations] =
    useState<ReadonlySet<string>>(new Set());
  const markSessionValidated = useCallback((key: string) => {
    setSessionValidatedGenerations((prev) =>
      prev.has(key) ? prev : new Set(prev).add(key),
    );
  }, []);

  // Hash of the currently displayed SVG — identifies whether this exact
  // generation was already validated (paid), independent of remaining quota.
  // Stored alongside the SVG it was computed from so a stale hash is never
  // trusted while a new trace is being hashed.
  const [svgHashResult, setSvgHashResult] = useState<{
    svg: string;
    hash: string;
  } | null>(null);
  useEffect(() => {
    if (!svg) return;
    let cancelled = false;
    hashSvgContent(svg).then((h) => {
      if (!cancelled) setSvgHashResult({ svg, hash: h });
    });
    return () => {
      cancelled = true;
    };
  }, [svg]);
  const currentSvgHash =
    svg && svgHashResult?.svg === svg ? svgHashResult.hash : '';

  // True when the SVG on screen is already a validated (paid) generation —
  // re-exporting it is always free, even if the image quota is exhausted.
  // Checks the session cache first, then the generations subcollection.
  // `remoteOwnedGeneration` stores the {imageHash, svgHash} pair confirmed
  // owned remotely, so identical SVGs under different source images don't
  // produce false positives.
  const [remoteOwnedGeneration, setRemoteOwnedGeneration] = useState<{
    imageHash: string;
    svgHash: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (
        !user?.uid ||
        user.isAnonymous ||
        !currentImage?.imageHash ||
        !currentSvgHash
      ) {
        return;
      }
      const sessionKey = `${currentImage.imageHash}:${currentSvgHash}`;
      // The account-scoped validated marker is written on every quota
      // consume and covers all paid paths — historyGenerationExists would
      // only add coverage for generations saved before markers existed.
      const owned =
        sessionValidatedGenerations.has(sessionKey) ||
        (await localGenerationExists(currentImage.imageHash, currentSvgHash)) ||
        (await validatedGenerationExists(user.uid, currentSvgHash));
      if (!cancelled && owned) {
        setRemoteOwnedGeneration({
          imageHash: currentImage.imageHash,
          svgHash: currentSvgHash,
        });
      }
    };
    void check().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user, currentImage?.imageHash, currentSvgHash, sessionValidatedGenerations]);

  const isCurrentGenerationOwned = Boolean(
    currentSvgHash &&
    currentImage?.imageHash &&
    (sessionValidatedGenerations.has(
      `${currentImage?.imageHash}:${currentSvgHash}`
    ) ||
      (remoteOwnedGeneration?.imageHash === currentImage.imageHash &&
        remoteOwnedGeneration.svgHash === currentSvgHash))
  );

  // A generation is "validated" when the user exports it (download SVG / copy SVG code).
  // Uniqueness is defined by SVG content: the first export of a given SVG consumes
  // 1 quota and writes the history entry; re-exports of identical SVG content are free.
  const recordValidatedGeneration = useCallback(async (): Promise<boolean> => {
    if (!user || user.isAnonymous || !currentImage || !svg) return false;
    try {
      // Dedupe key = hash of the SVG content itself. An already-validated
      // generation is always re-exportable, even with exhausted quota.
      const svgHash = await hashSvgContent(svg);
      const sessionKey = `${currentImage.imageHash}:${svgHash}`;
      const inHistory =
        sessionValidatedGenerations.has(sessionKey) ||
        (await localGenerationExists(currentImage.imageHash, svgHash)) ||
        (await historyGenerationExists(
          user.uid,
          currentImage.imageHash,
          svgHash,
        ));
      // Account-scoped validated marker — survives history deletion and is
      // independent of which source image produced this SVG.
      const wasValidated =
        inHistory || (await validatedGenerationExists(user.uid, svgHash));

      const nodeCount = (svg.match(/<path/g) || []).length;
      const svgSize = new Blob([svg]).size;
      const originalDimensions = {
        width: currentImage.width,
        height: currentImage.height,
      };

      const saveToHistory = () =>
        saveVectorizationHistory(user.uid, {
          fileName: currentImage.fileName,
          originalDimensions,
          originalSize: currentImage.fileSize,
          imageHash: currentImage.imageHash,
          nodeCount,
          executionTimeMs: 0,
          parameters: options,
          svg,
          svgSize,
          generationId: svgHash,
        });

      const saveToLocal = async (tooLarge: boolean) => {
        // Cloud write failed (usually an oversized SVG) — keep a local copy so
        // the paid generation still appears in history on this device.
        await saveLocalGeneration({
          id: svgHash,
          generationId: svgHash,
          userId: user.uid,
          imageHash: currentImage.imageHash,
          fileName: currentImage.fileName,
          originalDimensions,
          originalSize: currentImage.fileSize,
          nodeCount,
          executionTimeMs: 0,
          parameters: options,
          svg,
          svgSize,
          createdAt: Date.now(),
          localOnly: true,
        });
        setSourceNotice(
          tooLarge ? t('page.svgTooLarge') : t('page.historySaveFailed')
        );
      };

      if (wasValidated) {
        // Already paid for — free export. If it's missing from history (user
        // deleted it, saved on another device, or the cloud write failed),
        // re-insert it without consuming quota.
        markSessionValidated(sessionKey);
        if (!inHistory) {
          const res = await saveToHistory();
          if (!res.cloudSaved) await saveToLocal(res.tooLarge);
          await refreshLocalImages();
          loadHistory();
        }
        return true;
      }

      const freshProfile = await getUserProfile(user.uid);
      const isPaidPath = Boolean(
        freshProfile.subscription?.status === 'active' ||
        getImageUnlockStatus(freshProfile, currentImage.imageHash).isUnlocked
      );
      if (!isPaidPath) return false;

      // Fail closed: only proceed when the server confirms the quota consumption.
      // The server also records an account-scoped validated marker for svgHash.
      const remaining = await consumeImageGeneration(
        user.uid,
        currentImage.imageHash,
        svgHash,
      );
      if (remaining === null) return false;
      markSessionValidated(sessionKey);
      await refreshProfile();

      const historyResult = await saveToHistory();
      if (!historyResult.cloudSaved) {
        await saveToLocal(historyResult.tooLarge);
      }
      await refreshLocalImages();
      loadHistory();
      return true;
    } catch (err) {
      console.warn('Failed to record validated generation:', err);
      return false;
    }
  }, [user, currentImage, svg, options, refreshProfile, loadHistory, refreshLocalImages, sessionValidatedGenerations, markSessionValidated, t]);

  const handleDeleteHistoryEntry = async (entry: HistoryEntry) => {
    if (!user) return;
    if (entry.localOnly) {
      // Synthetic entry backed only by the browser-local fallback store
      await deleteLocalGenerationsForImage(entry.imageHash);
      await refreshLocalImages();
      return;
    }
    await deleteHistoryEntry(user.uid, entry.id);
    // Also drop any local fallback generations for this image (mixed case)
    await deleteLocalGenerationsForImage(entry.imageHash).catch(() => {});
    await refreshLocalImages();
    setHistoryEntries((prev) => prev.filter((e) => e.id !== entry.id));
    setHistoryTotal((total) => Math.max(0, total - 1));
  };

  const handleDeleteHistoryGeneration = async (
    entryId: string,
    generationId: string,
    localOnly = false,
  ) => {
    if (!user) return;
    if (localOnly) {
      await deleteLocalGeneration(entryId, generationId);
      await refreshLocalImages();
      return;
    }
    await deleteHistoryGeneration(user.uid, entryId, generationId);
  };

  const handleDeleteAllHistory = async () => {
    if (!user) return;
    await deleteAllHistoryEntries(user.uid);
    await clearLocalGenerations();
    setLocalImages([]);
    setHistoryEntries([]);
    setHistoryCursor(null);
    setHistoryHasMore(false);
    setHistoryTotal(0);
  };

  // Merge local-only fallback entries: images with generations in IndexedDB but
  // no (currently loaded) Firestore entry get a synthetic history entry. If the
  // cloud entry exists on an unloaded page it replaces the synthetic one once
  // "Load more" fetches it.
  const cloudImageHashes = new Set(historyEntries.map((e) => e.imageHash));
  const localOnlyEntries: HistoryEntry[] = localImages
    .filter((img) => img.imageHash && !cloudImageHashes.has(img.imageHash))
    .map((img) => ({
      id: `local-${img.imageHash}`,
      userId: user?.uid ?? '',
      imageHash: img.imageHash,
      fileName: img.fileName || 'traced-vector.svg',
      originalDimensions: img.originalDimensions || { width: 0, height: 0 },
      originalSize: img.originalSize,
      createdAt: img.earliestAt,
      updatedAt: img.latestAt,
      localOnly: true,
    }));
  const displayEntries = [...localOnlyEntries, ...historyEntries].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  const displayTotal = historyTotal + localOnlyEntries.length;

  return {
    historyEntries,
    historyCursor,
    historyHasMore,
    historyTotal,
    historyLoadingMore,
    localImages,
    loadHistory,
    loadMoreHistory,
    refreshLocalImages,
    handleDeleteHistoryEntry,
    handleDeleteHistoryGeneration,
    handleDeleteAllHistory,
    displayEntries,
    displayTotal,
    sessionValidatedGenerations,
    markSessionValidated,
    currentSvgHash,
    isCurrentGenerationOwned,
    recordValidatedGeneration,
  };
}

export type { HistoryEntry, HistoryGeneration, LocalHistoryImage };
