import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://api.maketruthy.com/predict/top100/result', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream HTTP ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'proxy error' },
      { status: 500 }
    );
  }
}
