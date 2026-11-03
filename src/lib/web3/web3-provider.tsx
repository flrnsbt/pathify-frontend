'use client';

import React, { useEffect, useSyncExternalStore, useRef } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getWagmiConfig, getAppKit } from './config';
import { useAuth } from '../firebase/auth-context';
import { linkWalletToUser } from '../firebase/firestore';

const queryClient = new QueryClient();

function subscribe() {
  return () => {};
}

function WalletSync() {
  const { user } = useAuth();
  const configRef = useRef(getWagmiConfig());

  useEffect(() => {
    // Listen for account changes from wagmiConfig
    const unsubscribe = configRef.current.subscribe(
      (state: any) => state.current,
      (current: any) => {
        const address = configRef.current.state.connections.get(current || '')?.accounts[0];
        if (user && address) {
          linkWalletToUser(user.uid, address).catch((err) =>
            console.warn('Could not sync wallet to user profile:', err)
          );
        }
      }
    );

    return () => unsubscribe();
  }, [user]);

  return null;
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const configRef = useRef(getWagmiConfig());
  const appKitRef = useRef(getAppKit());

  return (
    <WagmiProvider config={configRef.current}>
      <QueryClientProvider client={queryClient}>
        {mounted && <WalletSync />}
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
