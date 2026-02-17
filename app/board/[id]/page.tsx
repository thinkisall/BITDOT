'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import PostDetail from '@/app/components/board/PostDetail';
import CommentList from '@/app/components/board/CommentList';
import { getPostById, incrementViewCount } from '@/lib/supabase/posts';
import { Post } from '@/lib/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const postId = params.id as string;
    if (!postId) return;

    loadPost(postId);
  }, [params.id]);

  const loadPost = async (postId: string) => {
    try {
      setLoading(true);
      const data = await getPostById(postId);

      if (!data) {
        alert('게시글을 찾을 수 없습니다.');
        router.push('/board');
        return;
      }

      setPost(data);

      // 조회수 증가 (비동기로 처리)
      incrementViewCount(postId).catch(console.error);
    } catch (error) {
      console.error('Error loading post:', error);
      alert('게시글을 불러오는데 실패했습니다.');
      router.push('/board');
    } finally {
      setLoading(false);
    }
  };

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

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        <div className="mb-4">
          <button
            onClick={() => router.push('/board')}
            className="text-xs sm:text-sm text-zinc-400 hover:text-white transition-colors"
          >
            ← 목록으로
          </button>
        </div>

        <div className="space-y-4 sm:space-y-6">
          <PostDetail post={post} isAuthor={user?.uid === post.author_id} userUid={user?.uid} />
          <CommentList postId={post.id} user={user} />
        </div>
      </main>
    </div>
  );
}
