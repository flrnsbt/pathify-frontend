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

const isDebugMode = APP_CONFIG.features.debugMode;

// Mapping from chain keys to viem chain objects for addEthereumChainParameter
import type { Chain } from 'viem';

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

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = isDebugMode
  ? [
      sepolia,
      bscTestnet,
      polygonAmoy,
      baseSepolia,
      arbitrumSepolia,
      optimismSepolia,
      avalancheFuji,
      plasmaTestnet,
    ]
  : [
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

export const metadata = {
  name: APP_CONFIG.name,
  description: APP_CONFIG.description,
  url: APP_CONFIG.appUrl,
  icons: [`${APP_CONFIG.appUrl}${APP_CONFIG.iconUrl}`],
};

// Lazy-initialized on the client side only to avoid SSR issues with MetaMask origin detection
let wagmiAdapterInstance: WagmiAdapter | null = null;
let appKitInstance: ReturnType<typeof createAppKit> | null = null;

export function getWagmiConfig(): Config {
  if (!wagmiAdapterInstance) {
    wagmiAdapterInstance = new WagmiAdapter({
      projectId,
      networks,
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
        networks,
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
