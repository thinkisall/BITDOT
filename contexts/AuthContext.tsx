'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle as firebaseSignInWithGoogle, signOut as firebaseSignOut } from '@/lib/firebase';
import { getNaverAuthUrl, getNaverSession, clearNaverSession } from '@/lib/naver';
import { AppUser } from '@/lib/auth-types';
import { createOrUpdateUser, checkPremiumExpiry } from '@/lib/supabase/users';

interface AuthContextType {
  user: AppUser | null;
  isPremium: boolean;
  premiumUntil: Date | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithNaver: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isPremium: false,
  premiumUntil: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithNaver: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const PREMIUM_CACHE_KEY = 'bitdot_premium_cache';
const PREMIUM_CACHE_TTL = 5 * 60 * 1000;

function readPremiumCache(uid: string): { isPremium: boolean; premiumUntil: string | null } | null {
  try {
    const raw = localStorage.getItem(PREMIUM_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.uid !== uid || Date.now() - cached.timestamp > PREMIUM_CACHE_TTL) return null;
    return { isPremium: cached.isPremium, premiumUntil: cached.premiumUntil };
  } catch { return null; }
}

function writePremiumCache(uid: string, isPremium: boolean, premiumUntil: Date | null) {
  try {
    localStorage.setItem(PREMIUM_CACHE_KEY, JSON.stringify({
      uid, isPremium,
      premiumUntil: premiumUntil?.toISOString() ?? null,
      timestamp: Date.now(),
    }));
  } catch { }
}

async function loadPremium(
  uid: string,
  email: string,
  displayName: string | null,
  photoURL: string | null,
  setIsPremium: (v: boolean) => void,
  setPremiumUntil: (v: Date | null) => void,
) {
  const cached = readPremiumCache(uid);
  if (cached) {
    setIsPremium(cached.isPremium);
    setPremiumUntil(cached.premiumUntil ? new Date(cached.premiumUntil) : null);
  }
  try {
    const supabaseUser = await createOrUpdateUser(uid, email, displayName, photoURL);
    const isValid = await checkPremiumExpiry(supabaseUser);
    const until = supabaseUser.premiumUntil ?? null;
    setIsPremium(isValid);
    setPremiumUntil(until);
    writePremiumCache(uid, isValid, until);
  } catch (error) {
    console.error('Error loading user data:', error);
    if (!cached) { setIsPremium(false); setPremiumUntil(null); }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const appUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          provider: 'google',
        };
        setUser(appUser);
        await loadPremium(
          firebaseUser.uid,
          firebaseUser.email || '',
          firebaseUser.displayName,
          firebaseUser.photoURL,
          setIsPremium,
          setPremiumUntil,
        );
      } else {
        // Google 로그인 없으면 네이버 세션 확인
        const naver = getNaverSession();
        if (naver) {
          const appUser: AppUser = {
            uid: naver.uid,
            email: naver.email,
            displayName: naver.displayName,
            photoURL: naver.photoURL,
            provider: 'naver',
          };
          setUser(appUser);
          await loadPremium(
            naver.uid,
            naver.email || `${naver.uid}@naver.local`,
            naver.displayName,
            naver.photoURL,
            setIsPremium,
            setPremiumUntil,
          );
        } else {
          setUser(null);
          setIsPremium(false);
          setPremiumUntil(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignInWithGoogle = async () => {
    try {
      await firebaseSignInWithGoogle();
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const handleSignInWithNaver = () => {
    window.location.href = getNaverAuthUrl();
  };

  const handleSignOut = async () => {
    try {
      clearNaverSession();
      await firebaseSignOut();
      setUser(null);
      setIsPremium(false);
      setPremiumUntil(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isPremium,
        premiumUntil,
        loading,
        signInWithGoogle: handleSignInWithGoogle,
        signInWithNaver: handleSignInWithNaver,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
