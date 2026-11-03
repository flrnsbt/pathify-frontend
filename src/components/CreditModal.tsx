'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  X,
  Check,
  AlertCircle,
  Copy,
  ExternalLink,
  Coins,
  QrCode,
  Wallet,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ReceiptText,
} from 'lucide-react';
import { useAuth } from '../lib/firebase/auth-context';
import {
  createCryptoTransaction,
  listenToTransaction,
} from '../lib/firebase/firestore';
import { useAppKit, useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react';
import { useSendTransaction, useWriteContract, useSwitchChain } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
import {
  SUPPORTED_CHAINS,
  ERC20_CONTRACTS,
  CREDIT_PACKS,
  CreditPack,
  SupportedChainKey,
  SupportedToken,
  getRecipientWallet,
  parsePaymentWallets,
  ParsedPaymentWallet,
} from '../lib/web3/payment-wallets';
import { ChainIcon } from './ChainIcons';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredReason?: string;
}

const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export function CreditModal({ isOpen, onClose, requiredReason }: CreditModalProps) {
  const { user, refreshProfile } = useAuth();
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId: currentChainId } = useAppKitNetwork();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  // State
  const [selectedPack, setSelectedPack] = useState<CreditPack>(CREDIT_PACKS[1]); // default to 100 pack
  const [selectedChainKey, setSelectedChainKey] = useState<SupportedChainKey>('bsc');
  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDT');
  const [payMethod, setPayMethod] = useState<'wallet' | 'qr'>('wallet');

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHashInput, setTxHashInput] = useState<string>('');

  const [configuredWallets, setConfiguredWallets] = useState<ParsedPaymentWallet[]>(() =>
    parsePaymentWallets()
  );

  const chainMeta = SUPPORTED_CHAINS[selectedChainKey];
  const isEvm = chainMeta?.isEvm ?? false;

  // Derive valid active token for the selected chain without useEffect setState
  const activeToken: SupportedToken = chainMeta.tokens.includes(selectedToken)
    ? selectedToken
    : chainMeta.tokens[0];

  // Fetch / update configured wallets on open
  useEffect(() => {
    if (!isOpen) return;
    const clientParsed = parsePaymentWallets();
    if (clientParsed.length > 0) {
      Promise.resolve().then(() => {
        setConfiguredWallets(clientParsed);
      });
    }
  }, [isOpen]);

  // Recipient wallet address
  const recipientWallet = getRecipientWallet(selectedChainKey, activeToken, configuredWallets);
  const amountToPay = selectedPack.cryptoPrices[activeToken] || '0';

  // Generate QR code for the recipient wallet
  useEffect(() => {
    let active = true;
    if (!recipientWallet) {
      Promise.resolve().then(() => {
        if (active) setQrCodeUrl('');
      });
      return;
    }

    let qrPayload = recipientWallet;
    if (selectedChainKey === 'btc') {
      qrPayload = `bitcoin:${recipientWallet}?amount=${amountToPay}`;
    }

    QRCode.toDataURL(qrPayload, {
      width: 220,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrCodeUrl(url);
      })
      .catch(() => {
        if (active) setQrCodeUrl('');
      });

    return () => {
      active = false;
    };
  }, [recipientWallet, selectedChainKey, amountToPay]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Web3 / WalletConnect transaction
  const handlePayWithWeb3 = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (!user || user.isAnonymous) {
        throw new Error('Please sign in with Google first so your credits are saved to your account.');
      }

      if (!isConnected) {
        await open();
        setLoading(false);
        return;
      }

      const targetChainId = chainMeta.chainId;
      if (!targetChainId) {
        throw new Error('Selected chain does not support direct Web3 wallet execution. Please use Direct Transfer / QR code.');
      }

      // 1. Switch network if needed
      if (currentChainId !== targetChainId && switchChainAsync) {
        try {
          await switchChainAsync({ chainId: targetChainId });
        } catch {
          throw new Error(`Please switch your wallet network to ${chainMeta.name} to continue.`);
        }
      }

      // 2. Perform transaction
      let txHash = '';

      if (activeToken === chainMeta.nativeToken) {
        // Native transfer (ETH, BNB, POL)
        const tx = await sendTransactionAsync({
          to: recipientWallet as `0x${string}`,
          value: parseEther(amountToPay),
        });
        txHash = tx;
      } else {
        // ERC-20 token transfer (USDT, USDC)
        const tokenConfig = ERC20_CONTRACTS[targetChainId]?.[activeToken];
        if (!tokenConfig) {
          throw new Error(`Direct Web3 transfer not configured for ${activeToken} on ${chainMeta.name}. Please use Direct Transfer / QR Code below.`);
        }

        const parsedAmount = parseUnits(amountToPay, tokenConfig.decimals);
        const tx = await writeContractAsync({
          address: tokenConfig.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipientWallet as `0x${string}`, parsedAmount],
        });
        txHash = tx;
      }

      // 3. Record transaction in Firestore with status 'pending'
      const txId = await createCryptoTransaction({
        userId: user.uid,
        userEmail: user.email,
        packId: selectedPack.id,
        credits: selectedPack.credits,
        usdPrice: selectedPack.usdPrice,
        cryptoAmount: amountToPay,
        cryptoToken: activeToken,
        chainKey: selectedChainKey,
        chainId: chainMeta.chainId,
        paymentMethod: 'web3',
        fromAddress: address || undefined,
        toAddress: recipientWallet,
        txHash,
        status: 'pending',
        statusMessage: `Submitted on ${chainMeta.name}. Awaiting blockchain confirmation.`,
      });

      // Listen for transaction confirmation in real-time
      const unsubscribe = listenToTransaction(txId, (updatedTx) => {
        if (updatedTx?.status === 'confirmed') {
          refreshProfile();
          setSuccessMsg(
            `🎉 Transaction confirmed (${txHash.slice(0, 10)}...)! Added ${selectedPack.credits} credits to your account.`
          );
          unsubscribe();
        } else if (updatedTx?.status === 'failed') {
          setErrorMsg('Transaction verification failed. Please check transactions page for details.');
          unsubscribe();
        }
      });

      setSuccessMsg(
        `🎉 Transaction submitted on ${chainMeta.name} (${txHash.slice(0, 10)}...)! Awaiting confirmation. Your credits will update automatically once verified.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes('rejected') && !msg.includes('denied') && !msg.includes('User rejected')) {
        setErrorMsg(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Manual / Direct transfer confirmation
  const handleConfirmManualPayment = async () => {
    setErrorMsg(null);
    setLoading(true);

    try {
      if (!user || user.isAnonymous) {
        throw new Error('Please sign in with Google first so your credits are saved to your account.');
      }

      // Record transaction in Firestore with status 'pending'
      const txId = await createCryptoTransaction({
        userId: user.uid,
        userEmail: user.email,
        packId: selectedPack.id,
        credits: selectedPack.credits,
        usdPrice: selectedPack.usdPrice,
        cryptoAmount: amountToPay,
        cryptoToken: activeToken,
        chainKey: selectedChainKey,
        chainId: chainMeta.chainId,
        paymentMethod: 'direct',
        toAddress: recipientWallet,
        txHash: txHashInput.trim() || undefined,
        status: 'pending',
        statusMessage: 'Direct network transfer submitted. Awaiting verification.',
      });

      // Listen for transaction confirmation
      const unsubscribe = listenToTransaction(txId, (updatedTx) => {
        if (updatedTx?.status === 'confirmed') {
          refreshProfile();
          setSuccessMsg(
            `🎉 Payment confirmed! ${selectedPack.credits} credits have been deposited to your account.`
          );
          unsubscribe();
        }
      });

      setSuccessMsg(
        `🎉 Payment submitted! Your transaction is now pending verification. Credits will be automatically added as soon as confirmed.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-neutral-800 bg-neutral-900/95 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.svg"
              alt="vectorizerr"
              className="h-10 w-10 rounded-xl border border-neutral-700/80 bg-neutral-950 p-1 object-contain shadow-md"
            />
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Crypto Credit Packs</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Unlock high-resolution SVG downloads via Web3 or Direct Transfer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Required reason banner if opened from an action */}
        {requiredReason && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs text-indigo-300">
            <Sparkles className="h-4 w-4 shrink-0 text-indigo-400" />
            <span>{requiredReason}</span>
          </div>
        )}

        {/* Unauthenticated notice */}
        {(!user || user.isAnonymous) && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              Please sign in with Google so your purchased credits are securely linked to your account.
            </span>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="mt-4 flex items-center justify-between gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
            <div className="flex items-center gap-2 flex-1">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <Link
              href="/transactions"
              onClick={onClose}
              className="shrink-0 underline font-semibold text-emerald-200 hover:text-white flex items-center gap-1"
            >
              <span>Transactions</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span className="flex-1">{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Select Pack */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
            <Coins className="h-3.5 w-3.5 text-amber-400" />
            1. Select Credit Pack
          </label>
          <div className="grid grid-cols-3 gap-3">
            {CREDIT_PACKS.map((pack) => {
              const isSelected = selectedPack.id === pack.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPack(pack)}
                  className={`relative flex flex-col items-center justify-center p-3.5 rounded-2xl border transition text-center ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-600/15 shadow-md shadow-indigo-500/10'
                      : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900'
                  }`}
                >
                  {pack.popular && (
                    <span className="absolute -top-2.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm">
                      Best Value
                    </span>
                  )}
                  <div className="text-lg font-extrabold text-white">
                    {pack.credits} <span className="text-xs font-normal text-neutral-400">credits</span>
                  </div>
                  <div className="text-xs text-neutral-300 font-semibold mt-1">
                    ${pack.usdPrice} USD
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5">
                    ${(pack.usdPrice / pack.credits).toFixed(2)} / SVG
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Choose Blockchain Network (Cards with Chain Icons) */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <span>2. Choose Blockchain Network</span>
            </label>
            <span className="text-[11px] text-neutral-400">
              Selected: <span className="text-white font-medium">{chainMeta.name}</span>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(Object.keys(SUPPORTED_CHAINS) as SupportedChainKey[]).map((key) => {
              const chain = SUPPORTED_CHAINS[key];
              const isSelected = selectedChainKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedChainKey(key)}
                  style={{
                    backgroundColor: isSelected ? chain.bgGlow : undefined,
                    borderColor: isSelected ? chain.color : undefined,
                  }}
                  className={`group relative flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all duration-150 ${
                    isSelected
                      ? 'shadow-md shadow-black/40 ring-1 ring-white/10'
                      : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700 hover:bg-neutral-900/80'
                  }`}
                >
                  {/* Chain Icon with custom network brand style */}
                  <div
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl p-1 transition-transform group-hover:scale-105"
                    style={{
                      backgroundColor: `${chain.color}15`,
                    }}
                  >
                    <ChainIcon chainKey={key} className="h-5 w-5 object-contain" />
                  </div>

                  {/* Chain Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white truncate">
                        {chain.shortName}
                      </span>
                      {isSelected && (
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0 animate-pulse"
                          style={{ backgroundColor: chain.color }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="rounded bg-neutral-800/80 px-1 py-0.2 text-[9px] font-mono text-neutral-300">
                        {chain.badge}
                      </span>
                      <span className="text-[9px] text-neutral-500 font-mono">
                        {chain.isEvm ? 'EVM' : 'UTXO'}
                      </span>
                    </div>
                  </div>

                  {/* Active Indicator Checkmark */}
                  {isSelected && (
                    <div
                      className="absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white shadow-sm"
                      style={{ backgroundColor: chain.color }}
                    >
                      <Check className="h-2 w-2 text-black stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: Select Token */}
        <div className="mt-5 space-y-2">
          <label className="text-xs font-semibold text-neutral-300">
            3. Choose Payment Token ({chainMeta.name})
          </label>
          <div className="flex flex-wrap gap-2">
            {chainMeta.tokens.map((token) => {
              const isSelected = activeToken === token;
              const price = selectedPack.cryptoPrices[token] || '0';
              return (
                <button
                  key={token}
                  type="button"
                  onClick={() => setSelectedToken(token)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-600/20 text-white font-semibold'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <span>{token}</span>
                  <span className="rounded bg-neutral-800/80 px-1.5 py-0.5 text-[10px] text-neutral-300 font-mono">
                    {price} {token}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 4: Payment Execution Section */}
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 space-y-4">
          {/* Method selector for EVM chains */}
          {isEvm ? (
            <div className="flex rounded-xl bg-neutral-900 p-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => setPayMethod('wallet')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  payMethod === 'wallet'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>Web3 / WalletConnect</span>
              </button>
              <button
                type="button"
                onClick={() => setPayMethod('qr')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  payMethod === 'qr'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <QrCode className="h-3.5 w-3.5" />
                <span>Direct Transfer / QR Code</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs text-neutral-400 border-b border-neutral-800/80 pb-2">
              <span className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <QrCode className="h-4 w-4 text-indigo-400" /> Direct Network Transfer
              </span>
              <span className="rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-mono text-neutral-300">
                {chainMeta.badge}
              </span>
            </div>
          )}

          {/* EVM WalletConnect Tab */}
          {isEvm && payMethod === 'wallet' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-neutral-900/60 p-3 border border-neutral-800 text-xs">
                <div>
                  <span className="text-neutral-400 block text-[11px]">Total to Send</span>
                  <span className="text-base font-bold text-white">
                    {amountToPay} {activeToken}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-400 block text-[11px]">Network</span>
                  <span className="font-semibold text-neutral-200">{chainMeta.name}</span>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 space-y-1">
                <p>
                  Recipient Contract / Address:{' '}
                  <span className="font-mono text-neutral-300">{recipientWallet}</span>
                </p>
                {isConnected && address && (
                  <p>
                    Connected Wallet:{' '}
                    <span className="font-mono text-indigo-400">
                      {address.slice(0, 8)}...{address.slice(-6)}
                    </span>
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handlePayWithWeb3}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Wallet className="h-4 w-4" />
                    <span>
                      {isConnected
                        ? `Send ${amountToPay} ${activeToken} (${chainMeta.name})`
                        : `Connect Wallet & Pay (${amountToPay} ${activeToken})`}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Direct Transfer / QR Code Interface (Supports BTC and EVM) */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                {/* QR Code */}
                {qrCodeUrl ? (
                  <div className="rounded-xl bg-white p-2 shrink-0 shadow-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrCodeUrl}
                      alt="Payment QR Code"
                      className="h-32 w-32 object-contain"
                    />
                  </div>
                ) : (
                  <div className="h-32 w-32 rounded-xl bg-neutral-800 animate-pulse shrink-0" />
                )}

                {/* Address & Amount Copy */}
                <div className="flex-1 w-full space-y-2.5">
                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                      Recipient Address ({chainMeta.badge})
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                      <span className="font-mono text-xs text-neutral-200 truncate flex-1 select-all">
                        {recipientWallet}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(recipientWallet, 'address')}
                        className="rounded-lg bg-neutral-800 p-1.5 text-neutral-300 hover:text-white transition"
                        title="Copy Address"
                      >
                        {copiedField === 'address' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-neutral-400 block mb-1">
                      Exact Amount to Transfer
                    </label>
                    <div className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 p-2">
                      <span className="font-mono text-xs font-semibold text-amber-300 truncate flex-1">
                        {amountToPay} {activeToken}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(amountToPay, 'amount')}
                        className="rounded-lg bg-neutral-800 p-1.5 text-neutral-300 hover:text-white transition"
                        title="Copy Amount"
                      >
                        {copiedField === 'amount' ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Network Warning */}
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-400/90 leading-relaxed">
                ⚠️ <strong>Network Safety:</strong> Please send only{' '}
                <strong className="text-white">{activeToken}</strong> on the{' '}
                <strong className="text-white">{chainMeta.badge}</strong>. Sending via an
                unsupported network may result in loss of funds.
              </div>

              {/* Optional TX Hash Input & Confirmation Button */}
              <div className="pt-2 border-t border-neutral-850 space-y-2">
                <input
                  type="text"
                  placeholder="Optional: Transaction Hash / ID (e.g. 0x... or txid)"
                  value={txHashInput}
                  onChange={(e) => setTxHashInput(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-200 placeholder-neutral-600 focus:border-indigo-500 focus:outline-none"
                />

                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmManualPayment}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-emerald-500 transition disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>I Have Sent the Payment ({selectedPack.credits} Credits)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-500">
          <div className="flex items-center gap-2.5">
            <span>Supported: BSC, ETH, BTC, POL, Base, Arbitrum</span>
            <span>•</span>
            <Link
              href="/transactions"
              onClick={onClose}
              className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition underline"
            >
              <ReceiptText className="h-3 w-3" />
              <span>View Transactions</span>
            </Link>
          </div>
          {chainMeta.explorerUrl && (
            <a
              href={chainMeta.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-neutral-400 transition"
            >
              <span>{chainMeta.name} Explorer</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
