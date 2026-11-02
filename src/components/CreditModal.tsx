'use client';

import React, { useState } from 'react';
import { X, Check, Wallet, AlertCircle, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';
import { updateUserCredits } from '../lib/firebase/firestore';
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
import { useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredReason?: string;
}

export function CreditModal({ isOpen, onClose, requiredReason }: CreditModalProps) {
  const { user, profile, refreshProfile } = useAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBuyCredits = async (amountCredits: number, ethCost: string) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (!user || user.isAnonymous) {
        throw new Error('Please sign in with Google first so your purchased credits are saved to your account.');
      }

      if (!isConnected) {
        open();
        setLoading(false);
        return;
      }

      // Web3 Transaction
      try {
        await sendTransactionAsync({
          to: '0x000000000000000000000000000000000000dEaD',
          value: parseEther(ethCost),
        });
      } catch (txErr: unknown) {
        const msg = txErr instanceof Error ? txErr.message : String(txErr);
        if (msg.includes('rejected') || msg.includes('denied')) {
          throw new Error('Transaction was cancelled in your wallet.');
        }
      }

      // Update Firestore user document with purchased credits
      const currentCredits = profile?.credits ?? 0;
      const newCredits = currentCredits + amountCredits;
      await updateUserCredits(user.uid, newCredits);
      await refreshProfile();

      setSuccessMsg(`🎉 Successfully purchased ${amountCredits} credits via Web3!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  const currentCredits = profile?.credits ?? 0;
  const isAdmin = profile?.isAdmin ?? false;
  const isSubscribed = profile?.subscription?.status === 'active';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons.svg"
              alt="vectorizerr"
              className="h-9 w-9 rounded-xl border border-neutral-700/80 bg-neutral-950 p-1 object-contain"
            />
            <div>
              <h2 className="text-base font-semibold text-white">vectorizerr Credits</h2>
              <p className="text-xs text-neutral-400">
                Purchase pay-as-you-go credits via WalletConnect
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

        {/* Reason Banner if triggered by download attempt */}
        {requiredReason && (
          <div className="my-3 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{requiredReason}</span>
          </div>
        )}

        {/* Current status bar */}
        <div className="my-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-neutral-400">Your Current Status</span>
            <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
              {isAdmin ? (
                <span className="flex items-center gap-1.5 text-purple-400">
                  <Shield className="h-4 w-4" /> Admin (Full SVG Access)
                </span>
              ) : isSubscribed ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <Sparkles className="h-4 w-4" /> Active Subscription (Unlimited)
                </span>
              ) : (
                <span>{currentCredits} Credits Available</span>
              )}
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              1 credit unlocks 1 full SVG vector download &amp; raw code export.
            </p>
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

        {/* Credit Purchase Packs */}
        <div className="grid grid-cols-3 gap-3 my-4">
          {/* Starter Pack */}
          <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5 hover:border-neutral-700 transition text-center">
            <span className="text-[11px] font-medium text-neutral-400">Starter</span>
            <div className="text-xl font-bold text-white mt-1">25 Credits</div>
            <span className="text-xs text-neutral-400 mt-0.5">0.0005 ETH</span>
            <button
              disabled={loading || isAdmin || isSubscribed}
              onClick={() => handleBuyCredits(25, '0.0005')}
              className="mt-4 w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white py-1.5 transition disabled:opacity-40"
            >
              Buy
            </button>
          </div>

          {/* Popular Pack */}
          <div className="flex flex-col rounded-xl border border-indigo-500/50 bg-indigo-500/10 p-3.5 relative overflow-hidden text-center shadow-lg">
            <span className="absolute top-1.5 right-1.5 rounded-full bg-indigo-500 px-1.5 py-0.2 text-[9px] font-bold text-white">
              HOT
            </span>
            <span className="text-[11px] font-medium text-indigo-300">Pro Pack</span>
            <div className="text-xl font-bold text-white mt-1">100 Credits</div>
            <span className="text-xs text-indigo-200 mt-0.5">0.0015 ETH</span>
            <button
              disabled={loading || isAdmin || isSubscribed}
              onClick={() => handleBuyCredits(100, '0.0015')}
              className="mt-4 w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white py-1.5 transition disabled:opacity-40 shadow-sm"
            >
              Buy
            </button>
          </div>

          {/* Studio Pack */}
          <div className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-950/60 p-3.5 hover:border-neutral-700 transition text-center">
            <span className="text-[11px] font-medium text-neutral-400">Studio</span>
            <div className="text-xl font-bold text-white mt-1">500 Credits</div>
            <span className="text-xs text-neutral-400 mt-0.5">0.005 ETH</span>
            <button
              disabled={loading || isAdmin || isSubscribed}
              onClick={() => handleBuyCredits(500, '0.005')}
              className="mt-4 w-full rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white py-1.5 transition disabled:opacity-40"
            >
              Buy
            </button>
          </div>
        </div>

        {/* Subscription Structure Prepared Notice */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-3 flex items-center justify-between text-xs text-neutral-400">
          <div>
            <span className="font-semibold text-neutral-300">Subscriptions coming soon</span>
            <p className="text-[11px] text-neutral-500">
              Unlimited monthly &amp; team plans will be available soon.
            </p>
          </div>
          <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] text-neutral-400 font-medium">
            Prepared
          </span>
        </div>
      </div>
    </div>
  );
}
