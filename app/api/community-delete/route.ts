import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

export async function DELETE(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const userUid = request.headers.get('x-user-uid');

    if (!postId || !userUid) {
      return NextResponse.json({ error: 'Missing postId or userUid' }, { status: 400 });
    }

    const { data: post, error: fetchError } = await supabaseAdmin
      .from('posts')
      .select('author_id')
      .eq('id', postId)
      .eq('is_deleted', false)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const userEmail = request.headers.get('x-user-email') || '';
    const isAdmin = ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(userEmail);

    if (!isAdmin && post.author_id !== userUid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('posts')
      .update({ is_deleted: true })
      .eq('id', postId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[community-delete]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
