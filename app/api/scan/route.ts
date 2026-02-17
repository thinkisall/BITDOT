// app/api/scan/route.ts
import { fetchUpbitCandles, fetchUpbitCandles4H, fetchUpbitCandles1D } from "@/lib/upbitCandles";
import { fetchBithumbCandles, fetchBithumbCandles4H, fetchBithumbCandles1D } from "@/lib/bithumbCandles";
import { findSupportResistanceLevels, detectBoxRanges } from "@/lib/supportResistance";
import { createConcurrencyLimiter } from "@/lib/rateLimiter";
import { fetchAllMarkets } from "@/lib/markets";

// 동시 요청 5개로 제한 (Upbit 10req/s, 3개 캔들 fetch × 5 = 15 → 여유 있게 설정)
const limit = createConcurrencyLimiter(5);

export async function POST() {
  try {
    // 공통 마켓 목록 (5분 캐시, scan/multi-timeframe 공유)
    const allMarkets = await fetchAllMarkets();
    const top300 = allMarkets.slice(0, 300);

    console.log(`Total markets: ${allMarkets.length}, Scanning top 300`);

    // 5. 각 종목 스캔 (컨커런시 5개 제한으로 Rate Limit 방지)
    const results = await Promise.all(
      top300.map((item) => limit(async () => {
        try {
          let candles1h, candles4h, candles1d;

          if (item.exchange === 'upbit') {
            [candles1h, candles4h, candles1d] = await Promise.all([
              fetchUpbitCandles(item.market, 250),
              fetchUpbitCandles4H(item.market, 100),
              fetchUpbitCandles1D(item.market, 100),
            ]);
          } else {
            [candles1h, candles4h, candles1d] = await Promise.all([
              fetchBithumbCandles(item.symbol, 250),
              fetchBithumbCandles4H(item.symbol, 100),
              fetchBithumbCandles1D(item.symbol, 100),
            ]);
          }

          const currentPrice = candles1h[candles1h.length - 1].close;

          // 지지/저항 레벨 탐지
          const levels = findSupportResistanceLevels(candles4h, candles1d, candles1h, currentPrice, 3);

          // 박스권 탐지
          const boxes = detectBoxRanges(levels, candles1h, 10);

          if (boxes.length > 0) {
            // 가장 점수가 높은 박스권 사용
            const bestBox = boxes[0];

            // 현재 가격이 박스권 상단 근처(3% 이내)에 있는지 확인
            const distanceFromTop = ((bestBox.top - currentPrice) / bestBox.top) * 100;
            const nearTop = distanceFromTop >= 0 && distanceFromTop <= 3;

            return {
              symbol: item.symbol,
              exchange: item.exchange,
              volume: item.volume,
              ok: true,
              top: bestBox.top,
              bottom: bestBox.bottom,
              currentPrice,
              nearTop,
              boxType: bestBox.type,
              candlesInRange: bestBox.candlesInRange,
              score: bestBox.score,
              supportResistanceLevels: levels.length,
            };
          }

          return {
            symbol: item.symbol,
            exchange: item.exchange,
            volume: item.volume,
            ok: false,
            reason: "no_box_found",
            supportResistanceLevels: levels.length,
          };
        } catch (e: any) {
          return {
            symbol: item.symbol,
            exchange: item.exchange,
            volume: item.volume,
            ok: false,
            reason: "fetch_error",
            error: String(e?.message ?? e)
          };
        }
      }))
    );

    const picked = results.filter(r => r.ok);

    console.log(`Scanned ${results.length} coins, found ${picked.length} in box range`);

    return Response.json({
      picked,
      resultsCount: results.length,
      pickedCount: picked.length
    });
  } catch (error: any) {
    console.error('Scan API error:', error);
    return Response.json(
      { error: error?.message || 'Scan failed' },
      { status: 500 }
    );
  }
}
