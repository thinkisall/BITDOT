'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import { createComment } from '@/lib/supabase/comments';

interface CommentFormProps {
  postId: string;
  user: User | null;
  onCommentAdded: () => void;
}

export default function CommentForm({ postId, user, onCommentAdded }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (!content.trim()) {
      alert('댓글 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createComment(postId, {
        content: content.trim(),
        author_id: user.uid,
        author_name: user.displayName || user.email || '익명',
        author_email: user.email || '',
        author_photo_url: user.photoURL || undefined,
      });

      setContent('');
      onCommentAdded();
    } catch (error) {
      console.error('Error creating comment:', error);
      alert('댓글 작성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={user ? '댓글을 입력하세요' : '로그인이 필요합니다'}
        rows={3}
        disabled={!user || isSubmitting}
        className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500 text-xs sm:text-sm resize-none disabled:opacity-50"
      />

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!user || isSubmitting}
          className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
        >
          {isSubmitting ? '작성 중...' : '댓글 작성'}
        </button>
      </div>
    </form>
  );
}
