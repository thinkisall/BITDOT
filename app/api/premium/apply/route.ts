// app/api/premium/apply/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { uid, email, displayName, depositorName } = body;

    // 유효성 검사
    if (!uid || !email || !depositorName) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    // 입금자명 검증 (2-20자, 한글/영문/숫자만)
    if (depositorName.length < 2 || depositorName.length > 20) {
      return NextResponse.json(
        { error: '입금자명은 2-20자로 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이미 대기 중인 신청이 있는지 확인
    const { data: existingRequest } = await supabase
      .from('premium_requests')
      .select('id, status')
      .eq('uid', uid)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingRequest) {
      return NextResponse.json(
        { error: '이미 처리 대기 중인 신청이 있습니다.' },
        { status: 409 }
      );
    }

    // 신청 생성
    const { data, error } = await supabase
      .from('premium_requests')
      .insert([{
        uid,
        email,
        display_name: displayName,
        depositor_name: depositorName,
        amount: 39900,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      requestId: data.id
    });
  } catch (error: any) {
    console.error('Premium apply error:', error);
    return NextResponse.json(
      { error: error.message || '신청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET - 사용자의 신청 상태 조회
export async function GET(request: NextRequest) {
  try {
    const uid = request.nextUrl.searchParams.get('uid');

    if (!uid) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // 가장 최근 신청 조회
    const { data, error } = await supabase
      .from('premium_requests')
      .select('*')
      .eq('uid', uid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ request: data });
  } catch (error: any) {
    console.error('Get premium request error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
