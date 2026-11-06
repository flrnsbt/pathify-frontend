'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, History, User as UserIcon, Coins, Shield, ReceiptText, LifeBuoy, Wallet, LogOut, Database, ChevronDown, Languages, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';
import { clearLocalAppData } from '../lib/local-source-images';
import { useAppKitAccount } from '@reown/appkit/react';
import { useDisconnect } from '@reown/appkit/react';
import { useI18n, SUPPORTED_LOCALES, LOCALE_NAMES, LOCALE_FLAGS } from '../lib/i18n';

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
  const { user, profile, logout } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [dataCleared, setDataCleared] = useState(false);

  const shortAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '';

  const credits = profile?.credits ?? 0;
  const isAdmin = (profile?.isAdmin ?? false);
  const isSubscribed = profile?.subscription?.status === 'active';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.svg"
            alt="vectorizerr logo"
            className="h-10 w-10 rounded-xl shadow-lg shadow-indigo-500/20 object-contain hover:scale-105 transition-transform"
          />
          <div>
            <span className="font-bold tracking-tight text-white text-lg bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
              vectorizerr
            </span>
            <p className="hidden sm:block text-xs text-neutral-400">
              {t('header.brandTagline')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* History Button — account-scoped, signed-in users only */}
          {user && (
          <button
            onClick={onOpenHistory}
            className="relative flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 transition"
          >
            <History className="h-4 w-4 text-neutral-400" />
            <span className="hidden sm:inline">{t('header.history')}</span>
            {historyCount > 0 && (
              <span className="ml-1 rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {historyCount}
              </span>
            )}
          </button>
          )}

          {/* Support Link */}
          <Link
            href="/support"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 transition"
            title={t('header.support')}
          >
            <LifeBuoy className="h-4 w-4 text-neutral-400" />
            <span className="hidden lg:inline">{t('header.support')}</span>
          </Link>

          {/* Credits Badge / Buy Credits */}
          <button
            onClick={onOpenCredits}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${isAdmin
                ? 'border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
                : isSubscribed
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-500/50'
              }`}
          >
            {isAdmin ? (
              <>
                <Shield className="h-4 w-4 text-purple-400" />
                <span>{t('header.adminPass')}</span>
              </>
            ) : isSubscribed ? (
              <>
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>{t('header.subscribed')}</span>
              </>
            ) : (
              <>
                <Coins className="h-4 w-4 text-amber-400" />
                <span className="font-semibold">{credits}</span>
                <span className="text-neutral-400">{t('header.credits')}</span>
                <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-bold text-amber-300">
                  {t('header.buy')}
                </span>
              </>
            )}
          </button>

          {/* Wallet Connection Indicator - only shown when a wallet is connected */}
          {isConnected && (
            <div className="group relative flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                <span className="font-mono text-emerald-300 hidden lg:inline">{shortAddress}</span>
              </div>
              <button
                onClick={() => disconnect()}
                className="ml-1 rounded px-1 py-0.5 text-[10px] font-bold text-emerald-400/60 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100"
                title={t('header.disconnectWallet')}
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 transition"
              title={t('header.language')}
              aria-label={t('header.language')}
            >
              <Languages className="h-4 w-4 text-neutral-400" />
              <span className="hidden sm:inline font-mono uppercase">{locale}</span>
            </button>
            {langMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-40 rounded-xl border border-neutral-800 bg-neutral-950 py-1 shadow-2xl">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    {t('header.language')}
                  </div>
                  {SUPPORTED_LOCALES.map((code) => (
                    <button
                      key={code}
                      onClick={() => {
                        setLocale(code);
                        setLangMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-xs transition ${
                        locale === code
                          ? 'bg-indigo-500/10 text-indigo-300'
                          : 'text-neutral-300 hover:bg-neutral-900'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span aria-hidden="true">{LOCALE_FLAGS[code] ?? ''}</span>
                        {LOCALE_NAMES[code] ?? code}
                      </span>
                      {locale === code && <span className="text-indigo-400">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Account Button + Menu */}
          <div className="relative">
            <button
              onClick={() => {
                if (user && !user.isAnonymous) {
                  setAccountMenuOpen((v) => !v);
                } else {
                  onOpenAuth();
                }
              }}
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
                  ? user.displayName || user.email || t('header.account')
                  : t('header.signIn')}
              </span>
              {user && !user.isAnonymous && (
                <ChevronDown className="h-3 w-3 text-neutral-500" />
              )}
            </button>

            {accountMenuOpen && user && !user.isAnonymous && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setAccountMenuOpen(false)}
                />
                <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-neutral-800 bg-neutral-950 py-1 shadow-2xl">
                  <button
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onOpenAuth();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 transition"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-neutral-500" />
                    {t('header.account')}
                  </button>
                  <Link
                    href="/transactions"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 transition"
                  >
                    <ReceiptText className="h-3.5 w-3.5 text-neutral-500" />
                    {t('header.transactions')}
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setAccountMenuOpen(false)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 transition"
                    >
                      <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                      {t('admin.title')}
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      if (
                        window.confirm(t('header.clearLocalDataConfirm'))
                      ) {
                        clearLocalAppData();
                        setDataCleared(true);
                        setTimeout(() => setDataCleared(false), 2500);
                      }
                      setAccountMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-neutral-300 hover:bg-neutral-900 transition"
                  >
                    <Database className="h-3.5 w-3.5 text-neutral-500" />
                    {dataCleared ? t('header.localDataCleared') : t('header.clearLocalData')}
                  </button>
                  <button
                    onClick={async () => {
                      setAccountMenuOpen(false);
                      await logout();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-400/90 hover:bg-neutral-900 transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    {t('header.signOut')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
