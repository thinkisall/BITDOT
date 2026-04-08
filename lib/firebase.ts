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

const auth = isNewApp
  ? initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    })
  : getAuth(app);

const googleProvider = new GoogleAuthProvider();

// iOS Safari는 ITP로 인해 redirect 시 IndexedDB가 초기화됨 → popup 사용
// Android Chrome은 redirect 정상 동작
function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isAndroidDevice(): boolean {
  return isAndroid();
}

export const signInWithGoogle = () => {
  if (isAndroid()) {
    // Android: redirect 방식 (popup이 새 창으로 열릴 수 있어 redirect가 더 안정적)
    return signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
  }
  // iOS Safari & 데스크톱: popup (Safari는 새 탭으로 열어줌)
  return signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
};

export { getRedirectResult, auth };
export const signOut = () => firebaseSignOut(auth);
