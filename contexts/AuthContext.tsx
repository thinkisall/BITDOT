'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOut } from '@/lib/firebase';
import { createOrUpdateUser, checkPremiumExpiry, User as SupabaseUser } from '@/lib/supabase/users';

interface AuthContextType {
  user: User | null;
  isPremium: boolean;
  premiumUntil: Date | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isPremium: false,
  premiumUntil: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// --- localStorage 프리미엄 캐시 (5분 TTL) ---
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
  } catch { /* localStorage 불가 환경 무시 */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // 캐시 우선 적용 → loading 즉시 해제, UI 빠르게 표시
        const cached = readPremiumCache(firebaseUser.uid);
        if (cached) {
          setIsPremium(cached.isPremium);
          setPremiumUntil(cached.premiumUntil ? new Date(cached.premiumUntil) : null);
          setLoading(false);
        }

        try {
          const firestoreUser = await createOrUpdateUser(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName,
            firebaseUser.photoURL
          );
          const isValid = await checkPremiumExpiry(firestoreUser);
          const until = firestoreUser.premiumUntil ?? null;
          setIsPremium(isValid);
          setPremiumUntil(until);
          writePremiumCache(firebaseUser.uid, isValid, until);
        } catch (error) {
          console.error('Error loading user data:', error);
          if (!cached) { setIsPremium(false); setPremiumUntil(null); }
        }
      } else {
        setIsPremium(false);
        setPremiumUntil(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignInWithGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
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
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
