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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [premiumUntil, setPremiumUntil] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // Firestore에 유저 정보 생성/업데이트
          const firestoreUser = await createOrUpdateUser(
            firebaseUser.uid,
            firebaseUser.email || '',
            firebaseUser.displayName,
            firebaseUser.photoURL
          );

          // 프리미엄 만료 확인
          const isValid = await checkPremiumExpiry(firestoreUser);
          setIsPremium(isValid);
          setPremiumUntil(firestoreUser.premiumUntil ?? null);
        } catch (error) {
          console.error('Error loading user data:', error);
          setIsPremium(false);
          setPremiumUntil(null);
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
