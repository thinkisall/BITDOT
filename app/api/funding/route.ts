// app/api/funding/route.ts
// Express 백엔드로 프록시 — 외부 API 직접 호출 제거
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HOME_SERVER_URL =
  process.env.HOME_SERVER_URL ||
  process.env.NEXT_PUBLIC_HOME_SERVER_URL ||
  'http://localhost:8000';

export async function GET() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000); // 25초 timeout

  try {
    const res = await fetch(`${HOME_SERVER_URL}/api/funding`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Backend error: ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    const isTimeout = error?.name === 'AbortError';
    console.error('[funding proxy]', isTimeout ? 'timeout' : error.message);
    return NextResponse.json(
      { error: isTimeout ? 'Request timeout' : (error.message || 'Failed to fetch funding rates'), data: [], count: 0, timestamp: Date.now() },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
