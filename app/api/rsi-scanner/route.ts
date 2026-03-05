// app/api/rsi-scanner/route.ts
// 업비트+빗썸 전종목 대상 RSI+역배열 스캐너
// 조건: 1시간봉 RSI14 ≈ 30 (20~40) AND 5분봉 MA50 < MA110 < MA180 (역배열)

import { fetchUpbitCandles, fetchUpbitCandles5M } from "@/lib/upbitCandles";
import { fetchBithumbCandles, fetchBithumbCandles5M } from "@/lib/bithumbCandles";
import { createConcurrencyLimiter } from "@/lib/rateLimiter";
import { fetchAllMarkets } from "@/lib/markets";

const limit = createConcurrencyLimiter(5);

// ── Wilder's RSI 계산 ──────────────────────────────────────────────────────
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return NaN;

  const changes = closes.slice(1).map((c, i) => c - closes[i]);

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing (EMA 방식)
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

// ── 단순이동평균 계산 ──────────────────────────────────────────────────────
function calculateMA(closes: number[], period: number): number {
  if (closes.length < period) return NaN;
  const slice = closes.slice(closes.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ── API 응답 타입 ─────────────────────────────────────────────────────────
export interface RsiScanItem {
  symbol: string;
  market: string;
  exchange: 'upbit' | 'bithumb';
  currentPrice: number;
  volume: number;
  rsi14_1h: number;   // 1시간봉 RSI14 (20~40 범위)
  ma50_5m: number;    // 5분봉 MA50
  ma110_5m: number;   // 5분봉 MA110
  ma180_5m: number;   // 5분봉 MA180
}

// ── 진단 카운터 타입 ──────────────────────────────────────────────────────
interface ExchangeStat {
  total: number;
  errors: number;
  shortCandles: number; // 캔들 수 부족
  rsiFiltered: number;  // RSI 조건 탈락
  maFiltered: number;   // 역배열 조건 탈락
  matched: number;
}

export interface RsiScanResponse {
  items: RsiScanItem[];
  scannedCount: number;
  matchedCount: number;
  scannedAt: string;
  debug: {
    upbit: ExchangeStat;
    bithumb: ExchangeStat;
  };
}

// ── Route Handler ─────────────────────────────────────────────────────────
export async function POST() {
  try {
    const allMarkets = await fetchAllMarkets();

    const stat: Record<'upbit' | 'bithumb', ExchangeStat> = {
      upbit:   { total: 0, errors: 0, shortCandles: 0, rsiFiltered: 0, maFiltered: 0, matched: 0 },
      bithumb: { total: 0, errors: 0, shortCandles: 0, rsiFiltered: 0, maFiltered: 0, matched: 0 },
    };

    console.log(`[rsi-scan] 스캔 대상: ${allMarkets.length}종목 (업비트+빗썸)`);

    const results = await Promise.all(
      allMarkets.map((item) =>
        limit(async () => {
          const ex = item.exchange;
          stat[ex].total++;
          try {
            const isUpbit = ex === "upbit";
            const [candles1h, candles5m] = await Promise.all([
              isUpbit
                ? fetchUpbitCandles(item.market, 100)
                : fetchBithumbCandles(item.market, 100),
              isUpbit
                ? fetchUpbitCandles5M(item.market, 200)
                : fetchBithumbCandles5M(item.market, 200),
            ]);

            // RSI14 최소 30봉, MA180 최소 180봉 필요
            if (candles1h.length < 30 || candles5m.length < 180) {
              stat[ex].shortCandles++;
              return null;
            }

            const closes1h = candles1h.map((c) => c.close);
            const closes5m = candles5m.map((c) => c.close);

            const rsi14_1h = calculateRSI(closes1h, 14);
            const ma50_5m  = calculateMA(closes5m, 50);
            const ma110_5m = calculateMA(closes5m, 110);
            const ma180_5m = calculateMA(closes5m, 180);

            if (isNaN(rsi14_1h) || isNaN(ma50_5m) || isNaN(ma110_5m) || isNaN(ma180_5m)) {
              stat[ex].errors++;
              return null;
            }

            // 1) 1시간봉 RSI14가 20~40 사이 (30 근처 과매도권)
            if (rsi14_1h < 20 || rsi14_1h > 40) {
              stat[ex].rsiFiltered++;
              return null;
            }

            // 2) 5분봉 역배열: MA50 < MA110 < MA180
            if (!(ma50_5m < ma110_5m && ma110_5m < ma180_5m)) {
              stat[ex].maFiltered++;
              return null;
            }

            stat[ex].matched++;
            const currentPrice = closes1h[closes1h.length - 1];

            return {
              symbol: item.symbol,
              market: item.market,
              exchange: item.exchange,
              currentPrice,
              volume: item.volume,
              rsi14_1h,
              ma50_5m,
              ma110_5m,
              ma180_5m,
            } satisfies RsiScanItem;
          } catch (e: any) {
            stat[ex].errors++;
            console.error(`[rsi-scan] ${item.symbol} 오류: ${e?.message}`);
            return null;
          }
        })
      )
    );

    const items = results.filter((r): r is RsiScanItem => r !== null);
    items.sort((a, b) => b.volume - a.volume);

    console.log(`[rsi-scan] 업비트:`, stat.upbit);
    console.log(`[rsi-scan] 빗썸:`, stat.bithumb);

    const response: RsiScanResponse = {
      items,
      scannedCount: allMarkets.length,
      matchedCount: items.length,
      scannedAt: new Date().toISOString(),
      debug: { upbit: stat.upbit, bithumb: stat.bithumb },
    };

    return Response.json(response);
  } catch (err: any) {
    console.error("[rsi-scan] 오류:", err);
    return Response.json({ error: err?.message || "서버 오류" }, { status: 500 });
  }
}
