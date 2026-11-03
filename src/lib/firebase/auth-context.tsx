'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';
import { getUserProfile, UserProfile } from './firestore';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isConfigured: boolean;
  loginWithGoogle: () => Promise<void>;
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
        await fetchProfile(currentUser.uid);
      } else {
        setProfile(null);
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

  const logout = useCallback(async () => {
    if (isFirebaseConfigured && auth) {
      await fbSignOut(auth);
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
      logout,
      refreshProfile,
      handleAuthExpired,
    }),
    [user, profile, loading, loginWithGoogle, logout, refreshProfile]
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
