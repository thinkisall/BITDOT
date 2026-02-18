// app/api/chart/route.ts
import {
  fetchUpbitCandles5M,
  fetchUpbitCandles30M,
  fetchUpbitCandles,
  fetchUpbitCandles4H,
  fetchUpbitCandles1D
} from "@/lib/upbitCandles";
import {
  fetchBithumbCandles5M,
  fetchBithumbCandles30M,
  fetchBithumbCandles,
  fetchBithumbCandles4H,
  fetchBithumbCandles1D
} from "@/lib/bithumbCandles";
import { SMA, BollingerBands } from "technicalindicators";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol');
    const exchange = searchParams.get('exchange') as 'upbit' | 'bithumb';
    const timeframe = searchParams.get('timeframe') || '1h'; // 기본값 1시간

    if (!symbol || !exchange) {
      return Response.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // 캔들 데이터 가져오기
    let candles;
    if (exchange === 'upbit') {
      const market = `KRW-${symbol}`;
      switch (timeframe) {
        case '5m':
          candles = await fetchUpbitCandles5M(market, 250);
          break;
        case '30m':
          candles = await fetchUpbitCandles30M(market, 250);
          break;
        case '4h':
          candles = await fetchUpbitCandles4H(market, 250);
          break;
        case '1d':
          candles = await fetchUpbitCandles1D(market, 250);
          break;
        default: // '1h'
          candles = await fetchUpbitCandles(market, 250);
      }
    } else {
      switch (timeframe) {
        case '5m':
          candles = await fetchBithumbCandles5M(symbol, 250);
          break;
        case '30m':
          candles = await fetchBithumbCandles30M(symbol, 250);
          break;
        case '4h':
          candles = await fetchBithumbCandles4H(symbol, 250);
          break;
        case '1d':
          candles = await fetchBithumbCandles1D(symbol, 250);
          break;
        default: // '1h'
          candles = await fetchBithumbCandles(symbol, 250);
      }
    }

    // lightweight-charts 형식으로 변환
    const chartCandles = candles.map(c => ({
      time: Math.floor(c.t / 1000) as any, // seconds
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // 거래량 히스토그램 데이터 (상승=녹색, 하락=빨간)
    const volumes = candles.map(c => ({
      time: Math.floor(c.t / 1000) as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)',
    }));

    // 이동평균선 계산
    const closes = candles.map(c => c.close);

    // SMA 50, 110, 180
    const sma50Values = SMA.calculate({ period: 50, values: closes });
    const sma110Values = SMA.calculate({ period: 110, values: closes });
    const sma180Values = SMA.calculate({ period: 180, values: closes });

    // 데이터 형식 변환
    const sma50Data = sma50Values.map((value, index) => ({
      time: Math.floor(candles[index + 49].t / 1000) as any,
      value: value,
    }));

    const sma110Data = sma110Values.map((value, index) => ({
      time: Math.floor(candles[index + 109].t / 1000) as any,
      value: value,
    }));

    const sma180Data = sma180Values.map((value, index) => ({
      time: Math.floor(candles[index + 179].t / 1000) as any,
      value: value,
    }));

    // Bollinger Bands 계산 (20-period, 2 std dev)
    const bbInput = {
      period: 20,
      values: closes,
      stdDev: 2,
    };
    const bbValues = BollingerBands.calculate(bbInput);
    const bollingerBands = bbValues.map((value, index) => ({
      time: Math.floor(candles[index + 19].t / 1000) as any,
      upper: value.upper,
      lower: value.lower,
    }));

    // 일목균형표 — 선행스팬 A, B (이동 26)
    // 전환선: 9기간 (H+L)/2  기준선: 26기간 (H+L)/2
    // 선행A: (전환+기준)/2 → 26봉 앞
    // 선행B: 52기간 (H+L)/2 → 26봉 앞
    const highs = candles.map(c => c.high);
    const lows  = candles.map(c => c.low);
    const N     = candles.length;
    const D     = 26; // displacement
    const periodMs = N >= 2 ? candles[N - 1].t - candles[N - 2].t : 3_600_000;

    const ichimokuA: { time: number; value: number }[] = [];
    const ichimokuB: { time: number; value: number }[] = [];

    for (let i = 51; i < N; i++) {
      const tHigh = Math.max(...highs.slice(i - 8, i + 1));
      const tLow  = Math.min(...lows.slice(i - 8, i + 1));
      const tenkan = (tHigh + tLow) / 2;

      const kHigh = Math.max(...highs.slice(i - 25, i + 1));
      const kLow  = Math.min(...lows.slice(i - 25, i + 1));
      const kijun = (kHigh + kLow) / 2;

      const spanA = (tenkan + kijun) / 2;

      const bHigh = Math.max(...highs.slice(i - 51, i + 1));
      const bLow  = Math.min(...lows.slice(i - 51, i + 1));
      const spanB = (bHigh + bLow) / 2;

      // 26봉 앞 타임스탬프 (미래는 추정치)
      const plotTime = i + D < N
        ? Math.floor(candles[i + D].t / 1000)
        : Math.floor((candles[N - 1].t + (i + D - (N - 1)) * periodMs) / 1000);

      ichimokuA.push({ time: plotTime, value: spanA });
      ichimokuB.push({ time: plotTime, value: spanB });
    }

    // 타임프레임별 캐시 TTL (캔들 주기에 맞춤)
    const ttlMap: Record<string, number> = { '5m': 300, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400 };
    const ttl = ttlMap[timeframe] || 3600;

    return new Response(JSON.stringify({
      candles: chartCandles,
      volumes,
      sma50: sma50Data,
      sma110: sma110Data,
      sma180: sma180Data,
      bollingerBands: bollingerBands,
      ichimokuA,
      ichimokuB,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
      },
    });
  } catch (error: any) {
    console.error('Chart API error:', error);
    return Response.json(
      { error: error?.message || 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
