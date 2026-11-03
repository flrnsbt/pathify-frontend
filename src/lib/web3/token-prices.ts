/**
 * Real-time Token Price Conversion Service
 * Provides live USD conversion rates for native and ERC-20 crypto tokens.
 * Caches quotes in memory to minimize network overhead and prevent rate limits.
 */

import { SupportedToken } from './payment-wallets';

export const DEFAULT_TOKEN_PRICES_USD: Record<SupportedToken, number> = {
  USDT: 1.0,
  USDC: 1.0,
  ETH: 2300.0,
  BNB: 700.0,
  AVAX: 8.5,
  POL: 0.09,
  XPL: 0.065,
};

interface CachedPrices {
  prices: Record<SupportedToken, number>;
  timestamp: number;
}

let cachedPrices: CachedPrices | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Fetches real-time USD prices for supported crypto assets.
 * Uses Binance public ticker API, falling back to CoinGecko, and then to internal defaults.
 */
export async function fetchLiveTokenPrices(): Promise<Record<SupportedToken, number>> {
  const now = Date.now();
  if (cachedPrices && now - cachedPrices.timestamp < CACHE_TTL_MS) {
    return cachedPrices.prices;
  }

  const prices: Record<SupportedToken, number> = { ...DEFAULT_TOKEN_PRICES_USD };

  // 1. Fetch live rates from Binance ticker API
  try {
    const symbols = JSON.stringify(['ETHUSDT', 'BNBUSDT', 'POLUSDT', 'AVAXUSDT']);
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`,
      { cache: 'no-store' }
    );
    if (res.ok) {
      const data = (await res.json()) as Array<{ symbol: string; price: string }>;
      for (const item of data) {
        const val = parseFloat(item.price);
        if (Number.isFinite(val) && val > 0) {
          if (item.symbol === 'ETHUSDT') prices.ETH = val;
          if (item.symbol === 'BNBUSDT') prices.BNB = val;
          if (item.symbol === 'POLUSDT') prices.POL = val;
          if (item.symbol === 'AVAXUSDT') prices.AVAX = val;
        }
      }
    }
  } catch (err) {
    console.warn('Binance price fetch error, attempting fallback:', err);
  }

  // 2. Fetch CoinGecko as fallback and for Plasma (XPL)
  try {
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,polygon-ecosystem-token,avalanche-2,plasma&vs_currencies=usd',
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    );
    if (cgRes.ok) {
      const cgData = (await cgRes.json()) as Record<string, { usd?: number }>;
      if (cgData.plasma?.usd) prices.XPL = cgData.plasma.usd;
      if (!prices.ETH && cgData.ethereum?.usd) prices.ETH = cgData.ethereum.usd;
      if (!prices.BNB && cgData.binancecoin?.usd) prices.BNB = cgData.binancecoin.usd;
      if (!prices.POL && cgData['polygon-ecosystem-token']?.usd) prices.POL = cgData['polygon-ecosystem-token'].usd;
      if (!prices.AVAX && cgData['avalanche-2']?.usd) prices.AVAX = cgData['avalanche-2'].usd;
    }
  } catch (err) {
    console.warn('CoinGecko price fetch error:', err);
  }

  cachedPrices = { prices, timestamp: now };
  return prices;
}

/**
 * Returns currently cached prices or defaults synchronously without waiting for network.
 */
export function getCachedTokenPrices(): Record<SupportedToken, number> {
  return cachedPrices?.prices || DEFAULT_TOKEN_PRICES_USD;
}

/**
 * Converts USD price of a credit pack into the exact crypto amount based on live exchange rates.
 */
export function calculateCryptoAmount(
  usdPrice: number,
  token: SupportedToken,
  livePrices?: Record<SupportedToken, number>
): string {
  // Stablecoins are 1:1 with USD
  if (token === 'USDT' || token === 'USDC') {
    return usdPrice.toString();
  }

  const rates = livePrices || cachedPrices?.prices || DEFAULT_TOKEN_PRICES_USD;
  const tokenPriceUsd = rates[token] || DEFAULT_TOKEN_PRICES_USD[token] || 1;

  if (tokenPriceUsd <= 0) {
    return '0';
  }

  const rawAmount = usdPrice / tokenPriceUsd;

  // Format with clean decimal precision
  if (rawAmount >= 10) {
    return rawAmount.toFixed(2);
  } else if (rawAmount >= 1) {
    return rawAmount.toFixed(3);
  } else if (rawAmount >= 0.01) {
    return rawAmount.toFixed(4);
  } else {
    return rawAmount.toFixed(5);
  }
}
