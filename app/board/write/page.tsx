'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import PostForm from '@/app/components/board/PostForm';
import { useAuth } from '@/contexts/AuthContext';

export default function WritePostPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      alert('로그인이 필요합니다.');
      router.push('/board');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">
            글쓰기
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            암호화폐 관련 자유로운 의견을 나눠주세요
          </p>
        </div>

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6">
          <PostForm user={user} mode="create" />
        </div>
      </main>
    </div>
  );
}
