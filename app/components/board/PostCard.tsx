'use client';

import Link from 'next/link';
import { Post } from '@/lib/supabase/types';

interface PostCardProps {
  post: Post;
}

export default function PostCard({ post }: PostCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}분 전`;
    } else if (hours < 24) {
      return `${hours}시간 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }
  };

  return (
    <Link href={`/board/${post.id}`}>
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4 hover:border-zinc-700 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base font-medium text-white mb-1 sm:mb-2 truncate">
              {post.title}
            </h3>

            <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                {post.author_photo_url && (
                  <img
                    src={post.author_photo_url}
                    alt={post.author_name}
                    className="w-4 h-4 sm:w-5 sm:h-5 rounded-full"
                  />
                )}
                <span>{post.author_name}</span>
              </div>

              <span>•</span>
              <span>{formatDate(post.created_at)}</span>

              {post.comment_count > 0 && (
                <>
                  <span>•</span>
                  <span className="text-yellow-500">댓글 {post.comment_count}</span>
                </>
              )}

              <span>•</span>
              <span>조회 {post.view_count}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
