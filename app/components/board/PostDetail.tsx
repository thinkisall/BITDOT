'use client';

import { useRouter } from 'next/navigation';
import { Post } from '@/lib/supabase/types';
import { deletePost } from '@/lib/supabase/posts';

interface PostDetailProps {
  post: Post;
  isAuthor: boolean;
  userUid?: string;
}

export default function PostDetail({ post, isAuthor, userUid }: PostDetailProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDelete = async () => {
    if (!confirm('정말 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deletePost(post.id, userUid!);
      window.location.href = '/board';
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('게시글 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6">
      {/* 헤더 */}
      <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-zinc-800">
        <h1 className="text-lg sm:text-2xl font-bold text-white mb-3 sm:mb-4">
          {post.title}
        </h1>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            {post.author_photo_url && (
              <img
                src={post.author_photo_url}
                alt={post.author_name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
              />
            )}
            <div>
              <div className="text-sm sm:text-base text-white font-medium">
                {post.author_name}
              </div>
              <div className="text-xs sm:text-sm text-zinc-500">
                {formatDate(post.created_at)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-500">
            <span>조회 {post.view_count}</span>
            <span>•</span>
            <span>댓글 {post.comment_count}</span>
          </div>
        </div>
      </div>

      {/* 내용 */}
      <div className="mb-6 sm:mb-8 text-sm sm:text-base text-zinc-100 whitespace-pre-wrap break-words">
        {post.content}
      </div>

      {/* 작성자 액션 버튼 */}
      {isAuthor && (
        <div className="flex gap-2 pt-4 border-t border-zinc-800">
          <button
            onClick={() => router.push(`/board/${post.id}/edit`)}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors text-xs sm:text-sm"
          >
            수정
          </button>
          <button
            onClick={handleDelete}
            className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-red-900 hover:bg-red-800 text-white transition-colors text-xs sm:text-sm"
          >
            삭제
          </button>
        </div>
      )}
    </div>
  );
}
