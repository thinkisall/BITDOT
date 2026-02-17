// lib/upbitCandles.ts
import type { Candle } from "./scanBox";

export async function fetchUpbitCandles5M(market: string, count = 200): Promise<Candle[]> {
  const url = `https://api.upbit.com/v1/candles/minutes/5?market=${market}&count=${count}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format');
  }

  return data.reverse().map((candle: any) => ({
    t: new Date(candle.candle_date_time_kst).getTime(),
    open: candle.opening_price,
    high: candle.high_price,
    low: candle.low_price,
    close: candle.trade_price,
    volume: candle.candle_acc_trade_volume,
  }));
}

export async function fetchUpbitCandles30M(market: string, count = 200): Promise<Candle[]> {
  const url = `https://api.upbit.com/v1/candles/minutes/30?market=${market}&count=${count}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format');
  }

  return data.reverse().map((candle: any) => ({
    t: new Date(candle.candle_date_time_kst).getTime(),
    open: candle.opening_price,
    high: candle.high_price,
    low: candle.low_price,
    close: candle.trade_price,
    volume: candle.candle_acc_trade_volume,
  }));
}

export async function fetchUpbitCandles(market: string, count = 200): Promise<Candle[]> {
  const url = `https://api.upbit.com/v1/candles/minutes/60?market=${market}&count=${count}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format');
  }

  // 업비트 캔들 데이터를 최신순으로 정렬 (API는 최신부터 내림차순)
  return data.reverse().map((candle: any) => ({
    t: new Date(candle.candle_date_time_kst).getTime(),
    open: candle.opening_price,
    high: candle.high_price,
    low: candle.low_price,
    close: candle.trade_price,
    volume: candle.candle_acc_trade_volume,
  }));
}

export async function fetchUpbitCandles4H(market: string, count = 100): Promise<Candle[]> {
  const url = `https://api.upbit.com/v1/candles/minutes/240?market=${market}&count=${count}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format');
  }

  return data.reverse().map((candle: any) => ({
    t: new Date(candle.candle_date_time_kst).getTime(),
    open: candle.opening_price,
    high: candle.high_price,
    low: candle.low_price,
    close: candle.trade_price,
    volume: candle.candle_acc_trade_volume,
  }));
}

export async function fetchUpbitCandles1D(market: string, count = 100): Promise<Candle[]> {
  const url = `https://api.upbit.com/v1/candles/days?market=${market}&count=${count}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  if (!Array.isArray(data)) {
    throw new Error('Invalid response format');
  }

  return data.reverse().map((candle: any) => ({
    t: new Date(candle.candle_date_time_kst).getTime(),
    open: candle.opening_price,
    high: candle.high_price,
    low: candle.low_price,
    close: candle.trade_price,
    volume: candle.candle_acc_trade_volume,
  }));
}
