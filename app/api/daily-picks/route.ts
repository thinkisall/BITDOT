import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim()).filter(Boolean);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// GET - 오늘의 픽 조회 (공개)
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('daily_picks')
      .select('*')
      .order('rank', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ picks: data || [] });
  } catch (err) {
    console.error('[daily-picks GET]', err);
    return NextResponse.json({ error: 'Failed to fetch picks' }, { status: 500 });
  }
}

// POST - 오늘의 픽 저장 (관리자 전용)
export async function POST(request: NextRequest) {
  try {
    const userEmail = request.headers.get('x-user-email') || '';
    if (!ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const body = await request.json();
    const picks: { rank: number; symbol: string; reason?: string }[] = body.picks || [];

    // 기존 데이터 삭제 후 전체 재저장 (upsert)
    const { error: deleteError } = await supabaseAdmin
      .from('daily_picks')
      .delete()
      .gte('rank', 1);

    if (deleteError) throw deleteError;

    const validPicks = picks.filter((p) => p.symbol?.trim());
    if (validPicks.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('daily_picks')
        .insert(
          validPicks.map((p) => ({
            rank: p.rank,
            symbol: p.symbol.trim().toUpperCase(),
            reason: p.reason?.trim() || null,
            updated_by: userEmail,
          }))
        );
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[daily-picks POST]', err);
    return NextResponse.json({ error: 'Failed to save picks' }, { status: 500 });
  }
}
