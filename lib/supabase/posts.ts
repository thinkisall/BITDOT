// lib/supabase/posts.ts
import { supabase } from '../supabase';
import { Post, CreatePostInput, UpdatePostInput } from './types';

export async function getPosts(pageSize = 20, offset = 0) {
  const { data, error, count } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    console.error('Error fetching posts:', error);
    throw error;
  }

  return {
    posts: (data || []) as Post[],
    totalCount: count || 0,
    hasMore: (count || 0) > offset + pageSize,
  };
}

export async function getPostById(postId: string): Promise<Post | null> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Error fetching post:', error);
    throw error;
  }

  return data as Post;
}

export async function createPost(input: CreatePostInput): Promise<string> {
  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        title: input.title,
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
    console.error('Error creating post:', error);
    throw error;
  }

  return data.id;
}

export async function updatePost(
  postId: string,
  input: UpdatePostInput
): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({
      title: input.title,
      content: input.content,
    })
    .eq('id', postId);

  if (error) {
    console.error('Error updating post:', error);
    throw error;
  }
}

export async function deletePost(postId: string): Promise<void> {
  // 소프트 삭제
  const { error } = await supabase
    .from('posts')
    .update({ is_deleted: true })
    .eq('id', postId);

  if (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
}

export async function incrementViewCount(postId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_view_count', {
    post_id: postId,
  });

  // RPC 함수가 없으면 일반 업데이트로 폴백
  if (error) {
    const { data } = await supabase
      .from('posts')
      .select('view_count')
      .eq('id', postId)
      .single();

    if (data) {
      await supabase
        .from('posts')
        .update({ view_count: data.view_count + 1 })
        .eq('id', postId);
    }
  }
}
