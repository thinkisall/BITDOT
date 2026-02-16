'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Comment } from '@/lib/supabase/types';
import { subscribeToComments } from '@/lib/supabase/comments';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';

interface CommentListProps {
  postId: string;
  user: User | null;
}

export default function CommentList({ postId, user }: CommentListProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToComments(postId, (newComments) => {
      setComments(newComments);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [postId]);

  const handleCommentChange = () => {
    // 실시간 구독이 자동으로 업데이트
  };

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6">
      <h2 className="text-base sm:text-lg font-bold text-white mb-4">
        댓글 {comments.length}
      </h2>

      <div className="mb-6">
        <CommentForm postId={postId} user={user} onCommentAdded={handleCommentChange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-sm text-zinc-500">
          첫 번째 댓글을 작성해보세요!
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isAuthor={user?.uid === comment.author_id}
              onCommentDeleted={handleCommentChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
