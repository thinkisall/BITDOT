'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/app/components/Header';

function detectInAppBrowser(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/NAVER|NaverApp/i.test(ua)) return '네이버 앱';
  if (/YTM|YouTube/i.test(ua)) return '유튜브 앱';
  if (/musical_ly|TikTok/i.test(ua)) return '틱톡 앱';
  if (/Barcelona|Threads/i.test(ua)) return '쓰레드 앱';
  if (/Instagram/i.test(ua)) return '인스타그램 앱';
  if (/KAKAOTALK|KakaoTalk/i.test(ua)) return '카카오톡 앱';
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithGoogle, signInWithNaver } = useAuth();
  const [inAppBrowser, setInAppBrowser] = useState<string | null>(null);

  useEffect(() => {
    setInAppBrowser(detectInAppBrowser());
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const copyUrl = () => {
    const url = window.location.origin;
    navigator.clipboard?.writeText(url).then(() => {
      alert('주소가 복사되었습니다.\nSafari 또는 Chrome에 붙여넣기 해주세요.');
    }).catch(() => {
      alert(`아래 주소를 Safari 또는 Chrome에서 열어주세요:\n\n${url}`);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <main className="flex items-center justify-center min-h-[80vh] px-4 py-8">
        <div className="w-full max-w-sm space-y-4">

          {/* 인앱 브라우저 경고 */}
          {inAppBrowser && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-orange-400 mb-1">
                    {inAppBrowser}에서는 로그인이 어려울 수 있어요
                  </p>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    앱 내 브라우저는 소셜 로그인을 차단하는 경우가 있습니다.
                    <span className="text-orange-300 font-medium"> Safari 또는 Chrome</span>에서 열면 정상적으로 로그인됩니다.
                  </p>
                  <button
                    onClick={copyUrl}
                    className="mt-2 text-xs text-orange-400 underline underline-offset-2"
                  >
                    주소 복사하기
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-white mb-2">로그인</h1>
            <p className="text-sm text-zinc-400 mb-8 leading-relaxed">
              소셜 계정으로 간편하게 로그인하세요
            </p>

            <div className="space-y-3">
              {/* Google 로그인 */}
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-xl transition-colors text-sm"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google로 로그인
              </button>

              {/* 네이버 로그인 */}
              <button
                onClick={signInWithNaver}
                className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#03C75A] hover:bg-[#02b351] text-white font-bold rounded-xl transition-colors text-sm"
              >
                <span className="w-5 h-5 shrink-0 flex items-center justify-center font-extrabold text-base leading-none">N</span>
                네이버로 로그인
              </button>
            </div>

            <button
              onClick={() => router.back()}
              className="mt-4 w-full py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              돌아가기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
