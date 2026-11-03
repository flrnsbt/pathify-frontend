'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Coins,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ReceiptText,
  Shield,
  Sparkles,
  Search,
  LifeBuoy,
} from 'lucide-react';
import { useAuth } from '../../lib/firebase/auth-context';
import {
  CryptoTransaction,
  TransactionStatus,
} from '../../lib/firebase/firestore';
import { SUPPORTED_CHAINS, SupportedChainKey } from '../../lib/web3/payment-wallets';
import { ChainIcon, TokenIcon } from '../../components/ChainIcons';
import { CreditModal } from '../../components/CreditModal';
import { Footer } from '../../components/Footer';
import { useTransactionListener } from '../../hooks/useTransactionListener';

export default function TransactionsPage() {
  const { user, profile, loading, loginWithGoogle, refreshProfile } = useAuth();
  const [selectedTx, setSelectedTx] = useState<CryptoTransaction | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | TransactionStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const handleTransactionFinished = React.useCallback(
    (tx: CryptoTransaction) => {
      refreshProfile();
      if (tx.status === 'confirmed') {
        setStatusNotice(`🎉 Transaction ${tx.id.slice(0, 8)} confirmed! ${tx.credits} credits added.`);
      } else if (tx.status === 'failed') {
        setStatusNotice(`⚠️ Transaction ${tx.id.slice(0, 8)} failed or was rejected.`);
      }
    },
    [refreshProfile]
  );

  // Real-time listener for user transactions and status change
  const { transactions, pendingCount, isRefreshing, refreshCredits } = useTransactionListener({
    userId: user?.uid,
    onTransactionFinished: handleTransactionFinished,
  });

  const handleManualRefresh = async () => {
    setStatusNotice(null);
    const result = await refreshCredits();
    await refreshProfile();
    if (result) {
      if (result.cloudFunctionNotified) {
        setStatusNotice('Cloud function triggered! Checking blockchain receipts...');
      } else {
        setStatusNotice(`Credits refreshed! Current balance: ${result.updatedCredits} credits.`);
      }
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter transactions
  const filteredTxs = transactions.filter((tx) => {
    if (filterStatus !== 'all' && tx.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = tx.id.toLowerCase().includes(q);
      const matchHash = tx.txHash ? tx.txHash.toLowerCase().includes(q) : false;
      const matchToken = tx.cryptoToken.toLowerCase().includes(q);
      const matchChain = tx.chainKey.toLowerCase().includes(q);
      return matchId || matchHash || matchToken || matchChain;
    }
    return true;
  });

  const confirmedCount = transactions.filter((t) => t.status === 'confirmed').length;
  const totalPurchasedCredits = transactions
    .filter((t) => t.status === 'confirmed')
    .reduce((sum, t) => sum + t.credits, 0);

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
      <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased selection:bg-indigo-500/30 flex flex-col justify-between">
        {/* Top Navigation */}
        <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Editor</span>
              </Link>
              <div className="h-4 w-px bg-neutral-800" />
              <div className="flex items-center gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon.svg"
                  alt="vectorizerr"
                  className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900 p-0.5 object-contain"
                />
                <span className="font-bold tracking-tight text-white text-base">
                  vectorizerr
                </span>
                <span className="rounded bg-neutral-800/80 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                  Transactions
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Guard Card */}
        <main className="mx-auto flex max-w-md w-full flex-1 flex-col items-center justify-center px-4 py-20 text-center">
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/90 shadow-2xl shadow-indigo-500/10">
            <Shield className="h-10 w-10 text-indigo-400" />
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300">
              <ReceiptText className="h-3.5 w-3.5" />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sign In to View Transactions
          </h1>
          <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
            Transaction history, blockchain confirmation tracking, and credit receipts are linked to your registered Vectorizerr account.
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 antialiased selection:bg-indigo-500/30">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Editor</span>
            </Link>

            <div className="h-4 w-px bg-neutral-800" />

            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon.svg"
                alt="vectorizerr"
                className="h-8 w-8 rounded-lg border border-neutral-800 bg-neutral-900 p-0.5 object-contain"
              />
              <span className="font-bold tracking-tight text-white text-base">
                vectorizerr
              </span>
              <span className="rounded bg-neutral-800/80 px-2 py-0.5 text-[10px] font-mono text-neutral-400">
                Transactions
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Credits pill */}
            <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs">
              <Coins className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-bold text-white">{profile?.credits ?? 0}</span>
              <span className="text-neutral-400 text-[11px]">Credits</span>
            </div>

            <Link
              href="/support?category=crypto_transaction"
              className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white transition"
              title="Need help with transactions?"
            >
              <LifeBuoy className="h-3.5 w-3.5 text-neutral-400" />
              <span className="hidden sm:inline">Support</span>
            </Link>

            <button
              onClick={() => setIsCreditModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-500 hover:to-purple-500 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Add Credits</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Page Title & Refresh */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
              <ReceiptText className="h-6 w-6 text-indigo-400" />
              <span>Crypto Transactions</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Real-time audit log of your Web3 and direct transfer credit purchases.
            </p>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="self-start sm:self-auto flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-neutral-200 hover:border-neutral-700 hover:bg-neutral-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>{isRefreshing ? 'Checking...' : 'Refresh Credits'}</span>
          </button>
        </div>

        {/* Status notice alert */}
        {statusNotice && (
          <div className="flex items-center justify-between rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-3.5 text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
              <span>{statusNotice}</span>
            </div>
            <button
              onClick={() => setStatusNotice(null)}
              className="text-neutral-400 hover:text-white text-xs ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Unauthenticated notice */}
        {(!user || user.isAnonymous) && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <strong className="block text-amber-200 text-sm mb-0.5">Guest Mode</strong>
              <span>
                You are currently browsing as a guest. Please sign in with Google to associate crypto transactions permanently with your profile across devices.
              </span>
            </div>
            <Link
              href="/signin"
              className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-black hover:bg-amber-400 transition shrink-0"
            >
              Sign In
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Available Credits */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Available Credits</span>
              <Coins className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {profile?.credits ?? 0}
            </div>
            <div className="text-[11px] text-neutral-500">
              For lossless SVG vector unlocks
            </div>
          </div>

          {/* Card 2: Pending Confirmations */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Pending Transactions</span>
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-300 flex items-center gap-2">
              <span>{pendingCount}</span>
              {pendingCount > 0 && (
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <div className="text-[11px] text-neutral-500">
              Awaiting blockchain confirmation
            </div>
          </div>

          {/* Card 3: Confirmed Transactions */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Confirmed Orders</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {confirmedCount}
            </div>
            <div className="text-[11px] text-neutral-500">
              Verified &amp; deposited
            </div>
          </div>

          {/* Card 4: Total Credits Purchased */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 space-y-1">
            <div className="flex items-center justify-between text-neutral-400 text-xs">
              <span>Lifetime Purchased</span>
              <Shield className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-white">
              {totalPurchasedCredits}
            </div>
            <div className="text-[11px] text-neutral-500">
              Cumulative historical credits
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-1">
            {(
              [
                { key: 'all' as const, label: 'All', count: undefined },
                { key: 'pending' as const, label: 'Pending', count: pendingCount },
                { key: 'confirmed' as const, label: 'Confirmed', count: confirmedCount },
                { key: 'failed' as const, label: 'Failed', count: undefined },
              ]
            ).map((tab) => {
              const isActive = filterStatus === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setFilterStatus(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${isActive
                      ? 'bg-neutral-800 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                    }`}
                >
                  <span>{tab.label}</span>
                  {typeof tab.count === 'number' && tab.count > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] ${tab.key === 'pending'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-neutral-700 text-neutral-300'
                        }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by ID, Hash, Chain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-2xl border border-neutral-800 bg-neutral-900/60 pl-9 pr-3 py-2 text-xs text-neutral-200 placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Transactions Table / List */}
        <div className="overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-900/60 shadow-xl">
          {filteredTxs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 text-neutral-500 mb-3">
                <ReceiptText className="h-8 w-8" />
              </div>
              <h3 className="text-sm font-bold text-white">No transactions found</h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                {filterStatus !== 'all'
                  ? `No transactions with status "${filterStatus}".`
                  : 'You have not made any crypto credit purchases yet.'}
              </p>
              <button
                onClick={() => setIsCreditModalOpen(true)}
                className="mt-4 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-indigo-500 transition"
              >
                <Coins className="h-3.5 w-3.5" />
                <span>Buy Credits</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-950/60 text-neutral-400 font-semibold">
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Credits</th>
                    <th className="py-3.5 px-4">Payment</th>
                    <th className="py-3.5 px-4">Network</th>
                    <th className="py-3.5 px-4">Tx Hash</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {filteredTxs.map((tx) => {
                    const chainMeta = SUPPORTED_CHAINS[tx.chainKey as SupportedChainKey];
                    const dateStr = new Date(tx.createdAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-neutral-850/50 transition cursor-pointer"
                        onClick={() => setSelectedTx(tx)}
                      >
                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={tx.status} />
                        </td>

                        {/* Credits */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-1">
                            <span className="text-amber-400">+{tx.credits}</span>
                            <span className="text-neutral-400 text-[11px] font-normal">credits</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            ${tx.usdPrice} USD
                          </div>
                        </td>

                        {/* Crypto Amount & Token */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-semibold text-neutral-200">
                            <TokenIcon token={tx.cryptoToken} className="w-4 h-4 shrink-0" />
                            <span>{tx.cryptoAmount} {tx.cryptoToken}</span>
                          </div>
                          <div className="text-[10px] text-neutral-500 uppercase">
                            {tx.paymentMethod === 'web3' ? 'Web3 Wallet' : 'Direct QR'}
                          </div>
                        </td>

                        {/* Network */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 shrink-0">
                              <ChainIcon chainKey={tx.chainKey as SupportedChainKey} className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="font-semibold text-neutral-200 block text-xs">
                                {chainMeta ? chainMeta.shortName : tx.chainKey.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-neutral-500 font-mono">
                                {chainMeta?.badge || ''}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Transaction Hash */}
                        <td className="py-3.5 px-4">
                          {tx.txHash ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-300">
                              <span>
                                {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                              </span>
                              {chainMeta?.explorerUrl && (
                                <a
                                  href={`${chainMeta.explorerUrl}/tx/${tx.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-neutral-500 hover:text-white transition"
                                  title="View on Block Explorer"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-500 text-[11px] italic">Not provided</span>
                          )}
                        </td>

                        {/* Date */}
                        <td suppressHydrationWarning className="py-3.5 px-4 text-neutral-400 text-xs whitespace-nowrap">
                          {dateStr}
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTx(tx);
                            }}
                            className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-2.5 py-1 text-[11px] font-semibold text-neutral-200 transition"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Transaction Details Modal */}
      {selectedTx && (
        <TransactionDetailsModal
          tx={selectedTx}
          onClose={() => setSelectedTx(null)}
          onRefresh={handleManualRefresh}
          copyToClipboard={copyToClipboard}
          copiedField={copiedField}
        />
      )}

      {/* Credit Purchase Modal */}
      {isCreditModalOpen && (
        <CreditModal
          isOpen={isCreditModalOpen}
          onClose={() => setIsCreditModalOpen(false)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TransactionStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          Pending
        </span>
      );
    case 'confirmed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
          Confirmed
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-300">
          <XCircle className="h-3 w-3 text-red-400" />
          Failed
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-800 px-2.5 py-0.5 text-[11px] font-medium text-neutral-400">
          Cancelled
        </span>
      );
  }
}

interface DetailsModalProps {
  tx: CryptoTransaction;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  copyToClipboard: (text: string, field: string) => void;
  copiedField: string | null;
}

function TransactionDetailsModal({
  tx,
  onClose,
  onRefresh,
  copyToClipboard,
  copiedField,
}: DetailsModalProps) {
  const [checking, setChecking] = useState(false);
  const chainMeta = SUPPORTED_CHAINS[tx.chainKey as SupportedChainKey];

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      await onRefresh();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-neutral-800 flex items-center justify-center p-1">
              <ChainIcon chainKey={tx.chainKey as SupportedChainKey} className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Transaction Details</h3>
              <p className="text-[11px] font-mono text-neutral-400">{tx.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* Status Callout */}
        <div className="flex items-center justify-between rounded-2xl border border-neutral-800 bg-neutral-950/60 p-3.5">
          <div>
            <span className="text-[11px] text-neutral-500 block">Current Status</span>
            <span className="text-sm font-bold text-white capitalize">{tx.status}</span>
          </div>
          <StatusBadge status={tx.status} />
        </div>

        {/* Key Values List */}
        <div className="space-y-2.5 text-xs">
          {/* Credits */}
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/50">
            <span className="text-neutral-400">Credits Credited</span>
            <span className="font-bold text-amber-400 text-sm">+{tx.credits} Credits</span>
          </div>

          {/* USD Value */}
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/50">
            <span className="text-neutral-400">Order Value</span>
            <span className="font-semibold text-white">${tx.usdPrice} USD</span>
          </div>

          {/* Crypto Amount */}
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/50">
            <span className="text-neutral-400">Crypto Amount</span>
            <span className="font-mono font-semibold text-neutral-200 flex items-center gap-1.5">
              <TokenIcon token={tx.cryptoToken} className="w-4 h-4 shrink-0" />
              <span>{tx.cryptoAmount} {tx.cryptoToken}</span>
            </span>
          </div>

          {/* Network */}
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/50">
            <span className="text-neutral-400">Blockchain Network</span>
            <span className="font-semibold text-neutral-200">
              {chainMeta ? `${chainMeta.name} (${chainMeta.badge})` : tx.chainKey}
            </span>
          </div>

          {/* Payment Method */}
          <div className="flex items-center justify-between py-1 border-b border-neutral-800/50">
            <span className="text-neutral-400">Payment Channel</span>
            <span className="text-neutral-300 uppercase font-mono text-[11px]">
              {tx.paymentMethod === 'web3' ? 'Web3 Connected Wallet' : 'Direct Transfer (QR)'}
            </span>
          </div>

          {/* Transaction Hash */}
          {tx.txHash && (
            <div className="py-1 border-b border-neutral-800/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-neutral-400">Transaction Hash</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(tx.txHash || '', 'txHash')}
                    className="text-neutral-400 hover:text-white flex items-center gap-1 text-[10px]"
                  >
                    {copiedField === 'txHash' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>Copy</span>
                  </button>
                  {chainMeta?.explorerUrl && (
                    <a
                      href={`${chainMeta.explorerUrl}/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1 text-[10px]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      <span>Explorer</span>
                    </a>
                  )}
                </div>
              </div>
              <div className="font-mono text-[11px] text-neutral-300 break-all select-all rounded bg-neutral-950 p-1.5 border border-neutral-850">
                {tx.txHash}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="flex items-center justify-between py-1">
            <span className="text-neutral-400">Created At</span>
            <span suppressHydrationWarning className="text-neutral-300">
              {new Date(tx.createdAt).toLocaleString()}
            </span>
          </div>

          {tx.confirmedAt && (
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-400">Confirmed At</span>
              <span suppressHydrationWarning className="text-emerald-400 font-semibold">
                {new Date(tx.confirmedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>

        {/* Action Button for Pending Transactions */}
        {tx.status === 'pending' && (
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckNow}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status...' : 'Check Status / Refresh Now'}</span>
          </button>
        )}

        {/* Contact Support Link */}
        <Link
          href={`/support?category=crypto_transaction&txHash=${encodeURIComponent(tx.txHash || '')}&chain=${encodeURIComponent(tx.chainKey)}`}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/60 py-2.5 text-xs font-medium text-neutral-300 hover:border-neutral-700 hover:text-white transition"
        >
          <LifeBuoy className="h-4 w-4 text-indigo-400" />
          <span>Need Help with this Transaction?</span>
        </Link>
      </div>
    </div>
  );
}
