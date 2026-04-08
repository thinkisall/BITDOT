'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';

function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /NAVER|NaverApp|KAKAOTALK|KakaoTalk|Instagram|FBAN|FBAV|Line\/|Twitter|Snapchat|TikTok|MicroMessenger|DaumApp/i.test(ua);
}

function InAppBrowserWarning() {
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const copyUrl = () => {
    navigator.clipboard?.writeText(currentUrl).then(() => {
      alert('주소가 복사되었습니다.\nSafari 또는 Chrome에 붙여넣기 해주세요.');
    }).catch(() => {
      alert(`아래 주소를 복사해서\nSafari 또는 Chrome에서 열어주세요:\n\n${currentUrl}`);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-zinc-900 border border-yellow-500/30 rounded-2xl p-6 text-center mb-4">
        <div className="w-12 h-12 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-white mb-2">인앱 브라우저에서는<br />Google 로그인이 불가합니다</h3>
        <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
          네이버·카카오 등 앱 내 브라우저는<br />
          Google 정책에 의해 로그인이 차단됩니다.<br />
          <span className="text-yellow-400 font-medium">Safari 또는 Chrome</span>에서 열어주세요.
        </p>
        <button
          onClick={copyUrl}
          className="w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold text-sm transition-colors"
        >
          주소 복사하기
        </button>
        <p className="text-[11px] text-zinc-600 mt-3">
          복사 후 Safari/Chrome 주소창에 붙여넣기
        </p>
      </div>
    </div>
  );
}

export default function AuthButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);

  const handleLogin = async () => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
      return;
    }
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
      alert('로그인에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut();
    }
  };

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-8 h-8 rounded-full border-2 border-zinc-700"
            />
          )}
          <div className="hidden md:block">
            <div className="text-sm text-white font-medium">{user.displayName || user.email}</div>
            <div className="text-xs text-zinc-400">{user.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <>
      {showInAppWarning && <InAppBrowserWarning />}
      <button
        onClick={handleLogin}
        disabled={isLoggingIn}
        className="group relative flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-linear-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-zinc-950 font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:shadow-yellow-500/20 active:scale-95"
      >
        {isLoggingIn ? (
          <>
            <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-zinc-800/30 border-t-zinc-950 rounded-full animate-spin" />
            <span className="text-xs sm:text-sm">로그인 중...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 sm:w-5 sm:h-5 group-hover:rotate-12 transition-transform duration-300" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-xs sm:text-sm hidden xs:inline">Google 로그인</span>
            <span className="text-xs sm:text-sm inline xs:hidden">로그인</span>
          </>
        )}
      </button>
    </>
  );
}
