// app/api/scan/route.ts
import { fetchUpbitCandles, fetchUpbitCandles4H, fetchUpbitCandles1D } from "@/lib/upbitCandles";
import { fetchBithumbCandles, fetchBithumbCandles4H, fetchBithumbCandles1D } from "@/lib/bithumbCandles";
import { findSupportResistanceLevels, detectBoxRanges } from "@/lib/supportResistance";

// 메이저 코인 리스트 (제외할 코인들)
const MAJOR_COINS = new Set([
  'BTC', 'ETH', 'XRP', 'USDT', 'USDC', 'BNB', 'SOL', 'ADA', 'DOGE', 'TRX',
  'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM'
]);

interface MarketWithVolume {
  symbol: string;
  market: string; // 'KRW-BTC' for Upbit, 'BTC' for Bithumb
  volume: number;
  exchange: 'upbit' | 'bithumb';
}

export async function POST() {
  try {
    // 1. 업비트 마켓 데이터 가져오기
    const upbitMarketsRes = await fetch('https://api.upbit.com/v1/market/all');
    const upbitMarkets = await upbitMarketsRes.json();
    const krwMarkets = upbitMarkets.filter((m: any) => m.market.startsWith('KRW-'));

    // 2. 업비트 티커 데이터로 거래량 가져오기
    const marketCodes = krwMarkets.map((m: any) => m.market).join(',');
    const upbitTickerRes = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);
    const upbitTickers = await upbitTickerRes.json();

    // 3. 빗썸 티커 데이터 가져오기
    const bithumbRes = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW');
    const bithumbData = await bithumbRes.json();

    const marketsWithVolume: MarketWithVolume[] = [];
    const upbitSymbols = new Set<string>(); // 업비트 종목 추적

    // 업비트 데이터 처리
    upbitTickers.forEach((ticker: any) => {
      const symbol = ticker.market.replace('KRW-', '');
      if (!MAJOR_COINS.has(symbol)) {
        upbitSymbols.add(symbol); // 업비트 종목 기록
        marketsWithVolume.push({
          symbol,
          market: ticker.market,
          volume: ticker.acc_trade_price_24h, // 24시간 누적 거래대금
          exchange: 'upbit',
        });
      }
    });

    // 빗썸 데이터 처리 (업비트에 없는 종목만 추가)
    if (bithumbData.status === '0000' && bithumbData.data) {
      Object.entries(bithumbData.data).forEach(([symbol, ticker]: [string, any]) => {
        if (symbol !== 'date' && !MAJOR_COINS.has(symbol) && !upbitSymbols.has(symbol)) {
          // 업비트에 없는 종목만 추가
          marketsWithVolume.push({
            symbol,
            market: symbol,
            volume: Number(ticker.acc_trade_value_24H || 0), // 24시간 누적 거래대금
            exchange: 'bithumb',
          });
        }
      });
    }

    // 4. 거래량 순으로 정렬하고 상위 300개 선택
    const top300 = marketsWithVolume
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 300);

    console.log(`Total markets: ${marketsWithVolume.length}, Scanning top 300`);

    // 5. 각 종목 스캔 (새로운 지지/저항 기반 박스권 탐지)
    const results = await Promise.all(
      top300.map(async (item) => {
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
      })
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
