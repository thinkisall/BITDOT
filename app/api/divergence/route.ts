// app/api/divergence/route.ts
// 업비트 전종목 대상 MA50 위 종목 탐지
// 조건: 5분봉 MA50 위 AND 1시간봉 MA50 위 동시 충족 종목

import { fetchUpbitCandles, fetchUpbitCandles5M } from "@/lib/upbitCandles";
import { createConcurrencyLimiter } from "@/lib/rateLimiter";
import { fetchAllMarkets } from "@/lib/markets";

const limit = createConcurrencyLimiter(5);

// ── MA50 계산 ──────────────────────────────────────────────────────────────
function calculateMA(closes: number[], period: number): number {
  if (closes.length < period) return NaN;
  const slice = closes.slice(closes.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ── API 응답 타입 ─────────────────────────────────────────────────────────
export interface DivergenceItem {
  symbol: string;
  market: string;
  currentPrice: number;
  volume: number;
  ma50_1h: number;
  ma50_5m: number;
  pctAbove1h: number;  // 현재가가 1H MA50보다 몇 % 위인지
  pctAbove5m: number;  // 현재가가 5M MA50보다 몇 % 위인지
}

export interface DivergenceResponse {
  items: DivergenceItem[];
  scannedCount: number;
  matchedCount: number;
  scannedAt: string;
}

// ── Route Handler ─────────────────────────────────────────────────────────
export async function POST() {
  try {
    const allMarkets = await fetchAllMarkets();
    const upbitMarkets = allMarkets.filter((m) => m.exchange === "upbit");

    console.log(`[ma50-scan] 스캔 대상: ${upbitMarkets.length}종목`);

    const results = await Promise.all(
      upbitMarkets.map((item) =>
        limit(async () => {
          try {
            const [candles1h, candles5m] = await Promise.all([
              fetchUpbitCandles(item.market, 60),
              fetchUpbitCandles5M(item.market, 60),
            ]);

            if (candles1h.length < 50 || candles5m.length < 50) return null;

            const closes1h = candles1h.map((c) => c.close);
            const closes5m = candles5m.map((c) => c.close);

            const currentPrice = closes1h[closes1h.length - 1];
            const ma50_1h = calculateMA(closes1h, 50);
            const ma50_5m = calculateMA(closes5m, 50);

            if (isNaN(ma50_1h) || isNaN(ma50_5m)) return null;

            // 5분봉 MA50 위 AND 1시간봉 MA50 위
            if (currentPrice <= ma50_1h) return null;
            if (currentPrice <= ma50_5m) return null;

            const pctAbove1h = ((currentPrice - ma50_1h) / ma50_1h) * 100;
            const pctAbove5m = ((currentPrice - ma50_5m) / ma50_5m) * 100;

            return {
              symbol: item.symbol,
              market: item.market,
              currentPrice,
              volume: item.volume,
              ma50_1h,
              ma50_5m,
              pctAbove1h,
              pctAbove5m,
            } satisfies DivergenceItem;
          } catch {
            return null;
          }
        })
      )
    );

    const items = results.filter((r): r is DivergenceItem => r !== null);
    // 거래대금 높은 순 정렬
    items.sort((a, b) => b.volume - a.volume);

    const response: DivergenceResponse = {
      items,
      scannedCount: upbitMarkets.length,
      matchedCount: items.length,
      scannedAt: new Date().toISOString(),
    };

    console.log(`[ma50-scan] 완료: ${items.length}/${upbitMarkets.length} 종목 발견`);

    return Response.json(response);
  } catch (err: any) {
    console.error("[ma50-scan] 오류:", err);
    return Response.json({ error: err?.message || "서버 오류" }, { status: 500 });
  }
}
