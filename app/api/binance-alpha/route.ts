// app/api/binance-alpha/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch(
      'https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/cex/alpha/all/token/list',
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        next: {
          revalidate: 300, // 5분 캐시
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch Binance Alpha data');
    }

    const data = await response.json();

    // 토큰 심볼 리스트 추출
    const tokens = data?.data || [];
    const symbols = tokens.map((token: any) => token.symbol || token.name || '').filter(Boolean);

    return NextResponse.json({ symbols });
  } catch (error: any) {
    console.error('Binance Alpha API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch Binance Alpha data', symbols: [] },
      { status: 500 }
    );
  }
}
