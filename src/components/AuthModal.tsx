'use client';

import React, { useState } from 'react';
import { X, User, LogOut, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, profile, isConfigured, loginWithGoogle, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {user && !user.isAnonymous ? 'Account Profile' : 'Sign In with Google'}
              </h2>
              <p className="text-xs text-neutral-400">
                {isConfigured ? 'Sync history & credits with Google' : 'Local / Demo Firebase Mode Active'}
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

        {error && (
          <div className="my-3 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* If user is logged in with Google */}
        {user && !user.isAnonymous ? (
          <div className="my-5 space-y-4">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-10 w-10 rounded-full border border-neutral-700"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-semibold text-sm">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">
                    {user.displayName || 'Google User'}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                </div>
              </div>

              <div className="border-t border-neutral-850 pt-2 space-y-1">
                <div className="text-[11px] font-mono text-neutral-500 truncate">
                  UID: {user.uid}
                </div>
                {profile?.walletAddress && (
                  <div className="text-[11px] font-mono text-indigo-400 truncate">
                    Linked Wallet: {profile.walletAddress}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={async () => {
                await logout();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-800/80 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 hover:text-white transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          /* Google Sign In Call to Action */
          <div className="my-6 space-y-4">
            <p className="text-xs text-neutral-300 leading-relaxed">
              Sign in with your Google account to automatically preserve and synchronize your traced SVG vector history across devices and link your credits.
            </p>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-neutral-700 bg-neutral-800/90 py-3 text-sm font-semibold text-white hover:bg-neutral-800 hover:border-neutral-600 transition shadow-lg"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>{loading ? 'Signing in with Google...' : 'Continue with Google'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
