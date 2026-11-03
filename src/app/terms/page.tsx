'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Scale, FileText, CheckCircle2, AlertTriangle, Shield, Coins, LifeBuoy } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function TermsOfServicePage() {
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
            <span>Back to Vectorizer</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="vectorizerr logo" className="h-6 w-6 rounded-md" />
            <span className="font-bold text-sm tracking-tight text-white">vectorizerr</span>
          </div>
          <Link
            href="/support"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white transition"
          >
            <LifeBuoy className="h-3.5 w-3.5 text-neutral-400" />
            <span>Support</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300 mb-6">
          <Scale className="h-4 w-4" />
          <span>Legal Agreement & Terms of Service</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          Conditions of Use & Terms of Service
        </h1>
        <p className="text-sm text-neutral-400 mb-8">
          Last revised: November 2026 &bull; Please review these terms carefully before accessing or utilizing Vectorizerr services.
        </p>

        {/* Ownership Guarantee Card */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 mb-10 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-1.5">
                100% User Ownership of Generated Vectors
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                You retain complete, unrestricted ownership, copyright, and commercial licensing rights over all images you convert and all vector SVG files you produce with Vectorizerr. We claim zero proprietary rights, royalties, or licensing over your creations.
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
              <h3>1. Acceptance of Terms</h3>
            </div>
            <p className="text-xs text-neutral-400">
              By accessing Vectorizerr at <code className="text-neutral-300 font-mono">vectorizerr.pages.dev</code> or associated endpoints, you agree to comply with and be bound by these Conditions of Use and our Privacy Policy. If you do not agree to these terms, please do not use the application.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Coins className="h-4 w-4 text-indigo-400" />
              <h3>2. Services, Free Features & Credits Quotas</h3>
            </div>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>
                Vectorizerr offers both free and credit-based capabilities:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong className="text-neutral-200">Free Previews & Raster Downloads:</strong> High-resolution vectorization preview, split-screen comparison, and exports to PNG or WebP formats are completely free and do not require user login or credit consumption.
                </li>
                <li>
                  <strong className="text-neutral-200">SVG Unlocks & Quotas:</strong> Exporting raw, scalable, lossless SVG files requires credits or an active plan. Unlocking an image with 1 credit grants a quota of up to 10 vector re-generations on that image hash, allowing you to fine-tune presets and parameters without redundant charges.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Shield className="h-4 w-4 text-indigo-400" />
              <h3>3. Cryptocurrency Payments & Non-Custodial Transactions</h3>
            </div>
            <div className="space-y-2 text-xs text-neutral-400">
              <p>
                When purchasing credits via Web3 wallet or direct cryptocurrency transfers:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>On-Chain Confirmations:</strong> Transactions are processed on public decentralized blockchains (BNB Smart Chain, Ethereum, Polygon, Base, Arbitrum). Credits are credited to your account once the transaction attains the required on-chain block confirmations.
                </li>
                <li>
                  <strong>Transaction Tracking & Auto-Refresh:</strong> Our Cloudflare Edge Worker monitors pending transactions every minute. You can also trigger immediate verification at any time via the "Refresh Credits" button on the Transactions page.
                </li>
                <li>
                  <strong>Gas Fees & Irreversibility:</strong> Blockchain gas/network fees are paid directly to network validators and are non-refundable. Vectorizerr does not control network congestion or gas price fluctuations.
                </li>
                <li>
                  <strong>Missing or Delayed Transactions:</strong> If your transaction is confirmed on-chain but your credits do not appear automatically, you can submit your transaction hash through our{' '}
                  <Link href="/support?category=crypto_transaction" className="text-indigo-400 underline underline-offset-4">
                    Support Assistance Portal
                  </Link>
                  .
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <AlertTriangle className="h-4 w-4 text-indigo-400" />
              <h3>4. Acceptable Use Policy</h3>
            </div>
            <p className="text-xs text-neutral-400">
              You agree not to abuse, disrupt, or exploit the service. Prohibited activities include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-neutral-400">
              <li>Attempting to forge, alter, or bypass cryptographic handshake tokens or API secrets.</li>
              <li>Executing automated denial-of-service (DDoS) requests against our edge APIs.</li>
              <li>Uploading content that contains malware, malicious payloads, or illegal material.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Scale className="h-4 w-4 text-indigo-400" />
              <h3>5. Disclaimers & Limitation of Liability</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Vectorizerr is provided &ldquo;as is&rdquo; without warranties of any kind, whether express or implied. In no event shall Vectorizerr or its operators be held liable for any indirect, incidental, or consequential damages resulting from blockchain delays, network forks, browser hardware limitations, or temporary service interruptions.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <LifeBuoy className="h-4 w-4 text-indigo-400" />
              <h3>6. Contact & Dispute Resolution</h3>
            </div>
            <p className="text-xs text-neutral-400">
              For questions concerning these Conditions of Use or billing queries, please contact our support desk at{' '}
              <Link href="/support" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
                Vectorizerr Support Portal
              </Link>
              .
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
