'use client';

import React from 'react';
import { X, Clock, Layers, Download, Trash2, ArrowUpRight, Copy, Check, Shield } from 'lucide-react';
import { VectorizationHistoryItem, UserProfile, getImageUnlockStatus } from '../lib/firebase/firestore';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: VectorizationHistoryItem[];
  onSelect: (item: VectorizationHistoryItem) => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  isAdmin: boolean;
  profile?: UserProfile | null;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  items,
  onSelect,
  onDelete,
  onDeleteAll,
  isAdmin,
  profile,
}: HistoryDrawerProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = React.useState(false);
  const [isClearing, setIsClearing] = React.useState(false);

  React.useEffect(() => {
    if (!confirmingClear) return;
    const t = setTimeout(() => setConfirmingClear(false), 4000);
    return () => clearTimeout(t);
  }, [confirmingClear]);

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

  if (!isOpen) return null;

  // History only contains validated (paid) generations — always accessible
  const handleCopy = (e: React.MouseEvent, item: VectorizationHistoryItem) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.svg);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (e: React.MouseEvent, item: VectorizationHistoryItem) => {
    e.stopPropagation();
    const blob = new Blob([item.svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item.fileName.replace(/\.[^/.]+$/, '') + '.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
              {items.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {items.length > 0 && (
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
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {items.length === 0 ? (
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
            items.map((item) => {
              const quota = item.imageHash
                ? getImageUnlockStatus(profile ?? null, item.imageHash)
                : null;
              const showQuota = quota !== null && quota.maxGenerations < 9000;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="group relative flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 hover:border-indigo-500/50 hover:bg-neutral-950 transition cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-medium text-neutral-200 truncate group-hover:text-indigo-400 transition">
                          {item.fileName}
                        </h3>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{item.nodeCount} paths</span>
                        <span>•</span>
                        <span>{item.executionTimeMs} ms</span>
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

                    {/* Preview of the validated SVG (stored gzip-compressed, decompressed on fetch) */}
                    {item.svg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`}
                        alt="SVG preview"
                        className="h-11 w-11 rounded-lg border border-neutral-800 bg-white object-contain shrink-0"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-lg bg-neutral-900 border border-neutral-800 p-2 flex items-center justify-center text-indigo-400 shrink-0">
                        {isAdmin ? (
                          <Shield className="h-5 w-5 text-purple-400" />
                        ) : (
                          <Layers className="h-5 w-5 text-emerald-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-900 pt-2 text-xs text-neutral-400">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => handleCopy(e, item)}
                        className="flex items-center gap-1 hover:text-white transition"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDownload(e, item)}
                        className="flex items-center gap-1 hover:text-white transition ml-2"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                        }}
                        className="text-neutral-500 hover:text-red-400 transition"
                        title="Delete record"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      <span className="flex items-center gap-0.5 text-indigo-400 font-medium group-hover:translate-x-0.5 transition">
                        Load <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
