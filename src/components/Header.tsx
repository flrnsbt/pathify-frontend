'use client';

import React from 'react';
import { Sparkles, History, Wallet, User as UserIcon, Coins, Shield } from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';

interface HeaderProps {
  onOpenHistory: () => void;
  onOpenAuth: () => void;
  onOpenCredits: () => void;
  historyCount: number;
}

export function Header({
  onOpenHistory,
  onOpenAuth,
  onOpenCredits,
  historyCount,
}: HeaderProps) {
  const { user, profile } = useAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();

  const credits = profile?.credits ?? 0;
  const isAdmin = profile?.isAdmin ?? false;
  const isSubscribed = profile?.subscription?.status === 'active';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons.svg"
            alt="vectorizerr logo"
            className="h-10 w-10 rounded-xl shadow-lg shadow-indigo-500/20 object-contain hover:scale-105 transition-transform"
          />
          <div>
            <span className="font-bold tracking-tight text-white text-lg bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              vectorizerr
            </span>
            <p className="hidden sm:block text-xs text-neutral-400">
              Raster to SVG Vectorizer
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
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

          {/* Credits Badge / Buy Credits */}
          <button
            onClick={onOpenCredits}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              isAdmin
                ? 'border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                : isSubscribed
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            {isAdmin ? (
              <>
                <Shield className="h-4 w-4 text-purple-400" />
                <span>Admin Pass</span>
              </>
            ) : isSubscribed ? (
              <>
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Subscribed</span>
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 text-amber-400" />
                <span>{credits} Credits</span>
                <span className="hidden sm:inline text-amber-400/80 font-bold">+</span>
              </>
            )}
          </button>

          {/* Web3 Connect Wallet for Crypto Payment */}
          <button
            onClick={() => open()}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-blue-500 hover:to-indigo-500 transition"
          >
            <Wallet className="h-4 w-4 text-white" />
            <span className="hidden sm:inline">
              {isConnected && address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : 'Pay with Crypto'}
            </span>
          </button>

          {/* Google Auth Button */}
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
