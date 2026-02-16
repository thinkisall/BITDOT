// lib/bithumbCandles.ts
import type { Candle } from "./scanBox";

export async function fetchBithumbCandles(symbol: string, count = 200): Promise<Candle[]> {
  // 빗썸은 24h를 사용하여 1시간봉 200개를 가져옵니다
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/1h`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (json.status !== '0000' || !json.data) {
    throw new Error('Invalid response from Bithumb');
  }

  const data = json.data;

  // 빗썸 캔들 데이터는 [timestamp, open, close, high, low, volume] 형식
  const candles: Candle[] = data.slice(-count).map((candle: any[]) => ({
    t: Number(candle[0]),
    open: Number(candle[1]),
    high: Number(candle[3]),
    low: Number(candle[4]),
    close: Number(candle[2]),
    volume: Number(candle[5]),
  }));

  return candles;
}

export async function fetchBithumbCandles4H(symbol: string, count = 100): Promise<Candle[]> {
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/4h`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (json.status !== '0000' || !json.data) {
    throw new Error('Invalid response from Bithumb');
  }

  const data = json.data;

  const candles: Candle[] = data.slice(-count).map((candle: any[]) => ({
    t: Number(candle[0]),
    open: Number(candle[1]),
    high: Number(candle[3]),
    low: Number(candle[4]),
    close: Number(candle[2]),
    volume: Number(candle[5]),
  }));

  return candles;
}

export async function fetchBithumbCandles1D(symbol: string, count = 100): Promise<Candle[]> {
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/24h`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (json.status !== '0000' || !json.data) {
    throw new Error('Invalid response from Bithumb');
  }

  const data = json.data;

  const candles: Candle[] = data.slice(-count).map((candle: any[]) => ({
    t: Number(candle[0]),
    open: Number(candle[1]),
    high: Number(candle[3]),
    low: Number(candle[4]),
    close: Number(candle[2]),
    volume: Number(candle[5]),
  }));

  return candles;
}
