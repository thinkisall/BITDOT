// lib/scanBox.ts
import { SMA, ATR } from "technicalindicators";

export type Candle = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type BoxScanOptions = {
  smaPeriod: number;        // 50
  atrPeriod: number;        // 14
  boxLookback: number;      // 예: 48~96
  maxRangePct: number;      // 예: 0.03 (3%)
  atrMult: number;          // 예: 2.0
  maxSlopeNorm: number;     // 예: 0.0006 (봉당 0.06% 정도)
  touchBandPct: number;     // 예: 0.15 (레인지의 15% 구간을 터치로 봄)
  minTouches: number;       // 예: 2
};

export type BoxResult = {
  ok: boolean;
  reason?: string;
  sma50?: number;
  top?: number;
  bottom?: number;
  rangePct?: number;
  atr?: number;
  slopeNorm?: number;
  touchesTop?: number;
  touchesBottom?: number;
};

function linRegSlope(y: number[]): number {
  const n = y.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    sumX += x;
    sumY += y[i];
    sumXY += x * y[i];
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom; // price per bar
}

export function scanOneSymbol(candles: Candle[], opt: BoxScanOptions): BoxResult {
  if (candles.length < Math.max(opt.smaPeriod + 5, opt.boxLookback + 5)) {
    return { ok: false, reason: "not_enough_candles" };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);

  const smaArr = SMA.calculate({ period: opt.smaPeriod, values: closes });
  const smaLast = smaArr[smaArr.length - 1];
  const closeLast = closes[closes.length - 1];

  if (!(closeLast > smaLast)) {
    return { ok: false, reason: "below_sma", sma50: smaLast };
  }

  // 박스 구간: 최근 boxLookback개
  const box = candles.slice(-opt.boxLookback);
  const boxHigh = Math.max(...box.map(c => c.high));
  const boxLow  = Math.min(...box.map(c => c.low));
  const mid = (boxHigh + boxLow) / 2;
  const range = boxHigh - boxLow;
  const rangePct = range / mid;

  // ATR (전체 구간에서 계산 후 마지막 값 사용)
  const atrArr = ATR.calculate({
    period: opt.atrPeriod,
    high: highs,
    low: lows,
    close: closes,
  });
  const atrLast = atrArr[atrArr.length - 1];

  const rangeOk = (rangePct <= opt.maxRangePct) || (range <= opt.atrMult * atrLast);
  if (!rangeOk) {
    return { ok: false, reason: "range_too_wide", sma50: smaLast, top: boxHigh, bottom: boxLow, rangePct, atr: atrLast };
  }

  // 추세(기울기) 체크
  const boxCloses = box.map(c => c.close);
  const slope = linRegSlope(boxCloses);
  const slopeNorm = Math.abs(slope) / mid; // (price/bar) / price = 1/bar
  if (slopeNorm > opt.maxSlopeNorm) {
    return { ok: false, reason: "trend_exists", sma50: smaLast, top: boxHigh, bottom: boxLow, rangePct, atr: atrLast, slopeNorm };
  }

  // 상단/하단 터치 횟수
  const band = range * opt.touchBandPct;
  let touchesTop = 0;
  let touchesBottom = 0;
  for (const c of box) {
    if (c.high >= boxHigh - band) touchesTop++;
    if (c.low  <= boxLow + band) touchesBottom++;
  }
  if (touchesTop < opt.minTouches || touchesBottom < opt.minTouches) {
    return { ok: false, reason: "not_enough_touches", sma50: smaLast, top: boxHigh, bottom: boxLow, rangePct, atr: atrLast, slopeNorm, touchesTop, touchesBottom };
  }

  return { ok: true, sma50: smaLast, top: boxHigh, bottom: boxLow, rangePct, atr: atrLast, slopeNorm, touchesTop, touchesBottom };
}
