'use client';

import { Post } from '@/lib/supabase/types';
import PostCard from './PostCard';
import { AppUser as User } from '@/lib/auth-types';

interface PostListProps {
  posts: Post[];
  user?: User | null;
  onDeleted?: (postId: string) => void;
}

export default function PostList({ posts, user, onDeleted }: PostListProps) {
  return (
    <div className="space-y-2 sm:space-y-3">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} user={user} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
