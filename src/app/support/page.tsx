'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  LifeBuoy,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Coins,
  Shield,
  MessageSquare,
  Wrench,
  ReceiptText,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/auth-context';
import { submitSupportTicket } from '@/lib/support/support-service';
import { SUPPORTED_CHAINS } from '@/lib/web3/payment-wallets';
import { Footer } from '@/components/Footer';

function SupportContent() {
  const searchParams = useSearchParams();
  const { user, loading, loginWithGoogle } = useAuth();

  const [category, setCategory] = useState<
    'crypto_transaction' | 'credits_billing' | 'technical' | 'general'
  >('crypto_transaction');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [chainKey, setChainKey] = useState('bsc');
  const [walletAddress, setWalletAddress] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

  // Initialize from search params and auth
  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
    if (user?.displayName) {
      setName(user.displayName);
    }

    const catParam = searchParams.get('category');
    if (
      catParam === 'crypto_transaction' ||
      catParam === 'credits_billing' ||
      catParam === 'technical' ||
      catParam === 'general'
    ) {
      setCategory(catParam);
    }

    const hashParam = searchParams.get('txHash');
    if (hashParam) {
      setTxHash(hashParam);
      setCategory('crypto_transaction');
    }

    const chainParam = searchParams.get('chain');
    if (chainParam) {
      setChainKey(chainParam.toLowerCase());
    }
  }, [user, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address so we can reply to you.');
      return;
    }

    if (!message.trim() || message.trim().length < 10) {
      setErrorMessage('Please provide a descriptive message (at least 10 characters).');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await submitSupportTicket({
        name: name.trim() || undefined,
        email: email.trim(),
        category,
        subject: subject.trim() || undefined,
        message: message.trim(),
        txHash: category === 'crypto_transaction' ? txHash.trim() || undefined : undefined,
        chainKey: category === 'crypto_transaction' ? chainKey : undefined,
        walletAddress: category === 'crypto_transaction' ? walletAddress.trim() || undefined : undefined,
      });

      if (res.success && res.ticketId) {
        setSuccessTicketId(res.ticketId);
      } else {
        setErrorMessage(res.error || 'Failed to submit ticket. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessTicketId(null);
    setMessage('');
    setSubject('');
    setTxHash('');
  };

  // Auth Guard: Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-mono text-neutral-400">Verifying session...</p>
        </div>
      </div>
    );
  }

  // Auth Guard: Gated for authenticated users only
  if (!user || user.isAnonymous) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-neutral-950 text-neutral-100">
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
              href="/transactions"
              className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white transition"
            >
              <ReceiptText className="h-3.5 w-3.5 text-neutral-400" />
              <span>Transactions</span>
            </Link>
          </div>
        </header>

        {/* Guard Card */}
        <main className="mx-auto flex max-w-md w-full flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-2xl shadow-indigo-500/10">
            <LifeBuoy className="h-10 w-10 text-indigo-400" />
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
              <Shield className="h-3.5 w-3.5" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sign In to Contact Support
          </h1>
          <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
            Please sign in with your Vectorizerr account to submit support requests, report crypto transaction issues, or receive priority assistance.
          </p>

          <div className="mt-8 flex w-full flex-col gap-3">
            <button
              onClick={() => loginWithGoogle()}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-[0.99] transition"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>

            <Link
              href="/"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-5 py-3 text-sm font-medium text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Studio</span>
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

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
            href="/transactions"
            className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white transition"
          >
            <ReceiptText className="h-3.5 w-3.5 text-neutral-400" />
            <span>Transactions</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        {/* Header Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3.5 py-1 text-xs font-medium text-indigo-300 mb-3">
            <LifeBuoy className="h-4 w-4" />
            <span>Customer Assistance & Transaction Support</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            How can we help you?
          </h1>
          <p className="mt-1 text-xs text-neutral-400">
            Have an issue with a crypto transaction, credit balance, or SVG vectorization?
            Send us your inquiry and our support desk will respond directly to your email.
          </p>
        </div>

        {/* Success View */}
        {successTicketId ? (
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-8 text-center space-y-6 shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">
                Support Ticket Submitted Successfully
              </h2>
              <p className="text-xs text-neutral-300 max-w-md mx-auto">
                Your ticket has been securely encrypted and delivered to our technical assistance desk.
                A confirmation has been logged with ticket ID:
              </p>
              <div className="inline-block rounded-xl border border-emerald-500/40 bg-neutral-900 px-4 py-2 font-mono text-sm font-bold text-emerald-300 shadow-inner">
                {successTicketId}
              </div>
            </div>

            <p className="text-xs text-neutral-400">
              We will review your inquiry and reply to <strong className="text-neutral-200">{email}</strong>.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/transactions"
                className="w-full sm:w-auto rounded-xl border border-neutral-700 bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-800 transition"
              >
                View Crypto Transactions
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition"
              >
                Submit Another Request
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-neutral-850 bg-neutral-900/40 p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6"
          >
            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-950/30 p-4 text-xs text-red-300">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {/* Category Selector Tabs */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                Assistance Topic
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setCategory('crypto_transaction')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition ${category === 'crypto_transaction'
                      ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-md'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800'
                    }`}
                >
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span className="text-center">Crypto Tx</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('credits_billing')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition ${category === 'credits_billing'
                      ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-md'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800'
                    }`}
                >
                  <ReceiptText className="h-4 w-4 text-emerald-400" />
                  <span className="text-center">Credits & Plans</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('technical')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition ${category === 'technical'
                      ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-md'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800'
                    }`}
                >
                  <Wrench className="h-4 w-4 text-indigo-400" />
                  <span className="text-center">Technical Issue</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCategory('general')}
                  className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-xs font-medium transition ${category === 'general'
                      ? 'border-indigo-500 bg-indigo-600/20 text-white shadow-md'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:bg-neutral-800'
                    }`}
                >
                  <MessageSquare className="h-4 w-4 text-neutral-400" />
                  <span className="text-center">General Inquiry</span>
                </button>
              </div>
            </div>

            {/* Contact Details (Name & Email) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Your Name <span className="text-neutral-500">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Satoshi"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Your Email Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:border-indigo-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Special Section: Crypto Transaction Fields */}
            {category === 'crypto_transaction' && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <span>Blockchain Transaction Details</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">
                      Blockchain Network
                    </label>
                    <select
                      value={chainKey}
                      onChange={(e) => setChainKey(e.target.value)}
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none transition"
                    >
                      {Object.values(SUPPORTED_CHAINS).map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.name} ({c.nativeToken})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">
                      Wallet Address <span className="text-neutral-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs text-white font-mono placeholder-neutral-600 focus:border-indigo-500 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-neutral-300">
                    Transaction Hash (TxID)
                  </label>
                  <input
                    type="text"
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    placeholder="0x1234567890abcdef..."
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs text-white font-mono placeholder-neutral-600 focus:border-indigo-500 focus:outline-none transition"
                  />
                  <p className="text-[11px] text-neutral-500">
                    Paste your transaction hash from MetaMask, TrustWallet, or the blockchain explorer.
                  </p>
                </div>
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-300">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={
                  category === 'crypto_transaction'
                    ? 'Pending credits for recent transfer'
                    : 'How can we help?'
                }
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs text-white placeholder-neutral-600 focus:border-indigo-500 focus:outline-none transition"
              />
            </div>

            {/* Message Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-neutral-300">
                  Detailed Message <span className="text-red-400">*</span>
                </label>
                <span className="text-[11px] text-neutral-500">
                  {message.length} characters
                </span>
              </div>
              <textarea
                required
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Please describe what happened, any transaction details or error notices you encountered..."
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 text-xs text-white placeholder-neutral-600 focus:border-indigo-500 focus:outline-none transition"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition disabled:opacity-50"
            >
              <Send className={`h-4 w-4 ${isSubmitting ? 'animate-pulse' : ''}`} />
              <span>{isSubmitting ? 'Submitting Encrypted Ticket...' : 'Send Support Request'}</span>
            </button>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-400 text-xs">
          Loading support portal...
        </div>
      }
    >
      <SupportContent />
    </Suspense>
  );
}
