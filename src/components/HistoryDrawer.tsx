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
} from 'lucide-react';
import {
  HistoryEntry,
  HistoryGeneration,
  UserProfile,
  fetchHistoryGenerations,
  getImageUnlockStatus,
} from '../lib/firebase/firestore';

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
  onDeleteEntry: (entryId: string) => void;
  onDeleteGeneration: (entryId: string, generationId: string) => void;
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
    async (entryId: string) => {
      if (!userId || generationsByEntry[entryId]) return;
      setLoadingEntries((prev) => new Set(prev).add(entryId));
      try {
        const gens = await fetchHistoryGenerations(userId, entryId);
        setGenerationsByEntry((prev) => ({ ...prev, [entryId]: gens }));
      } catch (err) {
        console.warn('Could not load generations:', err);
        setGenerationsByEntry((prev) => ({ ...prev, [entryId]: [] }));
      } finally {
        setLoadingEntries((prev) => {
          const next = new Set(prev);
          next.delete(entryId);
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
    void loadGenerations(entry.id);
  };

  const handleDeleteGeneration = (
    e: React.MouseEvent,
    entryId: string,
    generationId: string,
  ) => {
    e.stopPropagation();
    onDeleteGeneration(entryId, generationId);
    setGenerationsByEntry((prev) => {
      const gens = prev[entryId];
      if (!gens) return prev;
      return {
        ...prev,
        [entryId]: gens.filter((g) => (g.generationId || g.id) !== generationId),
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

  const renderGeneration = (entryId: string, gen: HistoryGeneration) => {
    const quota = gen.imageHash
      ? getImageUnlockStatus(profile ?? null, gen.imageHash)
      : null;
    const showQuota = quota !== null && quota.maxGenerations < 9000;
    const genKey = gen.generationId || gen.id;
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
              {new Date(gen.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
            <span>{gen.nodeCount} paths</span>
            <span>•</span>
            <span>{gen.executionTimeMs} ms</span>
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
                  {quota.generationsRemaining}/{quota.maxGenerations} gens left
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
            title={copiedId === gen.id ? 'Copied' : 'Copy SVG'}
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
            title="Download SVG"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => handleDeleteGeneration(e, entryId, genKey)}
            className="rounded-md p-1.5 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 transition"
            title="Delete generation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <span className="flex items-center gap-0.5 pl-1 text-indigo-400 font-medium group-hover:translate-x-0.5 transition">
            Load <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-neutral-900 border-l border-neutral-800 p-6 flex flex-col shadow-2xl h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Traced History</h2>
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
                {isClearing ? 'Clearing…' : confirmingClear ? 'Confirm clear all?' : 'Clear all'}
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
                alt="vectorizerr"
                className="h-12 w-12 mb-3 opacity-30 grayscale"
              />
              <p className="text-sm font-medium">No history items yet</p>
              <p className="text-xs text-neutral-600 mt-1">
                Validated SVG exports are saved to your history.
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
                            {new Date(entry.updatedAt || entry.createdAt).toLocaleDateString()}
                          </span>
                          {gens && gens.length > 0 && (
                            <>
                              <span>•</span>
                              <span>{gens.length} generation{gens.length === 1 ? '' : 's'}</span>
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
                          gens.map((gen) => renderGeneration(entry.id, gen))
                        ) : (
                          <p className="py-4 text-center text-xs text-neutral-500">
                            No generations found for this image.
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
                          onDeleteEntry(entry.id);
                        }}
                        className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-red-400 transition"
                        title="Delete this image and all its generations"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete image</span>
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
                      Loading…
                    </span>
                  ) : (
                    'Load more'
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
