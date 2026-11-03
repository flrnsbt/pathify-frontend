import defaultWalletsData from '@/config/wallets.json';

export type SupportedChainKey = 'bsc' | 'eth' | 'btc' | 'pol' | 'base' | 'arbitrum';
export type SupportedToken = 'ETH' | 'BTC' | 'USDT' | 'USDC' | 'BNB' | 'POL';

export interface ChainMetadata {
  key: SupportedChainKey;
  name: string;
  shortName: string;
  badge: string;
  chainId?: number;
  isEvm: boolean;
  tokens: SupportedToken[];
  nativeToken: SupportedToken;
  explorerUrl?: string;
  color: string;
  bgGlow: string;
}

export const SUPPORTED_CHAINS: Record<SupportedChainKey, ChainMetadata> = {
  bsc: {
    key: 'bsc',
    name: 'BNB Smart Chain',
    shortName: 'BNB Chain',
    badge: 'BEP-20',
    chainId: 56,
    isEvm: true,
    tokens: ['USDT', 'USDC', 'BNB'],
    nativeToken: 'BNB',
    explorerUrl: 'https://bscscan.com',
    color: '#F3BA2F',
    bgGlow: 'rgba(243, 186, 47, 0.12)',
  },
  eth: {
    key: 'eth',
    name: 'Ethereum',
    shortName: 'Ethereum',
    badge: 'ERC-20',
    chainId: 1,
    isEvm: true,
    tokens: ['ETH', 'USDT', 'USDC'],
    nativeToken: 'ETH',
    explorerUrl: 'https://etherscan.io',
    color: '#627EEA',
    bgGlow: 'rgba(98, 126, 234, 0.12)',
  },
  btc: {
    key: 'btc',
    name: 'Bitcoin Network',
    shortName: 'Bitcoin',
    badge: 'Mainnet',
    isEvm: false,
    tokens: ['BTC'],
    nativeToken: 'BTC',
    explorerUrl: 'https://mempool.space',
    color: '#F7931A',
    bgGlow: 'rgba(247, 147, 26, 0.12)',
  },
  pol: {
    key: 'pol',
    name: 'Polygon',
    shortName: 'Polygon',
    badge: 'PoS',
    chainId: 137,
    isEvm: true,
    tokens: ['USDT', 'USDC', 'POL'],
    nativeToken: 'POL',
    explorerUrl: 'https://polygonscan.com',
    color: '#8247E5',
    bgGlow: 'rgba(130, 71, 229, 0.12)',
  },
  base: {
    key: 'base',
    name: 'Base',
    shortName: 'Base',
    badge: 'L2',
    chainId: 8453,
    isEvm: true,
    tokens: ['ETH', 'USDC'],
    nativeToken: 'ETH',
    explorerUrl: 'https://basescan.org',
    color: '#0052FF',
    bgGlow: 'rgba(0, 82, 255, 0.12)',
  },
  arbitrum: {
    key: 'arbitrum',
    name: 'Arbitrum One',
    shortName: 'Arbitrum',
    badge: 'L2',
    chainId: 42161,
    isEvm: true,
    tokens: ['ETH', 'USDT', 'USDC'],
    nativeToken: 'ETH',
    explorerUrl: 'https://arbiscan.io',
    color: '#28A0F0',
    bgGlow: 'rgba(40, 160, 240, 0.12)',
  },
};

