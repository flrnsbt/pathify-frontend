'use client';

import React, { useState } from 'react';
import {
  X,
  LogOut,
  AlertCircle,
  Shield,
  Coins,
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';
import { useI18n } from '../lib/i18n';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCredits?: () => void;
}

export function AuthModal({ isOpen, onClose, onOpenCredits }: AuthModalProps) {
  const { user, profile, isConfigured, loginWithGoogle, loginWithGithub, logout, refreshProfile } = useAuth();
  const { t } = useI18n();
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const loading = loadingProvider !== null;

  const handleLogin = async (provider: 'google' | 'github') => {
    setError(null);
    setLoadingProvider(provider);
    try {
      if (provider === 'google') {
        await loginWithGoogle();
      } else {
        await loginWithGithub();
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoadingProvider(null);
    }
  };

  const isAdmin = profile?.isAdmin ?? false;
  const isSubscribed = profile?.subscription?.status === 'active';
  const credits = profile?.credits ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/95 p-6 sm:p-7 shadow-2xl shadow-indigo-500/10">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute -top-24 -left-20 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-56 rounded-full bg-purple-500/15 blur-3xl" />

        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label={t('modals.auth.closeDialog')}
          className="absolute right-4 top-4 rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* App Branding & Logo */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 group">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#4174f7] via-[#9159fb] to-[#fccc4b] opacity-40 blur transition group-hover:opacity-60" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="pathify placeholder logo"
              className="relative h-16 w-16 rounded-2xl border border-white/10 bg-neutral-950 shadow-xl object-contain"
            />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            pathify
          </h2>
          <p className="mt-1 text-xs text-neutral-400 max-w-xs">
            {t('modals.auth.tagline')}
          </p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="flex-1 leading-snug">{error}</span>
          </div>
        )}

        {/* Authenticated View */}
        {user && !user.isAnonymous ? (
          <div className="mt-6 space-y-4">
            {/* User Profile Card */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4 space-y-3">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-11 w-11 rounded-full border border-neutral-700 object-cover"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-sm shadow-inner">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {user.displayName || t('modals.auth.account')}
                    </span>
                    {isAdmin && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                        {t('modals.auth.admin')}
                      </span>
                    )}
                    {!isAdmin && isSubscribed && (
                      <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-400 border border-purple-500/20">
                        {t('modals.auth.activePro')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                </div>
              </div>

              {/* Account Stats & Credits */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                <div className="rounded-xl bg-neutral-900/60 p-2.5 border border-neutral-800">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Coins className="h-3 w-3 text-amber-400" /> {t('modals.auth.availableCredits')}
                  </span>
                  <div className="text-base font-bold text-white mt-0.5">
                    {credits} <span className="text-xs font-normal text-neutral-400">{t('modals.auth.credits')}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-neutral-900/60 p-2.5 border border-neutral-800">
                  <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                    <Shield className="h-3 w-3 text-indigo-400" /> {t('modals.auth.accountTier')}
                  </span>
                  <div className="text-base font-bold text-white mt-0.5 capitalize">
                    {isAdmin ? t('modals.auth.tierAdmin') : isSubscribed ? t('modals.auth.tierPro') : t('modals.auth.tierPayg')}
                  </div>
                </div>
              </div>

              {profile?.walletAddress && (
                <div className="rounded-xl bg-neutral-900/40 p-2 border border-neutral-800/60 text-[11px] font-mono text-neutral-400 truncate">
                  <span className="text-neutral-500">{t('modals.auth.linkedWallet')}</span> {profile.walletAddress}
                </div>
              )}
            </div>

            {/* Top up credits action if requested */}
            {onOpenCredits && !isAdmin && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCredits();
                }}
                className="flex w-full items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span>{t('modals.auth.getCredits')}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-indigo-400" />
              </button>
            )}

            {/* Sign Out Button */}
            <button
              onClick={async () => {
                await logout();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-800/60 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-neutral-800 hover:text-white transition"
            >
              <LogOut className="h-4 w-4" />
              <span>{t('modals.auth.signOut')}</span>
            </button>
          </div>
        ) : (
          /* Unauthenticated / Sign-in state */
          <div className="mt-6 space-y-5">
            {/* Value propositions */}
            <div className="rounded-2xl border border-neutral-800/90 bg-neutral-950/60 p-4 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-neutral-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                <span>
                  <strong>{t('modals.auth.valueFidelityStrong')}</strong>{t('modals.auth.valueFidelityRest')}
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-neutral-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                <span>
                  <strong>{t('modals.auth.valueHistoryStrong')}</strong>{t('modals.auth.valueHistoryRest')}
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-neutral-300">
                <Lock className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  <strong>{t('modals.auth.valuePrivacyStrong')}</strong>{t('modals.auth.valuePrivacyRest')}
                </span>
              </div>
            </div>

            {/* Google Sign In Call to Action Button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('google')}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border border-neutral-700 bg-neutral-800 py-3.5 px-4 text-sm font-semibold text-white shadow-xl transition-all hover:bg-neutral-750 hover:border-neutral-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingProvider === 'google' ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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
              <span>{loadingProvider === 'google' ? t('modals.auth.connectingGoogle') : t('modals.auth.continueGoogle')}</span>
            </button>

            {/* GitHub Sign In Button */}
            <button
              type="button"
              disabled={loading}
              onClick={() => handleLogin('github')}
              className="group relative flex w-full items-center justify-center gap-3 rounded-2xl border border-neutral-700 bg-neutral-800 py-3.5 px-4 text-sm font-semibold text-white shadow-xl transition-all hover:bg-neutral-750 hover:border-neutral-500 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingProvider === 'github' ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              )}
              <span>{loadingProvider === 'github' ? t('modals.auth.connectingGithub') : t('modals.auth.continueGithub')}</span>
            </button>

            {/* Note */}
            <p className="text-center text-[11px] text-neutral-500 leading-normal">
              {!isConfigured && (
                <span className="text-amber-400 block mb-1">
                  {t('modals.auth.demoMode')}
                </span>
              )}
              {t('modals.auth.agreePrefix')} <a href="/terms" className="underline hover:text-indigo-400">{t('modals.auth.terms')}</a> {t('modals.auth.and')} <a href="/privacy" className="underline hover:text-indigo-400">{t('modals.auth.privacy')}</a>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
