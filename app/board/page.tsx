'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import PostList from '../components/board/PostList';
import EmptyState from '../components/board/EmptyState';
import { getPosts } from '@/lib/supabase/posts';
import { Post } from '@/lib/supabase/types';
import { useAuth } from '@/contexts/AuthContext';

export default function BoardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async (loadMore = false) => {
    try {
      setLoading(true);
      const currentOffset = loadMore ? offset : 0;
      const result = await getPosts(PAGE_SIZE, currentOffset);

      if (loadMore) {
        setPosts(prev => [...prev, ...result.posts]);
      } else {
        setPosts(result.posts);
      }

      setOffset(currentOffset + PAGE_SIZE);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load posts:', error);
      alert('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">
              자유게시판
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              암호화폐 관련 자유로운 토론
            </p>
          </div>

          {user && (
            <button
              onClick={() => router.push('/board/write')}
              className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold transition-colors text-xs sm:text-sm"
            >
              글쓰기
            </button>
          )}
        </div>

        {/* Posts List */}
        {loading && posts.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <PostList
              posts={posts}
              user={user}
              onDeleted={(postId) => setPosts(prev => prev.filter(p => p.id !== postId))}
            />

            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => loadPosts(true)}
                  disabled={loading}
                  className="px-6 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50 text-sm"
                >
                  {loading ? '로딩 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