export const ERC20_CONTRACTS: Record<number, Partial<Record<SupportedToken, { address: `0x${string}`; decimals: number }>>> = {
  1: {
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  },
  56: {
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
  },
  137: {
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    USDC: { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
  },
  8453: {
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
  },
  42161: {
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
  },
};

export interface RawWalletConfig {
  chainId?: number | string;
  chain?: string;
  network?: string;
  token?: string;
  symbol?: string;
  wallet?: string;
  address?: string;
  walletAddress?: string;
  recipient?: string;
  tokens?: string[];
}

export interface ParsedPaymentWallet {
  chainId?: number;
  chainKey: SupportedChainKey;
  token?: SupportedToken;
  wallet: string;
}

/**
 * Normalizes chain string / chainId to a SupportedChainKey
 */
export function normalizeChainKey(input?: string | number): SupportedChainKey | null {
  if (input === undefined || input === null) return null;
  const str = String(input).toLowerCase().trim();

  if (str === '1' || str === 'eth' || str === 'ethereum' || str === 'mainnet') return 'eth';
  if (str === '56' || str === 'bsc' || str === 'binance' || str === 'bnb') return 'bsc';
  if (str === '137' || str === 'pol' || str === 'polygon' || str === 'matic') return 'pol';
  if (str === '8453' || str === 'base') return 'base';
  if (str === '42161' || str === 'arbitrum' || str === 'arb' || str === 'arb1') return 'arbitrum';
  if (str === 'btc' || str === 'bitcoin') return 'btc';

  return null;
}

/**
 * Normalizes token string to a SupportedToken
 */
export function normalizeToken(input?: string): SupportedToken | null {
  if (!input) return null;
  const upper = input.toUpperCase().trim();
  if (['ETH', 'BTC', 'USDT', 'USDC', 'BNB', 'POL'].includes(upper)) {
    return upper as SupportedToken;
  }
  return null;
}

/**
 * Parses payment wallets from:
 * 1. Explicit rawEnv string
 * 2. NEXT_PUBLIC_PAYMENT_WALLETS or PAYMENT_WALLETS environment variable
 * 3. Fallback to src/config/wallets.json
 */
export function parsePaymentWallets(rawEnv?: string): ParsedPaymentWallet[] {
  const content = rawEnv || process.env.NEXT_PUBLIC_PAYMENT_WALLETS || process.env.PAYMENT_WALLETS || '';

  // If no environment variable is provided, load default wallets from wallets.json
  if (!content.trim()) {
    if (defaultWalletsData && Array.isArray(defaultWalletsData.wallets)) {
      const results: ParsedPaymentWallet[] = [];
      for (const item of defaultWalletsData.wallets as RawWalletConfig[]) {
        const chainKey = normalizeChainKey(item.chainId || item.chain);
        const wallet = item.address || item.wallet;
        if (chainKey && wallet) {
          results.push({
            chainId: typeof item.chainId === 'number' ? item.chainId : undefined,
            chainKey,
            wallet: wallet.trim(),
          });
        }
      }
      return results;
    }
    return [];
  }

  const results: ParsedPaymentWallet[] = [];

  // Check if standard JSON array
  if (content.trim().startsWith('[')) {
    try {
      const arr = JSON.parse(content) as RawWalletConfig[];
      for (const item of arr) {
        const chainKey = normalizeChainKey(item.chainId || item.chain || item.network);
        const wallet = item.wallet || item.address || item.walletAddress || item.recipient;
        if (chainKey && wallet) {
          results.push({
            chainId: typeof item.chainId === 'number' ? item.chainId : undefined,
            chainKey,
            token: normalizeToken(item.token || item.symbol) || undefined,
            wallet: wallet.trim(),
          });
        }
      }
      return results;
    } catch {
      // Fallback to line by line parsing
    }
  }

  // Parse JSON Lines
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    try {
      const item = JSON.parse(trimmed) as RawWalletConfig;
      const chainKey = normalizeChainKey(item.chainId || item.chain || item.network);
      const wallet = item.wallet || item.address || item.walletAddress || item.recipient;
      if (chainKey && wallet) {
        results.push({
          chainId: typeof item.chainId === 'number' ? item.chainId : undefined,
          chainKey,
          token: normalizeToken(item.token || item.symbol) || undefined,
          wallet: wallet.trim(),
        });
      }
    } catch {
      // Ignore invalid line
    }
  }

  return results;
}

/**
 * Resolves the recipient wallet address for a given chain and token.
 */
export function getRecipientWallet(
  chainKey: SupportedChainKey,
  token: SupportedToken,
  configuredWallets?: ParsedPaymentWallet[]
): string {
  const wallets = configuredWallets || parsePaymentWallets();

  // 1. Exact match on chain and token
  const exact = wallets.find((w) => w.chainKey === chainKey && w.token === token);
  if (exact) return exact.wallet;

  // 2. Chain match without specific token
  const chainOnly = wallets.find((w) => w.chainKey === chainKey && !w.token);
  if (chainOnly) return chainOnly.wallet;

  // 3. If EVM chain, check if an EVM wallet exists on another EVM chain
  const isEvm = SUPPORTED_CHAINS[chainKey]?.isEvm;
  if (isEvm) {
    const anyEvm = wallets.find((w) => SUPPORTED_CHAINS[w.chainKey]?.isEvm);
    if (anyEvm) return anyEvm.wallet;
  }

  // 4. Default safe fallback placeholder addresses
  if (chainKey === 'btc') {
    return 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
  }
  return '0x0000000000000000000000000000000000000000';
}

export interface CreditPack {
  id: string;
  credits: number;
  usdPrice: number;
  popular?: boolean;
  cryptoPrices: Record<SupportedToken, string>;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack-25',
    credits: 25,
    usdPrice: 5,
    cryptoPrices: {
      USDT: '5',
      USDC: '5',
      ETH: '0.0018',
      BTC: '0.000075',
      BNB: '0.008',
      POL: '15',
    },
  },
  {
    id: 'pack-100',
    credits: 100,
    usdPrice: 15,
    popular: true,
    cryptoPrices: {
      USDT: '15',
      USDC: '15',
      ETH: '0.0055',
      BTC: '0.00022',
      BNB: '0.024',
      POL: '45',
    },
  },
  {
    id: 'pack-500',
    credits: 500,
    usdPrice: 50,
    cryptoPrices: {
      USDT: '50',
      USDC: '50',
      ETH: '0.018',
      BTC: '0.00075',
      BNB: '0.08',
      POL: '150',
    },
  },
];
