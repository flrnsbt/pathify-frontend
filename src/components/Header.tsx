'use client';

import React from 'react';
import { Layers, Sparkles, History, Wallet, User as UserIcon, Coins, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenAuth: () => void;
  onOpenCredits: () => void;
  onOpenAudit: () => void;
  historyCount: number;
}

export function Header({
  onOpenHistory,
  onOpenAuth,
  onOpenCredits,
  onOpenAudit,
  historyCount,
}: HeaderProps) {
  const { user, profile } = useAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const credits = profile?.credits ?? 10;
  const isPro = profile?.isPro ?? false;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-md shadow-purple-500/20">
            <Layers className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-lg">VTracer</span>
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-semibold text-indigo-400 border border-indigo-500/30">
                WASM Studio
              </span>
            </div>
            <p className="hidden sm:block text-xs text-neutral-400">
              Raster to SVG Vectorizer powered by Rust WebAssembly
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Performance Audit Tool */}
          <button
            onClick={onOpenAudit}
            title="Performance & 4K Stress Test Audit"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 transition"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="hidden md:inline">Stress Test</span>
          </button>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="relative flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 transition"
          >
            <History className="h-4 w-4 text-neutral-400" />
            <span className="hidden sm:inline">History</span>
            {historyCount > 0 && (
              <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {historyCount}
              </span>
            )}
          </button>

          {/* Credits Badge / Upgrade */}
          <button
            onClick={onOpenCredits}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 transition"
          >
            <Coins className="h-4 w-4 text-amber-400" />
            <span>{isPro ? 'PRO Unlimited' : `${credits} Credits`}</span>
            {!isPro && <Sparkles className="h-3 w-3 text-amber-400" />}
          </button>

          {/* Web3 Connect Wallet */}
          <button
            onClick={() => open()}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-blue-500 hover:to-indigo-500 transition"
          >
            <Wallet className="h-4 w-4 text-white" />
            <span className="hidden sm:inline">
              {isConnected && address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : 'Connect Wallet'}
            </span>
          </button>

          {/* Auth Button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800 transition"
          >
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="h-4 w-4 rounded-full"
              />
            ) : (
              <UserIcon className="h-4 w-4 text-neutral-400" />
            )}
            <span className="hidden md:inline">
              {user && !user.isAnonymous
                ? user.displayName || user.email || 'Google User'
                : 'Sign In with Google'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
