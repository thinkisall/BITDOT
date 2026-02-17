// app/api/board/posts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

// DELETE - 게시글 삭제 (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { id: postId } = await params;
  const userUid = request.headers.get('x-user-uid');

  if (!userUid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 게시글 조회 — 작성자 확인
  const { data: post, error: fetchError } = await supabaseAdmin
    .from('posts')
    .select('author_id')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  if (post.author_id !== userUid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 소프트 삭제
  const { error } = await supabaseAdmin
    .from('posts')
    .update({ is_deleted: true })
    .eq('id', postId);

  if (error) {
    console.error('Error deleting post:', error);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
