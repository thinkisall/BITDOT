// lib/supabase/types.ts

export interface Post {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_photo_url?: string;
  created_at: string;
  updated_at: string;
  view_count: number;
  comment_count: number;
  is_deleted: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_photo_url?: string;
  created_at: string;
  is_deleted: boolean;
}

export interface CreatePostInput {
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_photo_url?: string;
}

export interface UpdatePostInput {
  title?: string;
  content?: string;
}

export interface CreateCommentInput {
  content: string;
  author_id: string;
  author_name: string;
  author_email: string;
  author_photo_url?: string;
}
