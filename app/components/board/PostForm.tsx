'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from 'firebase/auth';
import { createPost, updatePost } from '@/lib/supabase/posts';
import { Post } from '@/lib/supabase/types';

interface PostFormProps {
  user: User;
  initialData?: Post;
  mode?: 'create' | 'edit';
}

export default function PostForm({ user, initialData, mode = 'create' }: PostFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'create') {
        const postId = await createPost({
          title: title.trim(),
          content: content.trim(),
          author_id: user.uid,
          author_name: user.displayName || user.email || '익명',
          author_email: user.email || '',
          author_photo_url: user.photoURL || undefined,
        });
        router.push(`/board/${postId}`);
      } else if (initialData) {
        await updatePost(initialData.id, {
          title: title.trim(),
          content: content.trim(),
        });
        router.push(`/board/${initialData.id}`);
      }
    } catch (error) {
      console.error('Error saving post:', error);
      alert('게시글 저장에 실패했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 제목 */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-zinc-400 mb-2">
          제목
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력하세요"
          className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500 text-sm sm:text-base"
          maxLength={100}
          disabled={isSubmitting}
        />
        <div className="text-right text-xs text-zinc-500 mt-1">
          {title.length}/100
        </div>
      </div>

      {/* 내용 */}
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-zinc-400 mb-2">
          내용
        </label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="내용을 입력하세요"
          rows={12}
          className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500 text-sm sm:text-base resize-none"
          disabled={isSubmitting}
        />
        <div className="text-right text-xs text-zinc-500 mt-1">
          {content.length}자
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex gap-3 justify-end pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50 text-sm sm:text-base"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-black font-bold transition-colors disabled:opacity-50 text-sm sm:text-base"
        >
          {isSubmitting ? '저장 중...' : mode === 'create' ? '작성하기' : '수정하기'}
        </button>
      </div>
    </form>
  );
}
