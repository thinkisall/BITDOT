// lib/supabase/comments.ts
import { supabase } from '../supabase';
import { Comment, CreateCommentInput } from './types';

export async function getComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    throw error;
  }

  return (data || []) as Comment[];
}

export async function createComment(
  postId: string,
  input: CreateCommentInput
): Promise<string> {
  const { data, error } = await supabase
    .from('comments')
    .insert([
      {
        post_id: postId,
        content: input.content,
        author_id: input.author_id,
        author_name: input.author_name,
        author_email: input.author_email,
        author_photo_url: input.author_photo_url,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating comment:', error);
    throw error;
  }

  return data.id;
}

export async function deleteComment(commentId: string): Promise<void> {
  // 소프트 삭제
  const { error } = await supabase
    .from('comments')
    .update({ is_deleted: true })
    .eq('id', commentId);

  if (error) {
    console.error('Error deleting comment:', error);
    throw error;
  }
}

// 실시간 댓글 구독
export function subscribeToComments(
  postId: string,
  callback: (comments: Comment[]) => void
) {
  // 초기 데이터 로드
  getComments(postId).then(callback);

  // 실시간 구독
  const subscription = supabase
    .channel(`comments:${postId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comments',
        filter: `post_id=eq.${postId}`,
      },
      () => {
        // 변경 발생 시 다시 로드
        getComments(postId).then(callback);
      }
    )
    .subscribe();

  // 구독 해제 함수 반환
  return () => {
    subscription.unsubscribe();
  };
}
