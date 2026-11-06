'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, FileText, CheckCircle2, AlertTriangle, Shield, Coins, LifeBuoy } from 'lucide-react';
import { Footer } from '@/components/Footer';
import { fetchAppConfig, getGenerationsPerUnlock } from '@/lib/app-config';
import { useI18n } from '@/lib/i18n';

export default function TermsOfServicePage() {
  const { t } = useI18n();
  const [generationsPerUnlock, setGenerationsPerUnlock] = React.useState(getGenerationsPerUnlock());

  React.useEffect(() => {
    let active = true;
    fetchAppConfig()
      .catch(() => null)
      .finally(() => {
        if (active) setGenerationsPerUnlock(getGenerationsPerUnlock());
      });
    return () => {
      active = false;
    };
  }, []);

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
            <img src="/icon.svg" alt="pathify logo" className="h-6 w-6 rounded-md group-hover:scale-105 transition-transform" />
            <span className="font-bold text-sm tracking-tight text-white group-hover:text-indigo-200 transition-colors">pathify</span>
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
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300 mb-6">
          <Scale className="h-4 w-4" />
          <span>{t('legal.terms.badge')}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          {t('legal.terms.title')}
        </h1>
        <p className="text-sm text-neutral-400 mb-8">
          {t('legal.terms.lastRevised')}
        </p>

        {/* Ownership Guarantee Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 mb-10 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-1.5">
                {t('legal.terms.ownershipTitle')}
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                {t('legal.terms.ownershipBody')}
              </p>
            </div>
          </div>
        </div>

        {/* Terms Sections */}
        <div className="space-y-10 text-sm text-neutral-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <FileText className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.terms.s1Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.terms.s1Body')}
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Coins className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.terms.s2Title')}</h3>
            </div>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>
                {t('legal.terms.s2Intro')}
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-neutral-200">{t('legal.terms.s2FreeLabel')}</strong>{t('legal.terms.s2FreeBody')}
                </li>
                <li>
                  <strong className="text-neutral-200">{t('legal.terms.s2CreditsLabel')}</strong>{t('legal.terms.s2CreditsBody', { count: generationsPerUnlock })}
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Shield className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.terms.s3Title')}</h3>
            </div>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>
                {t('legal.terms.s3Intro')}
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-neutral-200">{t('legal.terms.s3NonRefundableLabel')}</strong>{t('legal.terms.s3NonRefundableBody')}
                </li>
                <li>
                  <strong className="text-neutral-200">{t('legal.terms.s3OnchainLabel')}</strong>{t('legal.terms.s3OnchainBody')}
                </li>
                <li>
                  <strong className="text-neutral-200">{t('legal.terms.s3TrackingLabel')}</strong>{t('legal.terms.s3TrackingBody')}
                </li>
                <li>
                  <strong className="text-neutral-200">{t('legal.terms.s3GasLabel')}</strong>{t('legal.terms.s3GasBody')}
                </li>
                <li>
                  <strong className="text-neutral-200">{t('legal.terms.s3MissingLabel')}</strong>{t('legal.terms.s3MissingPrefix')}
                  <Link href="/support?category=crypto_transaction" className="text-indigo-400 underline underline-offset-4">
                    {t('legal.terms.s3MissingLink')}
                  </Link>
                  {t('legal.terms.s3MissingSuffix')}
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <AlertTriangle className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.terms.s4Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.terms.s4Intro')}
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-neutral-400">
              <li>{t('legal.terms.s4Li1')}</li>
              <li>{t('legal.terms.s4Li2')}</li>
              <li>{t('legal.terms.s4Li3')}</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Scale className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.terms.s5Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.terms.s5Body')}
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <LifeBuoy className="h-4 w-4 text-indigo-400" />
              <h3>{t('legal.terms.s6Title')}</h3>
            </div>
            <p className="text-xs text-neutral-400">
              {t('legal.terms.s6Prefix')}
              <Link href="/support" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
                {t('legal.terms.s6Link')}
              </Link>
              {t('legal.terms.s6Suffix')}
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}