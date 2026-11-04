'use client';

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  mainnet,
  arbitrum,
  polygon,
  base,
  bsc,
  optimism,
  avalanche,
  plasma,
  sepolia,
  bscTestnet,
  polygonAmoy,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  avalancheFuji,
  plasmaTestnet,
  type AppKitNetwork,
} from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { APP_CONFIG } from "@/config/app.config";
import type { Config } from "wagmi";

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID as string;

// Mapping from chain keys to viem chain objects for addEthereumChainParameter
import type { Chain } from 'viem';

export const CHAIN_ID_TO_VIEM_CHAIN: Record<number, Chain> = {
  1: mainnet,
  56: bsc,
  137: polygon,
  8453: base,
  42161: arbitrum,
  10: optimism,
  43114: avalanche,
  9745: plasma,
  11155111: sepolia,
  97: bscTestnet,
  80002: polygonAmoy,
  84532: baseSepolia,
  421614: arbitrumSepolia,
  11155420: optimismSepolia,
  43113: avalancheFuji,
  9746: plasmaTestnet,
};

export const CHAIN_KEY_TO_VIEM_CHAIN: Record<string, Chain> = {
    bsc: bsc,
    eth: mainnet,
    pol: polygon,
    base: base,
    arbitrum: arbitrum,
    op: optimism,
    avax: avalanche,
    plasma: plasma,
    sepolia: sepolia,
    bscTestnet: bscTestnet,
    polygonAmoy: polygonAmoy,
    baseSepolia: baseSepolia,
    arbitrumSepolia: arbitrumSepolia,
    optimismSepolia: optimismSepolia,
    avalancheFuji: avalancheFuji,
    plasmaTestnet: plasmaTestnet,
  };

export function getViemChain(chainIdOrKey?: number | string): Chain | undefined {
  if (typeof chainIdOrKey === 'number') {
    return CHAIN_ID_TO_VIEM_CHAIN[chainIdOrKey];
  }
  if (typeof chainIdOrKey === 'string') {
    return CHAIN_KEY_TO_VIEM_CHAIN[chainIdOrKey];
  }
  return undefined;
}

export const testnetNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  sepolia,
  bscTestnet,
  polygonAmoy,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  avalancheFuji,
  plasmaTestnet,
];

export const mainnetNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  bsc,
  polygon,
  base,
  arbitrum,
  optimism,
  avalanche,
  plasma,
  sepolia,
];

// All supported networks combined so Wagmi config has full visibility of every supported chain
export const allNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  mainnet,
  bsc,
  polygon,
  base,
  arbitrum,
  optimism,
  avalanche,
  plasma,
  sepolia,
  bscTestnet,
  polygonAmoy,
  baseSepolia,
  arbitrumSepolia,
  optimismSepolia,
  avalancheFuji,
  plasmaTestnet,
];

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = mainnetNetworks;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export const metadata = {
  name: APP_CONFIG.name,
  description: APP_CONFIG.description,
  url: APP_URL,
  icons: [`${APP_URL}${APP_CONFIG.iconUrl}`],
};

// Lazy-initialized on the client side only to avoid SSR issues with MetaMask origin detection
let wagmiAdapterInstance: WagmiAdapter | null = null;
let appKitInstance: ReturnType<typeof createAppKit> | null = null;

export function getWagmiConfig(): Config {
  if (!wagmiAdapterInstance) {
    wagmiAdapterInstance = new WagmiAdapter({
      projectId,
      networks: allNetworks,
      ssr: true,
    });
  }
  return wagmiAdapterInstance.wagmiConfig;
}

export function getAppKit(): ReturnType<typeof createAppKit> {
  if (!appKitInstance) {
    if (!wagmiAdapterInstance) {
      wagmiAdapterInstance = new WagmiAdapter({
        projectId,
        networks: allNetworks,
        ssr: true,
      });
    }
    appKitInstance = createAppKit({
      adapters: [wagmiAdapterInstance],
      networks,
      projectId,
      metadata,
      features: {
        analytics: false,
        email: false,
        socials: false,
        emailShowWallets: true,
        allWallets: true,
      },
      allWallets: "SHOW",
      enableWallets: true,
    });
  }
  return appKitInstance;
}
