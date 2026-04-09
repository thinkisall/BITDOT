'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setNaverSession } from '@/lib/naver';

function NaverCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error || !code) {
      router.replace('/');
      return;
    }

    fetch('/api/auth/naver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    })
      .then((r) => r.json())
      .then((session) => {
        if (session.uid) {
          setNaverSession(session);
        }
        router.replace('/');
      })
      .catch(() => {
        router.replace('/');
      });
  }, [searchParams, router]);

  return null;
}

export default function NaverCallback() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-zinc-400 text-sm">네이버 로그인 중...</p>
      </div>
      <Suspense>
        <NaverCallbackInner />
      </Suspense>
    </div>
  );
}
