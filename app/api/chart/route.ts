// app/api/chart/route.ts
import {
  fetchUpbitCandles30M,
  fetchUpbitCandles,
  fetchUpbitCandles4H,
  fetchUpbitCandles1D
} from "@/lib/upbitCandles";
import {
  fetchBithumbCandles30M,
  fetchBithumbCandles,
  fetchBithumbCandles4H,
  fetchBithumbCandles1D
} from "@/lib/bithumbCandles";
import { SMA } from "technicalindicators";

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

    return Response.json({
      candles: chartCandles,
      sma50: sma50Data,
      sma110: sma110Data,
      sma180: sma180Data,
    });
  } catch (error: any) {
    console.error('Chart API error:', error);
    return Response.json(
      { error: error?.message || 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}
