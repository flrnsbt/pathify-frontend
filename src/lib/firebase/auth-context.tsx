'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
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
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string) => Promise<void>;
  loginAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (!isFirebaseConfigured || !auth) {
      if (typeof window !== 'undefined') {
        const localGuestUid =
          localStorage.getItem('vtracer_guest_uid') ||
          `guest-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('vtracer_guest_uid', localGuestUid);
        return {
          uid: localGuestUid,
          isAnonymous: true,
          displayName: 'Guest User',
          email: null,
        } as unknown as User;
      }
    }
    return null;
  });

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

  useEffect(() => {
    let active = true;
    if (!isFirebaseConfigured || !auth) {
      if (user?.uid) {
        getUserProfile(user.uid)
          .then((p) => {
            if (active) {
              setProfile(p);
            }
          })
          .catch(() => {});
      }
      return () => {
        active = false;
      };
    }

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
  }, [fetchProfile, user?.uid]);

  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      const mockUid = `google-${Date.now()}`;
      const mockUser = {
        uid: mockUid,
        isAnonymous: false,
        displayName: 'Demo Google User',
        email: 'user@example.com',
      } as unknown as User;
      setUser(mockUser);
      await fetchProfile(mockUid);
      return;
    }
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, [fetchProfile]);

  const loginWithEmail = useCallback(async (email: string, pass: string) => {
    if (!isFirebaseConfigured || !auth) {
      const mockUid = `email-${Date.now()}`;
      const mockUser = {
        uid: mockUid,
        isAnonymous: false,
        displayName: email.split('@')[0],
        email,
      } as unknown as User;
      setUser(mockUser);
      await fetchProfile(mockUid);
      return;
    }
    await signInWithEmailAndPassword(auth, email, pass);
  }, [fetchProfile]);

  const signupWithEmail = useCallback(async (email: string, pass: string) => {
    if (!isFirebaseConfigured || !auth) {
      const mockUid = `email-${Date.now()}`;
      const mockUser = {
        uid: mockUid,
        isAnonymous: false,
        displayName: email.split('@')[0],
        email,
      } as unknown as User;
      setUser(mockUser);
      await fetchProfile(mockUid);
      return;
    }
    await createUserWithEmailAndPassword(auth, email, pass);
  }, [fetchProfile]);

  const loginAnonymouslyHandler = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      const guestUid = `guest-${Date.now()}`;
      const mockUser = {
        uid: guestUid,
        isAnonymous: true,
        displayName: 'Guest User',
        email: null,
      } as unknown as User;
      setUser(mockUser);
      await fetchProfile(guestUid);
      return;
    }
    await signInAnonymously(auth);
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
      loginWithEmail,
      signupWithEmail,
      loginAnonymously: loginAnonymouslyHandler,
      logout,
      refreshProfile,
    }),
    [
      user,
      profile,
      loading,
      loginWithGoogle,
      loginWithEmail,
      signupWithEmail,
      loginAnonymouslyHandler,
      logout,
      refreshProfile,
    ]
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
