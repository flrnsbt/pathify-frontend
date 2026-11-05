/**
 * Crypto Payment Configuration & Wallet Management
 * Modular, multi-chain configuration for EVM networks.
 */

import { APP_CONFIG } from "@/config/app.config";
import { getAppCheckToken } from "../firebase/app-check";
import { buildApiHeaders } from "../api-headers";

export interface BackendChainConfig {
  key: string;
  name: string;
  chainId?: number;
  isEvm: boolean;
  rpcUrls: string[];
  nativeToken: string;
  tokens: string[];
  explorerUrl: string;
}

export interface BackendWalletConfig {
  chainKey: string;
  chainId?: number;
  token?: string;
  address: string;
}

export interface BackendTokenContract {
  address: string;
  decimals: number;
}

export interface BackendConfigResponse {
  chains: Record<string, BackendChainConfig>;
  wallets: BackendWalletConfig[];
  erc20Contracts: Record<number, Record<string, BackendTokenContract>>;
  isTestnet: boolean;
}

let backendConfigCache: BackendConfigResponse | null = null;
let backendConfigPromise: Promise<BackendConfigResponse> | null = null;

/**
 * Fetches chain and wallet configuration from backend via Next.js proxy.
 * The proxy injects API_SECRET and forwards App Check server-side.
 */
