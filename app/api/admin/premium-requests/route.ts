// app/api/admin/premium-requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());

const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL or Service Role Key is missing');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// GET - 대기 중인 신청 목록 조회
export async function GET(request: NextRequest) {
  try {
    const userEmail = request.headers.get('x-user-email');

    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('premium_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ requests: data || [] });
  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 신청 승인/거부
export async function POST(request: NextRequest) {
  try {
    const userEmail = request.headers.get('x-user-email');

    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { requestId, action, rejectReason } = body; // action: 'approve' | 'reject'

    if (!requestId || !action) {
      return NextResponse.json(
        { error: 'Request ID and action are required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 신청 정보 조회
    const { data: premiumRequest, error: fetchError } = await supabaseAdmin
      .from('premium_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !premiumRequest) {
      throw new Error('Premium request not found');
    }

    if (premiumRequest.status !== 'pending') {
      return NextResponse.json(
        { error: '이미 처리된 신청입니다.' },
        { status: 409 }
      );
    }

    if (action === 'approve') {
      // 승인: 프리미엄 설정 (30일)
      const premiumUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // users 테이블 업데이트
      const { error: userUpdateError } = await supabaseAdmin
        .from('users')
        .update({
          is_premium: true,
          premium_until: premiumUntil,
          updated_at: new Date().toISOString(),
        })
        .eq('uid', premiumRequest.uid);

      if (userUpdateError) throw userUpdateError;

      // premium_requests 테이블 업데이트
      const { error: requestUpdateError } = await supabaseAdmin
        .from('premium_requests')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          processed_by: userEmail,
        })
        .eq('id', requestId);

      if (requestUpdateError) throw requestUpdateError;

      return NextResponse.json({
        success: true,
        message: '프리미엄 승인이 완료되었습니다.'
      });

    } else if (action === 'reject') {
      // 거부
      const { error: requestUpdateError } = await supabaseAdmin
        .from('premium_requests')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          processed_by: userEmail,
          reject_reason: rejectReason || null,
        })
        .eq('id', requestId);

      if (requestUpdateError) throw requestUpdateError;

      return NextResponse.json({
        success: true,
        message: '신청이 거부되었습니다.'
      });

    } else {
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
