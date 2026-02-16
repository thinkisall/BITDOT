'use client';

import { Comment } from '@/lib/supabase/types';
import { deleteComment } from '@/lib/supabase/comments';

interface CommentItemProps {
  comment: Comment;
  isAuthor: boolean;
  onCommentDeleted: () => void;
}

export default function CommentItem({ comment, isAuthor, onCommentDeleted }: CommentItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 1) {
      return '방금 전';
    } else if (minutes < 60) {
      return `${minutes}분 전`;
    } else if (hours < 24) {
      return `${hours}시간 전`;
    } else {
      return date.toLocaleDateString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm('댓글을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await deleteComment(comment.id);
      onCommentDeleted();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('댓글 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-zinc-900/50 rounded-lg">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {comment.author_photo_url && (
            <img
              src={comment.author_photo_url}
              alt={comment.author_name}
              className="w-6 h-6 sm:w-8 sm:h-8 rounded-full"
            />
          )}
          <div>
            <div className="text-xs sm:text-sm text-white font-medium">
              {comment.author_name}
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-500">
              {formatDate(comment.created_at)}
            </div>
          </div>
        </div>

        {isAuthor && (
          <button
            onClick={handleDelete}
            className="text-xs text-zinc-500 hover:text-red-500 transition-colors"
          >
            삭제
          </button>
        )}
      </div>

      <div className="text-xs sm:text-sm text-zinc-200 whitespace-pre-wrap break-words">
        {comment.content}
      </div>
    </div>
  );
}
