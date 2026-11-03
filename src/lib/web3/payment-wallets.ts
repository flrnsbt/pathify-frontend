/**
 * Crypto Payment Configuration & Wallet Management
 * Modular, multi-chain configuration for EVM networks.
 */

export const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === "true";

export type SupportedChainKey =
  | "bsc"
  | "eth"
  | "pol"
  | "base"
  | "arbitrum"
  | "op"
  | "avax"
  | "plasma";

export type SupportedToken =
  | "ETH"
  | "USDT"
  | "USDC"
  | "BNB"
  | "POL"
  | "AVAX"
  | "XPL";

export interface ChainMetadata {
  key: SupportedChainKey;
  name: string;
  shortName: string;
  badge: string;
  chainId: number;
  isEvm: boolean;
  tokens: SupportedToken[];
  nativeToken: SupportedToken;
  explorerUrl: string;
  color: string;
  bgGlow: string;
}

const MAINNET_CHAINS: Record<SupportedChainKey, ChainMetadata> = {
  bsc: {
    key: "bsc",
    name: "BNB Smart Chain",
    shortName: "BNB Chain",
    badge: "BEP-20",
    chainId: 56,
    isEvm: true,
    tokens: ["USDT", "USDC", "BNB"],
    nativeToken: "BNB",
    explorerUrl: "https://bscscan.com",
    color: "#F3BA2F",
    bgGlow: "rgba(243, 186, 47, 0.12)",
  },
  eth: {
    key: "eth",
    name: "Ethereum",
    shortName: "Ethereum",
    badge: "ERC-20",
    chainId: 1,
    isEvm: true,
    tokens: ["ETH", "USDT", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://etherscan.io",
    color: "#627EEA",
    bgGlow: "rgba(98, 126, 234, 0.12)",
  },
  pol: {
    key: "pol",
    name: "Polygon",
    shortName: "Polygon",
    badge: "PoS",
    chainId: 137,
    isEvm: true,
    tokens: ["USDT", "USDC", "POL"],
    nativeToken: "POL",
    explorerUrl: "https://polygonscan.com",
    color: "#8247E5",
    bgGlow: "rgba(130, 71, 229, 0.12)",
  },
  base: {
    key: "base",
    name: "Base",
    shortName: "Base",
    badge: "L2",
    chainId: 8453,
    isEvm: true,
    tokens: ["ETH", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://basescan.org",
    color: "#0052FF",
    bgGlow: "rgba(0, 82, 255, 0.12)",
  },
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum One",
    shortName: "Arbitrum",
    badge: "L2",
    chainId: 42161,
    isEvm: true,
    tokens: ["ETH", "USDT", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://arbiscan.io",
    color: "#28A0F0",
    bgGlow: "rgba(40, 160, 240, 0.12)",
  },
  op: {
    key: "op",
    name: "Optimism",
    shortName: "Optimism",
    badge: "L2",
    chainId: 10,
    isEvm: true,
    tokens: ["ETH", "USDT", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://optimistic.etherscan.io",
    color: "#FF0420",
    bgGlow: "rgba(255, 4, 32, 0.12)",
  },
  avax: {
    key: "avax",
    name: "Avalanche",
    shortName: "Avalanche",
    badge: "C-Chain",
    chainId: 43114,
    isEvm: true,
    tokens: ["AVAX", "USDT", "USDC"],
    nativeToken: "AVAX",
    explorerUrl: "https://snowtrace.io",
    color: "#E84142",
    bgGlow: "rgba(232, 65, 66, 0.12)",
  },
  plasma: {
    key: "plasma",
    name: "Plasma",
    shortName: "Plasma",
    badge: "L2",
    chainId: 9745,
    isEvm: true,
    tokens: ["XPL", "USDC"],
    nativeToken: "XPL",
    explorerUrl: "https://plasmascan.to",
    color: "#7C3AED",
    bgGlow: "rgba(124, 58, 237, 0.12)",
  },
};

const TESTNET_CHAINS: Record<SupportedChainKey, ChainMetadata> = {
  bsc: {
    key: "bsc",
    name: "BNB Smart Chain Testnet",
    shortName: "BNB Testnet",
    badge: "BEP-20",
    chainId: 97,
    isEvm: true,
    tokens: ["USDT", "USDC", "BNB"],
    nativeToken: "BNB",
    explorerUrl: "https://testnet.bscscan.com",
    color: "#F3BA2F",
    bgGlow: "rgba(243, 186, 47, 0.12)",
  },
  eth: {
    key: "eth",
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    badge: "ERC-20",
    chainId: 11155111,
    isEvm: true,
    tokens: ["ETH", "USDT", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://sepolia.etherscan.io",
    color: "#627EEA",
    bgGlow: "rgba(98, 126, 234, 0.12)",
  },
  pol: {
    key: "pol",
    name: "Polygon Amoy",
    shortName: "Amoy",
    badge: "PoS",
    chainId: 80002,
    isEvm: true,
    tokens: ["USDT", "USDC", "POL"],
    nativeToken: "POL",
    explorerUrl: "https://amoy.polygonscan.com",
    color: "#8247E5",
    bgGlow: "rgba(130, 71, 229, 0.12)",
  },
  base: {
    key: "base",
    name: "Base Sepolia",
    shortName: "Base Sepolia",
    badge: "L2",
    chainId: 84532,
    isEvm: true,
    tokens: ["ETH", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://sepolia.basescan.org",
    color: "#0052FF",
    bgGlow: "rgba(0, 82, 255, 0.12)",
  },
  arbitrum: {
    key: "arbitrum",
    name: "Arbitrum Sepolia",
    shortName: "Arb Sepolia",
    badge: "L2",
    chainId: 421614,
    isEvm: true,
    tokens: ["ETH", "USDT", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://sepolia.arbiscan.io",
    color: "#28A0F0",
    bgGlow: "rgba(40, 160, 240, 0.12)",
  },
  op: {
    key: "op",
    name: "Optimism Sepolia",
    shortName: "OP Sepolia",
    badge: "L2",
    chainId: 11155420,
    isEvm: true,
    tokens: ["ETH", "USDC"],
    nativeToken: "ETH",
    explorerUrl: "https://optimism-sepolia.blockscout.com",
    color: "#FF0420",
    bgGlow: "rgba(255, 4, 32, 0.12)",
  },
  avax: {
    key: "avax",
    name: "Avalanche Fuji",
    shortName: "Fuji",
    badge: "C-Chain",
    chainId: 43113,
    isEvm: true,
    tokens: ["AVAX", "USDT", "USDC"],
    nativeToken: "AVAX",
    explorerUrl: "https://testnet.snowtrace.io",
    color: "#E84142",
    bgGlow: "rgba(232, 65, 66, 0.12)",
  },
  plasma: {
    key: "plasma",
    name: "Plasma Testnet",
    shortName: "Plasma",
    badge: "L2",
    chainId: 9746,
    isEvm: true,
    tokens: ["XPL"],
    nativeToken: "XPL",
    explorerUrl: "https://testnet.plasmascan.to",
    color: "#7C3AED",
    bgGlow: "rgba(124, 58, 237, 0.12)",
  },
};

export const SUPPORTED_CHAINS: Record<SupportedChainKey, ChainMetadata> =
  isDebugMode ? TESTNET_CHAINS : MAINNET_CHAINS;

const MAINNET_ERC20_CONTRACTS: Record<
  number,
  Partial<Record<SupportedToken, { address: `0x${string}`; decimals: number }>>
> = {
  1: {
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
    },
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
    },
  },
  56: {
    USDT: {
      address: "0x55d398326f99059fF775485246999027B3197955",
      decimals: 18,
    },
    USDC: {
      address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      decimals: 18,
    },
  },
  137: {
    USDT: {
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
    },
    USDC: {
      address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      decimals: 6,
    },
  },
  8453: {
    USDC: {
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
  },
  42161: {
    USDT: {
      address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      decimals: 6,
    },
    USDC: {
      address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      decimals: 6,
    },
  },
  10: {
    USDT: {
      address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      decimals: 6,
    },
    USDC: {
      address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      decimals: 6,
    },
  },
  43114: {
    USDT: {
      address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
      decimals: 6,
    },
    USDC: {
      address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      decimals: 6,
    },
  },
  9745: {
    USDC: {
      address: "0x2d661C89D812261039AF9764eceaAee884f5F67F",
      decimals: 6,
    },
  },
};

const TESTNET_ERC20_CONTRACTS: Record<
  number,
  Partial<Record<SupportedToken, { address: `0x${string}`; decimals: number }>>
> = {
  11155111: {
    USDT: {
      address: "0x7169d38820dfd117c3fa1f22a697dba58d90ba06",
      decimals: 18,
    },
    USDC: {
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
      decimals: 6,
    },
  },
  97: {
    USDT: {
      address: "0xf4B41a53b67652E83f59df082F3CA342252b7E20",
      decimals: 18,
    },
  },
  80002: {
    USDT: {
      address: "0x056Fd409E1d491d221329E89416B166c23615001",
      decimals: 6,
    },
    USDC: {
      address: "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582",
      decimals: 6,
    },
  },
  84532: {
    USDC: {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      decimals: 6,
    },
  },
  421614: {
    USDC: {
      address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
      decimals: 6,
    },
  },
  11155420: {
    USDC: {
      address: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
      decimals: 6,
    },
    USDT: {
      address: "0xDCa91575A8bb40a1EbC4C8985d0d05fbfb16D9d6",
      decimals: 6,
    },
  },
  43113: {
    USDT: {
      address: "0x04A5d3a6eDb6c2cb0A17B3BF2cD0D25efCB38679",
      decimals: 6,
    },
    USDC: {
      address: "0x5425890298aed601595a70ab815c96711a31bc65",
      decimals: 6,
    },
  },
  9745: {
    USDT: {
      address: "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
      decimals: 6,
    },
    USDC: {
      address: "0xE67Fb267022cBA8064Dd388CC2FED724F3120D9D",
      decimals: 6,
    },
  },
};

export const ERC20_CONTRACTS: Record<
  number,
  Partial<Record<SupportedToken, { address: `0x${string}`; decimals: number }>>
> = isDebugMode ? TESTNET_ERC20_CONTRACTS : MAINNET_ERC20_CONTRACTS;

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
 * Validates whether an address string is a non-empty, non-zero EVM address.
 */
export function isValidWalletAddress(address?: string | null): boolean {
  if (!address) return false;
  const trimmed = address.trim();
  if (trimmed.length !== 42) return false;
  if (/^0x0+$/i.test(trimmed)) return false;
  if (trimmed.toLowerCase() === "0x0000000000000000000000000000000000000000")
    return false;
  return /^0x[a-fA-F0-9]{40}$/.test(trimmed);
}

/**
 * Normalizes chain string / chainId to a SupportedChainKey
 */
export function normalizeChainKey(
  input?: string | number,
): SupportedChainKey | null {
  if (input === undefined || input === null) return null;
  const str = String(input).toLowerCase().trim();

  // Mainnet chain IDs and names
  if (str === "1" || str === "eth" || str === "ethereum" || str === "mainnet")
    return "eth";
  if (str === "56" || str === "bsc" || str === "binance" || str === "bnb")
    return "bsc";
  if (str === "137" || str === "pol" || str === "polygon" || str === "matic")
    return "pol";
  if (str === "8453" || str === "base") return "base";
  if (str === "42161" || str === "arbitrum" || str === "arb" || str === "arb1")
    return "arbitrum";
  if (str === "10" || str === "op" || str === "optimism") return "op";
  if (
    str === "43114" ||
    str === "avax" ||
    str === "avalanche" ||
    str === "avalanchec"
  )
    return "avax";
  if (str === "9745" || str === "plasma") return "plasma";

  // Testnet chain IDs
  if (str === "11155111" || str === "sepolia") return "eth";
  if (str === "97" || str === "bsctestnet") return "bsc";
  if (str === "80002" || str === "amoy" || str === "polygonamoy") return "pol";
  if (str === "84532" || str === "basesepolia") return "base";
  if (str === "421614" || str === "arbitrumsepolia") return "arbitrum";
  if (str === "11155420" || str === "opsepolia" || str === "optimismsepolia")
    return "op";
  if (str === "43113" || str === "fuji" || str === "avalanchefuji")
    return "avax";
  if (str === "9746" || str === "plasmatestnet") return "plasma";

  return null;
}

/**
 * Normalizes token string to a SupportedToken
 */
export function normalizeToken(input?: string): SupportedToken | null {
  if (!input) return null;
  const upper = input.toUpperCase().trim();
  if (["ETH", "USDT", "USDC", "BNB", "POL", "AVAX", "XPL"].includes(upper)) {
    return upper as SupportedToken;
  }
  return null;
}

let cachedWalletsPromise: Promise<ParsedPaymentWallet[]> | null = null;
let cachedWallets: ParsedPaymentWallet[] | null = null;

export function getCachedPaymentWallets(): ParsedPaymentWallet[] | null {
  return cachedWallets;
}

/**
 * Normalizes raw array of wallet configs into ParsedPaymentWallet[]
 */
export function parseWalletList(
  items: RawWalletConfig[],
): ParsedPaymentWallet[] {
  const results: ParsedPaymentWallet[] = [];
  for (const item of items) {
    const chainKey = normalizeChainKey(
      item.chainId ?? item.chain ?? item.network,
    );
    const wallet =
      item.wallet || item.address || item.walletAddress || item.recipient;
    if (chainKey && wallet && isValidWalletAddress(wallet)) {
      results.push({
        chainId: typeof item.chainId === "number" ? item.chainId : undefined,
        chainKey,
        token: normalizeToken(item.token || item.symbol) || undefined,
        wallet: wallet.trim(),
      });
    }
  }
  return results;
}

/**
 * Asynchronously loads payment wallets once from:
 * - "@/config/dev.wallets.json" if debug mode is active
 * - "@/config/wallets.json" otherwise
 * Caches the in-flight Promise and the parsed result so subsequent calls resolve immediately.
 */
export async function loadPaymentWallets(): Promise<ParsedPaymentWallet[]> {
  if (cachedWallets) {
    return cachedWallets;
  }

  if (!cachedWalletsPromise) {
    cachedWalletsPromise = (async () => {
      try {
        const mod = isDebugMode
          ? await import("@/config/dev.wallets.json")
          : await import("@/config/wallets.json");
        const data = mod.default || mod;
        const rawList = Array.isArray(data?.wallets)
          ? data.wallets
          : Array.isArray(data)
            ? data
            : [];
        const parsed = parseWalletList(rawList);
        cachedWallets = parsed;
        return parsed;
      } catch (err) {
        console.warn(
          "Failed to load wallets json asynchronously, falling back to default:",
          err,
        );
        try {
          const fallbackMod = await import("@/config/wallets.json");
          const fallbackData = fallbackMod.default || fallbackMod;
          const rawList = Array.isArray(fallbackData?.wallets)
            ? fallbackData.wallets
            : Array.isArray(fallbackData)
              ? fallbackData
              : [];
          const parsed = parseWalletList(rawList);
          cachedWallets = parsed;
          return parsed;
        } catch {
          return [];
        }
      }
    })();
  }

  return cachedWalletsPromise;
}

/**
 * Parses payment wallets from:
 * 1. Explicit rawEnv string
 * 2. NEXT_PUBLIC_PAYMENT_WALLETS environment variable
 * 3. Cached payment wallets loaded asynchronously
 */
export function parsePaymentWallets(rawEnv?: string): ParsedPaymentWallet[] {
  const content =
    rawEnv ||
    (typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_PAYMENT_WALLETS || ""
      : "");

  if (!content.trim()) {
    return cachedWallets || [];
  }

  // Check if standard JSON array
  if (content.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(content) as RawWalletConfig[];
      return parseWalletList(arr);
    } catch {
      // Fallback to line by line parsing
    }
  }

  // Parse JSON Lines
  const results: ParsedPaymentWallet[] = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//"))
      continue;
    try {
      const item = JSON.parse(trimmed) as RawWalletConfig;
      const chainKey = normalizeChainKey(
        item.chainId ?? item.chain ?? item.network,
      );
      const wallet =
        item.wallet || item.address || item.walletAddress || item.recipient;
      if (chainKey && wallet && isValidWalletAddress(wallet)) {
        results.push({
          chainId: typeof item.chainId === "number" ? item.chainId : undefined,
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
 * Resolves the recipient wallet address for a given chain, token, and optional chainId.
 */
export function getRecipientWallet(
  chainKey: SupportedChainKey,
  token: SupportedToken,
  configuredWallets?: ParsedPaymentWallet[],
  targetChainId?: number,
): string {
  const wallets =
    configuredWallets && configuredWallets.length > 0
      ? configuredWallets
      : cachedWallets && cachedWallets.length > 0
        ? cachedWallets
        : parsePaymentWallets();

  const validWallets = wallets.filter((w) => isValidWalletAddress(w.wallet));

  // 0. Exact match by chainId and token if targetChainId is provided
  if (targetChainId) {
    const exactIdAndToken = validWallets.find(
      (w) => w.chainId === targetChainId && w.token === token,
    );
    if (exactIdAndToken) return exactIdAndToken.wallet;

    const idMatch = validWallets.find(
      (w) => w.chainId === targetChainId && !w.token,
    );
    if (idMatch) return idMatch.wallet;
  }

  // 1. Exact match on chain and token
  const exact = validWallets.find(
    (w) => w.chainKey === chainKey && w.token === token,
  );
  if (exact) return exact.wallet;

  // 2. Chain match without specific token
  const chainOnly = validWallets.find(
    (w) => w.chainKey === chainKey && !w.token,
  );
  if (chainOnly) return chainOnly.wallet;

  // If no recipient address is configured for this chain, return empty string
  return "";
}

/**
 * Returns list of Supported Chains that have a valid wallet address defined in the loaded wallets.
 */
export function getAvailableChains(
  wallets: ParsedPaymentWallet[],
): ChainMetadata[] {
  return Object.values(SUPPORTED_CHAINS).filter((chain) => {
    return wallets.some((w) => {
      if (!isValidWalletAddress(w.wallet)) return false;
      if (w.chainId && chain.chainId && w.chainId === chain.chainId)
        return true;
      return w.chainKey === chain.key;
    });
  });
}

export interface CreditPack {
  id: string;
  credits: number;
  usdPrice: number;
  popular?: boolean;
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: "pack-25",
    credits: 25,
    usdPrice: 5,
  },
  {
    id: "pack-100",
    credits: 100,
    usdPrice: 15,
    popular: true,
  },
  {
    id: "pack-500",
    credits: 500,
    usdPrice: 50,
  },
];

export {
  fetchLiveTokenPrices,
  getCachedTokenPrices,
  calculateCryptoAmount,
  DEFAULT_TOKEN_PRICES_USD,
} from "./token-prices";
