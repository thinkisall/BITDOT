import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!supabaseAdmin) {
      console.error('[community delete] supabaseAdmin is null - check SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { id: postId } = await params;
    const userUid = request.headers.get('x-user-uid');

    if (!userUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .eq('is_deleted', false)
      .single();

    if (fetchError) {
      console.error('[community delete] fetch error:', fetchError);
      return NextResponse.json({ error: 'Post not found', detail: fetchError.message }, { status: 404 });
    }

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.author_id !== userUid) {
      console.error('[community delete] author mismatch:', { stored: post.author_id, requested: userUid });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('posts')
      .update({ is_deleted: true })
      .eq('id', postId);

    if (updateError) {
      console.error('[community delete] update error:', updateError);
      return NextResponse.json({ error: 'Failed to delete post', detail: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[community delete] unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
