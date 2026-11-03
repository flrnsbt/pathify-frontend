'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Lock, EyeOff, Cpu, Key, FileCheck, LifeBuoy } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function PrivacyPolicyPage() {
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
        {/* Hero badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300 mb-6">
          <ShieldCheck className="h-4 w-4" />
          <span>Privacy-by-Design Architecture</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          Privacy Policy
        </h1>
        <p className="text-sm text-neutral-400 mb-8">
          Last revised: November 2026 &bull; Effective immediately for all visitors and registered users.
        </p>

        {/* Highlight Card */}
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-neutral-900/60 to-purple-950/30 p-6 mb-10 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-indigo-500/20 p-3 text-indigo-400 shrink-0">
              <EyeOff className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white mb-1.5">
                Core Principle: Your Images Never Leave Your Device
              </h2>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Vectorizerr executes all image rasterization, vector segmentation, path clustering, and SVG curve-fitting directly inside your browser using a local WebAssembly (WASM) compiled sandbox. <strong>We do not transmit, upload, inspect, or store your original images or generated vectors on remote servers.</strong> Processing is 100% private to your browser session.
              </p>
            </div>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-10 text-sm text-neutral-300 leading-relaxed">
          {/* Section 1 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Cpu className="h-4 w-4 text-indigo-400" />
              <h3>1. Local Execution & In-Browser Processing</h3>
            </div>
            <p className="text-xs text-neutral-400">
              When you upload or drag a bitmap image (PNG, JPG, WEBP) into Vectorizerr, it is decoded into raw pixel data exclusively within an isolated browser Web Worker running the VTracer WebAssembly engine. No network requests containing your image content are dispatched during vectorization. Even when exporting or downloading SVG, PNG, or WebP formats, the encoding is completed in-browser.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <FileCheck className="h-4 w-4 text-indigo-400" />
              <h3>2. Information We Collect</h3>
            </div>
            <p className="text-xs text-neutral-400">
              We only collect the minimum information required to manage account authentication, credit quotas, and transaction confirmations:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-xs text-neutral-400">
              <li>
                <strong className="text-neutral-200">Account Credentials:</strong> If you sign in via Google Sign-In or email/password authentication, your user identifier (UID), email address, and profile name are securely stored via Google Firebase Authentication.
              </li>
              <li>
                <strong className="text-neutral-200">Vectorization History (Optional):</strong> If you are signed in and save vector results to your history, compressed SVG paths and metadata (node counts, execution duration, parameters) are stored in your private Firestore record (<code className="text-neutral-300 font-mono">users/{'{userId}'}/history</code>) protected by security rules allowing only you to read them.
              </li>
              <li>
                <strong className="text-neutral-200">Crypto Payment Receipts:</strong> When purchasing credit packs via cryptocurrency, public on-chain identifiers (transaction hash, blockchain network, credit amount, timestamp) are recorded to automatically credit your balance upon block confirmation.
              </li>
              <li>
                <strong className="text-neutral-200">Security & Anti-Abuse Attestation:</strong> We use Firebase App Check and reCAPTCHA Enterprise tokens to prevent automated bot attacks and denial-of-service abuse.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Lock className="h-4 w-4 text-indigo-400" />
              <h3>3. Web3 & Blockchain Transparency</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Cryptocurrency transactions conducted on public blockchains (Ethereum, BNB Smart Chain, Polygon, Base, Arbitrum) are immutable and publicly visible by nature. Vectorizerr does not custody your private keys or have access to your wallet funds. All transactions are signed by your own Web3 wallet provider (e.g. MetaMask, Coinbase Wallet, WalletConnect).
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <Key className="h-4 w-4 text-indigo-400" />
              <h3>4. Cryptographic Security & Server Handshake</h3>
            </div>
            <p className="text-xs text-neutral-400">
              Vectorizerr protects credit transactions and generation quotas with a server-side Cryptographic Handshake system. Generation tickets are signed using HMAC-SHA256 algorithms and attested against Google App Check JWKS keys. This safeguards the integrity of credits without requiring server transmission of your underlying graphics.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              <h3>5. Your Rights & Data Deletion</h3>
            </div>
            <p className="text-xs text-neutral-400">
              You maintain total ownership and control over your data. You may delete individual items from your vectorization history at any time through the in-app History Drawer. If you wish to delete your entire account and associated Firestore data, you can reach out via our Support Portal.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-white font-semibold text-base">
              <LifeBuoy className="h-4 w-4 text-indigo-400" />
              <h3>6. Contact Regarding Privacy</h3>
            </div>
            <p className="text-xs text-neutral-400">
              If you have inquiries or requests regarding our privacy practices or security guarantees, please contact our assistance team through our encrypted support portal at{' '}
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
