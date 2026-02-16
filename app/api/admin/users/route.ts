// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 관리자 이메일 목록 (환경 변수로 관리)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());

// 서비스 역할 키로 Supabase 클라이언트 생성 (RLS 우회)
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

// GET - 모든 유저 조회
export async function GET(request: NextRequest) {
  try {
    // 관리자 인증 체크 (헤더에서 이메일 확인)
    const userEmail = request.headers.get('x-user-email');

    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // 모든 유저 조회 (서비스 키로 RLS 우회)
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ users: data });
  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - 프리미엄 상태 업데이트
export async function POST(request: NextRequest) {
  try {
    // 관리자 인증 체크
    const userEmail = request.headers.get('x-user-email');

    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { uid, isPremium, premiumUntil } = body;

    if (!uid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 프리미엄 상태 업데이트
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        is_premium: isPremium,
        premium_until: premiumUntil || null,
        updated_at: new Date().toISOString(),
      })
      .eq('uid', uid);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Admin API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
