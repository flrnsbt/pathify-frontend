'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';
import { claimWelcomeCredits, getUserProfile, UserProfile } from './firestore';
import { ensureAppConfig } from '../app-config';
import { ensureUserWalletAddress, resetUserWalletAddress } from '../user-wallet';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  handleAuthExpired: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Global handler invoked when the backend or client detects an expired or invalid Firebase auth token.
 * Immediately unauthenticates the user in Firebase Auth and notifies listeners.
 */
export async function handleAuthExpired(): Promise<void> {
  console.warn('[Auth] Session token expired or invalid. Transitioning user to unauthenticated state.');
  try {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    }
  } catch (err) {
    console.warn('[Auth] Error signing out expired session:', err);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app-wallet-disconnect'));
    window.dispatchEvent(new CustomEvent('auth-token-expired'));
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(() => {
    return isFirebaseConfigured && Boolean(auth);
  });

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const p = await getUserProfile(uid);
      setProfile(p);
    } catch (err) {
      console.warn('Error fetching profile:', err);
    }
  }, []);

  // Fetch app-wide params (generation limits, etc.) once on mount
  useEffect(() => {
    ensureAppConfig();
  }, []);

  // Listen for global auth-token-expired events
  useEffect(() => {
    const onAuthExpired = () => {
      setUser(null);
      setProfile(null);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-token-expired', onAuthExpired);
      return () => {
        window.removeEventListener('auth-token-expired', onAuthExpired);
      };
    }
  }, []);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Claim the one-time welcome credit grant before reading the profile
        // so a fresh account's balance already includes it. Idempotent —
        // existing accounts get a cheap no-op from the backend.
        await claimWelcomeCredits();
        await fetchProfile(currentUser.uid);
        // Ensure the user's EVM deposit wallet exists (generated on first login)
        ensureUserWalletAddress();
      } else {
        setProfile(null);
        resetUserWalletAddress();
      }
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fetchProfile]);

  const loginWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, [fetchProfile]);

  const loginWithGithub = useCallback(async () => {
    const provider = new GithubAuthProvider();
    await signInWithPopup(auth, provider);
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
    }
    // Notify the web3 layer to disconnect any active wallet session
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-wallet-disconnect'));
    }
    setUser(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.uid);
    }
  }, [user, fetchProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isConfigured: isFirebaseConfigured,
      loginWithGoogle,
      loginWithGithub,
      logout,
      refreshProfile,
      handleAuthExpired,
    }),
    [user, profile, loading, loginWithGoogle, loginWithGithub, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
