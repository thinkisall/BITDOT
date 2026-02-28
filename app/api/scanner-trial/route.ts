// app/api/scanner-trial/route.ts
// MA50 스캐너 1일 무료 이용권 관리
//
// ⚠️ Supabase SQL Editor에서 아래 테이블을 먼저 생성하세요:
//
//   CREATE TABLE IF NOT EXISTS scanner_trials (
//     uid        TEXT PRIMARY KEY,
//     started_at TIMESTAMPTZ DEFAULT NOW()
//   );
//
//   ALTER TABLE scanner_trials ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "service_role_only" ON scanner_trials USING (false);

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const TRIAL_HOURS = 24;

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── GET /api/scanner-trial?uid=xxx ────────────────────────────────────────
// 트라이얼 상태 조회
// 반환: { status: 'no_trial' | 'active' | 'expired', remainingMs?, startedAt? }
export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ error: 'uid required' }, { status: 400 });
  }

  try {
    const { data, error } = await adminSupabase
      .from('scanner_trials')
      .select('started_at')
      .eq('uid', uid)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (정상)
      console.error('[scanner-trial] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ status: 'no_trial' });
    }

    const startedAt = new Date(data.started_at);
    const expiresAt = new Date(startedAt.getTime() + TRIAL_HOURS * 60 * 60 * 1000);
    const now = Date.now();

    if (now < expiresAt.getTime()) {
      return NextResponse.json({
        status: 'active',
        remainingMs: expiresAt.getTime() - now,
        startedAt: startedAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
    }

    return NextResponse.json({
      status: 'expired',
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e: any) {
    console.error('[scanner-trial] GET exception:', e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── POST /api/scanner-trial ───────────────────────────────────────────────
// 트라이얼 시작 (중복 사용 불가)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { uid } = body;

  if (!uid) {
    return NextResponse.json({ error: 'uid required' }, { status: 400 });
  }

  try {
    // 이미 사용 여부 확인
    const { data: existing } = await adminSupabase
      .from('scanner_trials')
      .select('started_at')
      .eq('uid', uid)
      .single();

    if (existing) {
      const startedAt = new Date(existing.started_at);
      const expiresAt = new Date(startedAt.getTime() + TRIAL_HOURS * 60 * 60 * 1000);
      const isActive = Date.now() < expiresAt.getTime();

      return NextResponse.json(
        {
          error: isActive ? '이미 활성화된 이용권이 있습니다.' : '이용권이 이미 만료되었습니다.',
          status: isActive ? 'active' : 'expired',
          startedAt: startedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
        { status: 409 }
      );
    }

    // 트라이얼 생성
    const { error: insertError } = await adminSupabase
      .from('scanner_trials')
      .insert({ uid });

    if (insertError) {
      console.error('[scanner-trial] insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + TRIAL_HOURS * 60 * 60 * 1000);

    return NextResponse.json({
      status: 'active',
      remainingMs: TRIAL_HOURS * 60 * 60 * 1000,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (e: any) {
    console.error('[scanner-trial] POST exception:', e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
