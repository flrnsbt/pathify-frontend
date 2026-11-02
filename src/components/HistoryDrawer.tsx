'use client';

import React from 'react';
import { X, Clock, Layers, Download, Trash2, ArrowUpRight, Copy, Check, Lock, Shield } from 'lucide-react';
import { VectorizationHistoryItem } from '../lib/firebase/firestore';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: VectorizationHistoryItem[];
  onSelect: (item: VectorizationHistoryItem) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
  isSubscribed: boolean;
  unlockedSvgIds: string[];
  onRequestUnlock: (item: VectorizationHistoryItem) => void;
}

export function HistoryDrawer({
  isOpen,
  onClose,
  items,
  onSelect,
  onDelete,
  isAdmin,
  isSubscribed,
  unlockedSvgIds,
  onRequestUnlock,
}: HistoryDrawerProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const isItemAccessible = (item: VectorizationHistoryItem) => {
    return isAdmin || isSubscribed || unlockedSvgIds.includes(item.id);
  };

  const handleCopy = (e: React.MouseEvent, item: VectorizationHistoryItem) => {
    e.stopPropagation();
    if (!isItemAccessible(item)) {
      onRequestUnlock(item);
      return;
    }
    navigator.clipboard.writeText(item.svg);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownload = (e: React.MouseEvent, item: VectorizationHistoryItem) => {
    e.stopPropagation();
    if (!isItemAccessible(item)) {
      onRequestUnlock(item);
      return;
    }
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
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
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
                Vectorized outputs are automatically saved to your history.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const accessible = isItemAccessible(item);
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
                        {accessible ? (
                          <span className="rounded bg-emerald-500/20 px-1 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                            UNLOCKED
                          </span>
                        ) : (
                          <span className="flex items-center gap-0.5 rounded bg-amber-500/10 px-1 py-0.2 text-[9px] font-bold text-amber-400 border border-amber-500/20">
                            <Lock className="h-2.5 w-2.5" /> LOCKED
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                        <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{item.nodeCount} paths</span>
                        <span>•</span>
                        <span>{item.executionTimeMs} ms</span>
                      </div>
                    </div>

                    {/* Thumbnail of original image (stored compressed) or fallback icon */}
                    {item.originalBase64 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.originalBase64}
                        alt="Thumbnail"
                        className="h-11 w-11 rounded-lg border border-neutral-800 object-cover shrink-0"
                      />
                    ) : (
                      <div className="h-11 w-11 rounded-lg bg-neutral-900 border border-neutral-800 p-2 flex items-center justify-center text-indigo-400 shrink-0">
                        {isAdmin ? (
                          <Shield className="h-5 w-5 text-purple-400" />
                        ) : accessible ? (
                          <Layers className="h-5 w-5 text-emerald-400" />
                        ) : (
                          <Lock className="h-5 w-5 text-amber-400" />
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
                        {accessible ? (
                          copiedId === item.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <span>{copiedId === item.id ? 'Copied' : accessible ? 'Copy' : 'Unlock Code'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDownload(e, item)}
                        className="flex items-center gap-1 hover:text-white transition ml-2"
                      >
                        {accessible ? (
                          <Download className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5 text-amber-400" />
                        )}
                        <span>{accessible ? 'Download' : 'Unlock SVG'}</span>
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
