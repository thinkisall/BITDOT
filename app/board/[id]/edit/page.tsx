'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import PostForm from '@/app/components/board/PostForm';
import { getPostById } from '@/lib/supabase/posts';
import { Post } from '@/lib/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

export default function EditPostPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const postId = params.id as string;
    if (!postId) return;

    loadPost(postId);
  }, [params.id, user]);

  const loadPost = async (postId: string) => {
    try {
      setLoading(true);
      const data = await getPostById(postId);

      if (!data) {
        alert('게시글을 찾을 수 없습니다.');
        router.push('/board');
        return;
      }

      // 작성자 확인
      if (user && data.author_id !== user.uid) {
        alert('수정 권한이 없습니다.');
        router.push(`/board/${postId}`);
        return;
      }

      setPost(data);
    } catch (error) {
      console.error('Error loading post:', error);
      alert('게시글을 불러오는데 실패했습니다.');
      router.push('/board');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
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
    router.push('/board');
    return null;
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-lg sm:text-2xl font-bold text-white mb-2">
            글 수정
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            게시글을 수정합니다
          </p>
        </div>

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6">
          <PostForm user={user} initialData={post} mode="edit" />
        </div>
      </main>
    </div>
  );
}
