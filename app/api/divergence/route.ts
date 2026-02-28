// app/api/divergence/route.ts
// 업비트 전종목 대상 RSI 하락 다이버전스 탐지
// 조건: 1시간봉 AND 5분봉 동시에 하락 다이버전스 발생 종목

import { fetchUpbitCandles, fetchUpbitCandles5M } from "@/lib/upbitCandles";
import { createConcurrencyLimiter } from "@/lib/rateLimiter";
import { fetchAllMarkets } from "@/lib/markets";
import type { Candle } from "@/lib/scanBox";

// 동시 요청 5개 제한 (각 코인당 2개 fetch × 5 = 10req/s, Upbit 한도 이내)
const limit = createConcurrencyLimiter(5);

// ── RSI 계산 (Wilder's Smoothing) ──────────────────────────────────────────
function calculateRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(period).fill(NaN);

  // 초기 평균 이득/손실
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) avgGain += delta;
    else avgLoss += Math.abs(delta);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result.push(100 - 100 / (1 + rs0));

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result.push(100 - 100 / (1 + rs));
  }

  return result;
}

// ── 스윙 하이 탐지 ────────────────────────────────────────────────────────
// 좌우 lookback개 봉보다 모두 높은 봉을 스윙 하이로 판단
function findSwingHighs(
  data: number[],
  lookback: number
): Array<{ index: number; value: number }> {
  const highs: Array<{ index: number; value: number }> = [];
  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;
    for (let j = 1; j <= lookback; j++) {
      if (data[i - j] >= data[i] || data[i + j] >= data[i]) {
        isHigh = false;
        break;
      }
    }
    if (isHigh) highs.push({ index: i, value: data[i] });
  }
  return highs;
}

// ── 하락 다이버전스 탐지 ──────────────────────────────────────────────────
// 하락 다이버전스: 가격 고점은 높아지는데 RSI 고점은 낮아지는 현상
interface DivergenceResult {
  detected: boolean;
  prevHighPrice?: number;
  recentHighPrice?: number;
  prevRsi?: number;
  recentRsi?: number;
}

function detectBearishDivergence(
  candles: Candle[],
  swingLookback: number,
  recentWindow: number  // 최근 N봉 이내에 스윙 하이가 있어야 유효
): DivergenceResult {
  if (candles.length < 50) return { detected: false };

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const rsi = calculateRSI(closes);

  // 가격 스윙 하이 탐지
  const priceSwings = findSwingHighs(highs, swingLookback);
  if (priceSwings.length < 2) return { detected: false };

  // 마지막 2개 스윙 하이
  const recent = priceSwings[priceSwings.length - 1];
  const prev = priceSwings[priceSwings.length - 2];

  // 최근 스윙 하이가 충분히 최근(recentWindow 봉 이내)이어야 함
  if (recent.index < candles.length - recentWindow) return { detected: false };

  // 두 스윙 하이 사이 최소 간격 (너무 붙어 있으면 무효)
  if (recent.index - prev.index < swingLookback * 2) return { detected: false };

  // 가격: 더 높은 고점 (Higher High)
  if (recent.value <= prev.value) return { detected: false };

  // RSI: 더 낮은 고점 (Lower High)
  const rsiRecent = rsi[recent.index];
  const rsiPrev = rsi[prev.index];
  if (isNaN(rsiRecent) || isNaN(rsiPrev)) return { detected: false };
  if (rsiRecent >= rsiPrev) return { detected: false };

  // RSI 차이가 최소 2pt 이상이어야 유효한 다이버전스
  if (rsiPrev - rsiRecent < 2) return { detected: false };

  return {
    detected: true,
    prevHighPrice: prev.value,
    recentHighPrice: recent.value,
    prevRsi: rsiPrev,
    recentRsi: rsiRecent,
  };
}

// ── API 응답 타입 ─────────────────────────────────────────────────────────
export interface DivergenceItem {
  symbol: string;
  market: string;
  currentPrice: number;
  volume: number;
  // 1시간봉 다이버전스 데이터
  h1PrevHigh: number;
  h1RecentHigh: number;
  h1PrevRsi: number;
  h1RecentRsi: number;
  // 5분봉 다이버전스 데이터
  m5PrevHigh: number;
  m5RecentHigh: number;
  m5PrevRsi: number;
  m5RecentRsi: number;
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
    // 업비트 전종목 거래대금 순 목록 (캐시 활용)
    const allMarkets = await fetchAllMarkets();
    const upbitMarkets = allMarkets.filter((m) => m.exchange === "upbit");

    console.log(`[divergence] 스캔 대상: ${upbitMarkets.length}종목 (전종목)`);

    const results = await Promise.all(
      upbitMarkets.map((item) =>
        limit(async () => {
          try {
            // 1시간봉 100개, 5분봉 120개 병렬 fetch
            const [candles1h, candles5m] = await Promise.all([
              fetchUpbitCandles(item.market, 100),
              fetchUpbitCandles5M(item.market, 120),
            ]);

            if (candles1h.length < 30 || candles5m.length < 50) return null;

            // 1시간봉: 스윙 lookback=5, 최근 20봉 이내
            const div1h = detectBearishDivergence(candles1h, 5, 20);
            if (!div1h.detected) return null;

            // 5분봉: 스윙 lookback=3, 최근 30봉 이내
            const div5m = detectBearishDivergence(candles5m, 3, 30);
            if (!div5m.detected) return null;

            const currentPrice = candles1h[candles1h.length - 1].close;

            return {
              symbol: item.symbol,
              market: item.market,
              currentPrice,
              volume: item.volume,
              h1PrevHigh: div1h.prevHighPrice!,
              h1RecentHigh: div1h.recentHighPrice!,
              h1PrevRsi: div1h.prevRsi!,
              h1RecentRsi: div1h.recentRsi!,
              m5PrevHigh: div5m.prevHighPrice!,
              m5RecentHigh: div5m.recentHighPrice!,
              m5PrevRsi: div5m.prevRsi!,
              m5RecentRsi: div5m.recentRsi!,
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

    console.log(
      `[divergence] 완료: ${items.length}/${upbitMarkets.length} 종목 발견`
    );

    return Response.json(response);
  } catch (err: any) {
    console.error("[divergence] 오류:", err);
    return Response.json({ error: err?.message || "서버 오류" }, { status: 500 });
  }
}
