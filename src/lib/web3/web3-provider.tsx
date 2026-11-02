'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './config';
import { useAuth } from '../firebase/auth-context';
import { linkWalletToUser } from '../firebase/firestore';

const queryClient = new QueryClient();

function subscribe() {
  return () => {};
}

function WalletSync() {
  const { user } = useAuth();

  useEffect(() => {
    // Listen for account changes from wagmiConfig
    const unsubscribe = wagmiConfig.subscribe(
      (state) => state.current,
      (current) => {
        const address = wagmiConfig.state.connections.get(current || '')?.accounts[0];
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

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {mounted && <WalletSync />}
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
