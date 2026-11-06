'use client';

import React from 'react';
import {
  X,
  Clock,
  Layers,
  Download,
  Trash2,
  ArrowUpRight,
  Copy,
  Check,
  Shield,
  ChevronDown,
  Loader2,
  CloudOff,
} from 'lucide-react';
import {
  HistoryEntry,
  HistoryGeneration,
  UserProfile,
  fetchHistoryGenerations,
  getImageUnlockStatus,
} from '../lib/firebase/firestore';
import { fetchLocalGenerations } from '../lib/local-history';
import { useI18n } from '../lib/i18n';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  entries: HistoryEntry[];
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (generation: HistoryGeneration) => void;
  onDeleteEntry: (entry: HistoryEntry) => void;
  onDeleteGeneration: (
    entryId: string,
    generationId: string,
    localOnly?: boolean,
  ) => void;
  onDeleteAll: () => void;
  isAdmin: boolean;
  profile?: UserProfile | null;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  userId,
  entries,
  totalCount,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onSelect,
  onDeleteEntry,
  onDeleteGeneration,
  onDeleteAll,
  isAdmin,
  profile,
}: HistoryDrawerProps) {
  const { t, locale } = useI18n();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [generationsByEntry, setGenerationsByEntry] = React.useState<
    Record<string, HistoryGeneration[]>
  >({});
  const [loadingEntries, setLoadingEntries] = React.useState<Set<string>>(
    () => new Set(),
  );

  React.useEffect(() => {
    if (!confirmingClear) return;
    const t = setTimeout(() => setConfirmingClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmingClear]);

  // Closing resets expansion state so reopening starts collapsed
  const handleClose = () => {
    setExpandedId(null);
    setGenerationsByEntry({});
    onClose();
  };

  const handleClearAll = async () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setIsClearing(true);
    try {
      await onDeleteAll();
    } finally {
      setIsClearing(false);
      setConfirmingClear(false);
    }
  };

  const loadGenerations = React.useCallback(
    async (entry: HistoryEntry) => {
      const cacheKey = entry.id;
      if (generationsByEntry[cacheKey]) return;
      setLoadingEntries((prev) => new Set(prev).add(cacheKey));
      try {
        const imageHash = entry.imageHash || entry.id;
        // Local-only entries have no Firestore doc; regular entries may still
        // have local fallback generations merged in.
        const [cloud, local] = await Promise.all([
          entry.localOnly || !userId
            ? Promise.resolve([] as HistoryGeneration[])
            : fetchHistoryGenerations(userId, imageHash),
          fetchLocalGenerations(imageHash),
        ]);
        const seen = new Set(cloud.map((g) => g.generationId || g.id));
        const merged = [
          ...cloud,
          ...local.filter((g) => !seen.has(g.generationId || g.id)),
        ].sort((a, b) => b.createdAt - a.createdAt);
        setGenerationsByEntry((prev) => ({ ...prev, [cacheKey]: merged }));
      } catch (err) {
        console.warn('Could not load generations:', err);
        setGenerationsByEntry((prev) => ({ ...prev, [cacheKey]: [] }));
      } finally {
        setLoadingEntries((prev) => {
          const next = new Set(prev);
          next.delete(cacheKey);
          return next;
        });
      }
    },
    [userId, generationsByEntry],
  );

  const toggleEntry = (entry: HistoryEntry) => {
    if (expandedId === entry.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(entry.id);
    void loadGenerations(entry);
  };

  const handleDeleteGeneration = (
    e: React.MouseEvent,
    entry: HistoryEntry,
    gen: HistoryGeneration,
  ) => {
    e.stopPropagation();
    const genKey = gen.generationId || gen.id;
    onDeleteGeneration(entry.imageHash || entry.id, genKey, Boolean(gen.localOnly));
    setGenerationsByEntry((prev) => {
      const gens = prev[entry.id];
      if (!gens) return prev;
      return {
        ...prev,
        [entry.id]: gens.filter((g) => (g.generationId || g.id) !== genKey),
      };
    });
  };

  if (!isOpen) return null;

  // History only contains validated (paid) generations — always accessible
  const handleCopy = (e: React.MouseEvent, gen: HistoryGeneration) => {
    e.stopPropagation();
    navigator.clipboard.writeText(gen.svg);
    setCopiedId(gen.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (e: React.MouseEvent, gen: HistoryGeneration) => {
    e.stopPropagation();
    const blob = new Blob([gen.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = gen.fileName.replace(/\.[^/.]+$/, '') + '.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderGeneration = (entry: HistoryEntry, gen: HistoryGeneration) => {
    const quota = gen.imageHash
      ? getImageUnlockStatus(profile ?? null, gen.imageHash)
      : null;
    const showQuota = quota !== null && quota.maxGenerations < 9000;
    return (
      <div
        key={gen.id}
        onClick={() => {
          onSelect(gen);
          handleClose();
        }}
        className="group relative flex items-center gap-3 rounded-lg border border-neutral-800/80 bg-neutral-900/50 px-3 py-2.5 hover:border-indigo-500/50 hover:bg-neutral-900 transition cursor-pointer"
      >
        {gen.svg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(gen.svg)}`}
            alt="SVG preview"
            className="h-10 w-10 rounded-md border border-neutral-800 bg-white object-contain shrink-0"
          />
        ) : (
          <div className="h-10 w-10 rounded-md bg-neutral-950 border border-neutral-800 p-2 flex items-center justify-center text-indigo-400 shrink-0">
            {isAdmin ? (
              <Shield className="h-4 w-4 text-purple-400" />
            ) : (
              <Layers className="h-4 w-4 text-emerald-400" />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-300 truncate group-hover:text-indigo-400 transition">
              {new Date(gen.createdAt).toLocaleString(locale)}
            </span>
            {gen.localOnly && (
              <span
                className="flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-300"
                title={t('history.localOnlyTitle')}
              >
                <CloudOff className="h-2.5 w-2.5 shrink-0" />
                {t('history.localOnly')}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
            <span>{t('history.paths', { count: gen.nodeCount })}</span>
            <span>•</span>
            <span>{t('history.ms', { count: gen.executionTimeMs })}</span>
            {showQuota && (
              <>
                <span>•</span>
                <span
                  className={
                    quota.generationsRemaining === 0
                      ? 'text-red-400'
                      : 'text-emerald-400'
                  }
                >
                  {t('history.gensLeft', {
                    remaining: quota.generationsRemaining,
                    max: quota.maxGenerations,
                  })}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => handleCopy(e, gen)}
            className="rounded-md p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 transition"
            title={copiedId === gen.id ? t('common.copied') : t('history.copySvg')}
          >
            {copiedId === gen.id ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => handleDownload(e, gen)}
            className="rounded-md p-1.5 text-neutral-500 hover:text-white hover:bg-neutral-800 transition"
            title={t('history.downloadSvg')}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteGeneration(e, entry, gen)}
            className="rounded-md p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition"
            title={t('history.deleteGeneration')}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <span className="flex items-center gap-0.5 pl-1 text-[11px] text-indigo-400 font-medium group-hover:translate-x-0.5 transition">
            {t('history.load')} <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 p-6 flex flex-col shadow-2xl h-full animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">{t('history.title')}</h2>
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
              {totalCount}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {totalCount > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isClearing}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                  confirmingClear
                    ? 'border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                    : 'border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-red-300'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {isClearing
                  ? t('history.clearing')
                  : confirmingClear
                    ? t('history.confirmClearAll')
                    : t('history.clearAll')}
              </button>
            )}
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt="pathify"
                className="h-12 w-12 mb-3 opacity-30 grayscale"
              />
              <p className="text-sm font-medium">{t('history.emptyTitle')}</p>
              <p className="text-xs text-neutral-600 mt-1">
                {t('history.emptySubtitle')}
              </p>
            </div>
          ) : (
            <>
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const gens = generationsByEntry[entry.id];
                const isLoading = loadingEntries.has(entry.id);
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-neutral-800 bg-neutral-950/60 overflow-hidden"
                  >
                    {/* Entry header — click to expand generations */}
                    <div
                      onClick={() => toggleEntry(entry)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-neutral-950 transition cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-neutral-200 truncate">
                          {entry.fileName}
                        </h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                          <span>
                            {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString(locale)}
                          </span>
                          {gens && gens.length > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                {t('history.generations', { count: gens.length })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 text-neutral-500 shrink-0 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </div>

                    {/* Expanded generations */}
                    {isExpanded && (
                      <div className="border-t border-neutral-800/80 px-3 py-3 space-y-2">
                        {isLoading ? (
                          <div className="flex items-center justify-center py-6 text-neutral-500">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : gens && gens.length > 0 ? (
                          gens.map((gen) => renderGeneration(entry, gen))
                        ) : (
                          <p className="py-4 text-center text-xs text-neutral-500">
                            {t('history.noGenerations')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Entry actions */}
                    <div className="flex items-center justify-end border-t border-neutral-900 px-4 py-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteEntry(entry);
                        }}
                        className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-400 transition"
                        title={t('history.deleteImageTitle')}
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>{t('history.deleteImage')}</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <button
                  type="button"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/60 py-2.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-900 transition disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('history.loading')}
                    </span>
                  ) : (
                    t('common.loadMore')
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
