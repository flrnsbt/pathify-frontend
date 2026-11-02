'use client';

import React, { useState } from 'react';
import { X, Sparkles, Check, Wallet, Zap, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';
import { updateUserCredits } from '../lib/firebase/firestore';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreditModal({ isOpen, onClose }: CreditModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePurchase = async (type: 'credits' | 'pro', ethAmount: string, creditDelta: number) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!user) {
        throw new Error('Please sign in or continue as guest to purchase credits.');
      }

      if (!isConnected) {
        open();
        setLoading(false);
        return;
      }

      // Execute Web3 transaction
      try {
        await sendTransactionAsync({
          to: '0x000000000000000000000000000000000000dEaD',
          value: parseEther(ethAmount),
        });
      } catch (txErr: unknown) {
        console.warn('Web3 transaction rejected or simulated in test mode:', txErr);
        // If user cancelled, rethrow
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        if (msg.includes('rejected') || msg.includes('denied')) {
          throw new Error('Transaction was rejected by the wallet.');
        }
      }

      // Update Firestore user document
      const currentCredits = profile?.credits ?? 10;
      const newCredits = currentCredits + creditDelta;
      const isPro = type === 'pro' ? true : profile?.isPro ?? false;

      await updateUserCredits(user.uid, newCredits, isPro);
      await refreshProfile();

      setSuccessMsg(
        type === 'pro'
          ? '🎉 Pro Membership unlocked successfully! Unlimited 4K+ tracing enabled.'
          : `🎉 Successfully purchased ${creditDelta} credits!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">VTracer Credits & Pro Tier</h2>
              <p className="text-xs text-neutral-400">
                Unlock high-resolution processing and high-precision curve tracing
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current status */}
        <div className="my-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-400">Current Balance</span>
            <div className="text-xl font-bold text-white flex items-center gap-2">
              {profile?.isPro ? 'PRO Unlimited' : `${profile?.credits ?? 10} Credits`}
              {profile?.isPro && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400 font-semibold border border-emerald-500/30">
                  Active
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => open()}
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white transition"
          >
            <Wallet className="h-3.5 w-3.5 text-indigo-400" />
            <span>
              {isConnected && address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : 'Connect Wallet'}
            </span>
          </button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">
            <Check className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Purchase Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Option 1: Credit Pack */}
          <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/60 p-4 hover:border-neutral-700 transition">
            <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Starter Pack
            </div>
            <div className="mt-2 text-2xl font-bold text-white">+50 Credits</div>
            <p className="mt-1 text-xs text-neutral-400">0.001 ETH / MATIC</p>
            <ul className="my-4 space-y-1.5 text-xs text-neutral-300 flex-1">
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-indigo-400" />
                <span>50 Standard Vectorizations</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-indigo-400" />
                <span>SVG code & download</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-indigo-400" />
                <span>Cloud history sync</span>
              </li>
            </ul>
            <button
              disabled={loading}
              onClick={() => handlePurchase('credits', '0.001', 50)}
              className="mt-auto w-full rounded-xl border border-indigo-500/30 bg-indigo-600/20 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600 hover:text-white transition disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Buy with Web3'}
            </button>
          </div>

          {/* Option 2: Pro Tier */}
          <div className="flex flex-col rounded-xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2 rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300">
              POPULAR
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Pro Lifetime
            </div>
            <div className="mt-2 text-2xl font-bold text-white">Unlimited</div>
            <p className="mt-1 text-xs text-amber-300/80">0.005 ETH / MATIC</p>
            <ul className="my-4 space-y-1.5 text-xs text-neutral-200 flex-1">
              <li className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                <span>Unlimited Vectorizations</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-amber-400" />
                <span>4K+ Ultra High Resolution</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-amber-400" />
                <span>Max precision & spline fitting</span>
              </li>
            </ul>
            <button
              disabled={loading || profile?.isPro}
              onClick={() => handlePurchase('pro', '0.005', 1000)}
              className="mt-auto w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-2 text-xs font-semibold text-neutral-950 hover:from-amber-400 hover:to-orange-400 transition disabled:opacity-50 shadow-md shadow-amber-500/20"
            >
              {profile?.isPro ? 'Pro Already Active' : loading ? 'Processing...' : 'Unlock Pro Lifetime'}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-neutral-500">
          Transactions are signed directly via your connected Web3 wallet (Ethereum, Base, Polygon, Arbitrum, Sepolia).
        </p>
      </div>
    </div>
  );
}