export async function fetchBackendConfig(): Promise<BackendConfigResponse> {
  if (backendConfigCache) {
    return backendConfigCache;
  }

  if (!backendConfigPromise) {
    backendConfigPromise = (async () => {
      try {
        const url = APP_CONFIG.api.configUrl;
        const appCheckToken = await getAppCheckToken();

        const headers = buildApiHeaders({ appCheckToken });
        const response = await fetch(url, {
          method: 'GET',
          headers: headers
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status}`);
        }
        const config = (await response.json()) as BackendConfigResponse;
        backendConfigCache = config;
        return config;
      } catch (err) {
        console.error("Failed to fetch backend config:", err);
        throw err;
      }
    })();
  }

  return backendConfigPromise;
}

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

/**
 * UI-only styling data per chain key. This is the only frontend-specific data
 * that doesn't belong in the backend — colors, badges, and short display names.
 */
const UI_CHAIN_STYLING: Record<SupportedChainKey, {
  color: string;
  bgGlow: string;
  badge: string;
  shortName: string;
}> = {
  bsc: {
    color: "#F3BA2F",
    bgGlow: "rgba(243, 186, 47, 0.12)",
    badge: "BEP-20",
    shortName: "BNB Chain",
  },
  eth: {
    color: "#627EEA",
    bgGlow: "rgba(98, 126, 234, 0.12)",
    badge: "ERC-20",
    shortName: "Ethereum",
  },
  pol: {
    color: "#8247E5",
    bgGlow: "rgba(130, 71, 229, 0.12)",
    badge: "PoS",
    shortName: "Polygon",
  },
  base: {
    color: "#0052FF",
    bgGlow: "rgba(0, 82, 255, 0.12)",
    badge: "L2",
    shortName: "Base",
  },
  arbitrum: {
    color: "#28A0F0",
    bgGlow: "rgba(40, 160, 240, 0.12)",
    badge: "L2",
    shortName: "Arbitrum",
  },
  op: {
    color: "#FF0420",
    bgGlow: "rgba(255, 4, 32, 0.12)",
    badge: "L2",
    shortName: "Optimism",
  },
  avax: {
    color: "#E84142",
    bgGlow: "rgba(232, 65, 66, 0.12)",
    badge: "C-Chain",
    shortName: "Avalanche",
  },
  plasma: {
    color: "#7C3AED",
    bgGlow: "rgba(124, 58, 237, 0.12)",
    badge: "L2",
    shortName: "Plasma",
  },
};

let supportedChainsCache: Record<SupportedChainKey, ChainMetadata> | null = null;

/**
 * Build ChainMetadata from backend config, merging with UI-only styling.
 * The backend is the single source of truth for all chain data.
 */
function buildChainMetadataFromBackend(
  backendConfig: BackendConfigResponse,
): Record<SupportedChainKey, ChainMetadata> {
  const chains: Record<SupportedChainKey, ChainMetadata> = {} as Record<SupportedChainKey, ChainMetadata>;

  for (const [key, backendChain] of Object.entries(backendConfig.chains)) {
    const chainKey = key as SupportedChainKey;
    const uiStyle = UI_CHAIN_STYLING[chainKey];

    if (uiStyle) {
      chains[chainKey] = {
        key: chainKey,
        name: backendChain.name,
        shortName: uiStyle.shortName,
        badge: uiStyle.badge,
        chainId: backendChain.chainId ?? 0,
        isEvm: backendChain.isEvm,
        tokens: backendChain.tokens as SupportedToken[],
        nativeToken: backendChain.nativeToken as SupportedToken,
        explorerUrl: backendChain.explorerUrl,
        color: uiStyle.color,
        bgGlow: uiStyle.bgGlow,
      };
    }
  }

  return chains;
}

/**
 * Get supported chains from backend config, merged with UI styling.
 * The backend is the single source of truth for all chain data.
 */
export async function getSupportedChains(): Promise<
  Record<SupportedChainKey, ChainMetadata>
> {
  if (supportedChainsCache) {
    return supportedChainsCache;
  }

  try {
    const backendConfig = await fetchBackendConfig();
    supportedChainsCache = buildChainMetadataFromBackend(backendConfig);
    return supportedChainsCache;
  } catch (err) {
    console.warn("Failed to load chains from backend:", err);
    throw err;
  }
}

// Cached ERC20 contracts from backend
let cachedErc20Contracts: Record<number, Record<string, { address: `0x${string}`; decimals: number }>> | null = null;

/**
 * Get ERC20 contract addresses from backend config.
 * The backend is the single source of truth for contract data.
 */
export function getERC20Contracts(): Record<number, Record<string, { address: `0x${string}`; decimals: number }>> {
  if (cachedErc20Contracts) {
    return cachedErc20Contracts;
  }
  if (backendConfigCache?.erc20Contracts) {
    // Convert backend contracts to the expected type
    const contracts: Record<number, Record<string, { address: `0x${string}`; decimals: number }>> = {};
    for (const [chainIdStr, tokens] of Object.entries(backendConfigCache.erc20Contracts)) {
      const chainId = Number(chainIdStr);
      contracts[chainId] = {};
      for (const [token, contract] of Object.entries(tokens)) {
        contracts[chainId][token] = {
          address: contract.address as `0x${string}`,
          decimals: contract.decimals,
        };
      }
    }
    cachedErc20Contracts = contracts;
    return cachedErc20Contracts;
  }
  return {};
}

/**
 * Get the full chain metadata for a transaction using chainId as the single source of truth.
 * Uses backend config cache directly, with UI styling merged in.
 */
export function getChainMetadataForTransaction(
  chainKey: SupportedChainKey,
  chainId?: number,
): ChainMetadata | undefined {
  // If we have the cached supported chains, look up by chainId
  if (supportedChainsCache) {
    for (const meta of Object.values(supportedChainsCache)) {
      if (chainId != null && meta.chainId === chainId) {
        return meta;
      }
    }
    // Fallback to chain key
    return supportedChainsCache[chainKey];
  }
  // If backend config is cached but supportedChainsCache is not built yet, build from backend
  if (backendConfigCache) {
    const backendChain = backendConfigCache.chains[chainKey];
    const uiStyle = UI_CHAIN_STYLING[chainKey];
    if (backendChain && uiStyle) {
      return {
        key: chainKey,
        name: backendChain.name,
        shortName: uiStyle.shortName,
        badge: uiStyle.badge,
        chainId: backendChain.chainId ?? 0,
        isEvm: backendChain.isEvm,
        tokens: backendChain.tokens as SupportedToken[],
        nativeToken: backendChain.nativeToken as SupportedToken,
        explorerUrl: backendChain.explorerUrl,
        color: uiStyle.color,
        bgGlow: uiStyle.bgGlow,
      };
    }
  }
  return undefined;
}

/**
 * Refresh the cached data when backend config is reloaded.
 * Call this after fetchBackendConfig() if the config was reset.
 */
export function refreshCachedData(): void {
  supportedChainsCache = null;
  cachedErc20Contracts = null;
  if (backendConfigCache) {
    supportedChainsCache = buildChainMetadataFromBackend(backendConfigCache);
    cachedErc20Contracts = null; // Force re-read from backendConfigCache
  }
}

export interface RawWalletConfig {
  chainKey?: string;
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
      item.chainKey ?? item.chainId ?? item.chain ?? item.network,
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
 * Asynchronously loads payment wallets from backend
 * The backend handles mainnet/testnet mode switching via TESTNET_SECRET
 * Caches the in-flight Promise and the parsed result so subsequent calls resolve immediately.
 */
export async function loadPaymentWallets(): Promise<ParsedPaymentWallet[]> {
  if (cachedWallets) {
    return cachedWallets;
  }

  if (!cachedWalletsPromise) {
    cachedWalletsPromise = (async () => {
      try {
        const backendConfig = await fetchBackendConfig();
        const parsed = parseWalletList(backendConfig.wallets);
        cachedWallets = parsed;
        return parsed;
      } catch (err) {
        console.warn(
          "Failed to load wallets from backend, falling back to local JSON:",
          err,
        );
        throw err;
      }
    })();
  }

  return cachedWalletsPromise;
}

/**
 * Parses payment wallets from an explicit raw JSON string.
 * Used only for manual overrides; wallets normally come from the backend.
 */
export function parsePaymentWallets(rawEnv?: string): ParsedPaymentWallet[] {
  if (!rawEnv?.trim()) {
    return cachedWallets || [];
  }

  // Check if standard JSON array
  if (rawEnv.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(rawEnv) as RawWalletConfig[];
      return parseWalletList(arr);
    } catch {
      // Fallback to line by line parsing
    }
  }

  // Parse JSON Lines
  const results: ParsedPaymentWallet[] = [];
  const lines = rawEnv.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//"))
      continue;
    try {
      const item = JSON.parse(trimmed) as RawWalletConfig;
      const chainKey = normalizeChainKey(
        item.chainKey ?? item.chainId ?? item.chain ?? item.network,
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
      : cachedWallets || [];

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
  chains?: Record<SupportedChainKey, ChainMetadata> | null,
): ChainMetadata[] {
  const chainList = chains
    ? Object.values(chains)
    : supportedChainsCache
      ? Object.values(supportedChainsCache)
      : [];
  return chainList.filter((chain) => {
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
