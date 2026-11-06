'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Clock, Key, FileCheck, LifeBuoy } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { useI18n } from '@/lib/i18n';

export default function PrivacyPolicyPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{t('legal.common.backToVectorizer')}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 group transition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="vectorizerr logo" className="h-6 w-6 rounded-md group-hover:scale-105 transition-transform" />
            <span className="font-bold text-sm tracking-tight text-white group-hover:text-indigo-200 transition-colors">vectorizerr</span>
          </Link>
          <Link
            href="/support"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white transition"
          >
            <LifeBuoy className="h-3.5 w-3.5 text-neutral-400" />
            <span>{t('legal.common.support')}</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        {/* Hero badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300 mb-6">
          <ShieldCheck className="h-4 w-4" />
          <span>{t('legal.privacy.badge')}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          {t('legal.privacy.title')}
        </h1>
        <p className="text-sm text-neutral-400 mb-8">
          {t('legal.privacy.lastRevised')}
        </p>

        {/* Highlight Card */}
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-neutral-900/60 to-purple-950/30 p-6 mb-10 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-indigo-500/20 p-3 text-indigo-400 shrink-0">
              <EyeOff className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-1.5">
                {t('legal.privacy.coreTitle')}
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {t('legal.privacy.coreBody')}<strong>{t('legal.privacy.coreStrong')}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-10 text-sm text-neutral-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Clock className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.privacy.s1Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.privacy.s1Body')}
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <EyeOff className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.privacy.s2Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.privacy.s2Body')}
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <FileCheck className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.privacy.s3Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.privacy.s3Intro')}
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs text-neutral-400">
              <li>
                <strong className="text-neutral-200">{t('legal.privacy.liCredsLabel')}</strong>{t('legal.privacy.liCredsBody')}
              </li>
              <li>
                <strong className="text-neutral-200">{t('legal.privacy.liFingerprintLabel')}</strong>{t('legal.privacy.liFingerprintBody')}
              </li>
              <li>
                <strong className="text-neutral-200">{t('legal.privacy.liHistoryLabel')}</strong>{t('legal.privacy.liHistoryA')}<code className="text-neutral-300 font-mono">users/{'{userId}'}/history</code>{t('legal.privacy.liHistoryB')}<code className="text-neutral-300 font-mono">generations</code>{t('legal.privacy.liHistoryC')}
              </li>
              <li>
                <strong className="text-neutral-200">{t('legal.privacy.liPaymentLabel')}</strong>{t('legal.privacy.liPaymentBody')}
              </li>
              <li>
                <strong className="text-neutral-200">{t('legal.privacy.liSecurityLabel')}</strong>{t('legal.privacy.liSecurityBody')}
              </li>
            </ul>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Lock className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.privacy.s4Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.privacy.s4Body')}
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Key className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.privacy.s5Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.privacy.s5Body')}
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.privacy.s6Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.privacy.s6Body')}
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <LifeBuoy className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.privacy.s7Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.privacy.s7Prefix')}
              <Link href="/support" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
                {t('legal.privacy.s7Link')}
              </Link>
              {t('legal.privacy.s7Suffix')}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}