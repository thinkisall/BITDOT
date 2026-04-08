// lib/firebase.ts
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApps()[0];

// 이미 초기화된 경우 getAuth 사용 (중복 initializeAuth 방지)
const auth = isNewApp
  ? initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  : getAuth(app);

const googleProvider = new GoogleAuthProvider();

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// 모바일: redirect / 데스크톱: popup
export const signInWithGoogle = () => {
  if (isMobile()) {
    return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
  }
  return signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
};

export { getRedirectResult, auth };
export const signOut = () => firebaseSignOut(auth);
