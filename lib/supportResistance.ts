// lib/supportResistance.ts
// Density-Based Box Detection (KDE / Volume Profile 방식)
import { Candle } from "./scanBox";

export interface PriceLevel {
  price: number;
  touches: number;
  type: 'support' | 'resistance' | 'both';
}

export interface BoxRange {
  top: number;
  bottom: number;
  type: 'support-support' | 'support-resistance' | 'resistance-resistance';
  candlesInRange: number;
  score: number;
  density: number; // 박스 내 캔들 비율 (0~1)
  poc: number;     // Point of Control (가장 거래가 많았던 가격)
}

// ─── ATR 계산 ─────────────────────────────────────────────────────────────────
function calcATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  const slice = trs.slice(-period);
  return slice.reduce((s, v) => s + v, 0) / slice.length;
}

// ─── 이상치 제거 ───────────────────────────────────────────────────────────────
// High 상위 pct%, Low 하위 pct%를 이상치로 간주해 캔들 제외
function removeOutliers(candles: Candle[], pct = 0.05): Candle[] {
  if (candles.length < 20) return candles;
  const highs = candles.map(c => c.high).sort((a, b) => a - b);
  const lows  = candles.map(c => c.low ).sort((a, b) => a - b);
  const cutHigh = highs[Math.floor(highs.length * (1 - pct))];
  const cutLow  = lows [Math.floor(lows.length  * pct)];
  return candles.filter(c => c.high <= cutHigh && c.low >= cutLow);
}

// ─── Volume-Weighted 가격 히스토그램 ─────────────────────────────────────────
// 몸통(close/open) 가중치 2배 · 꼬리(high/low) 가중치 1배 · 거래량 스케일
interface HistBin {
  price: number;  // bin 중심가
  weight: number; // volume-weighted 밀도
  count: number;
}

function buildHistogram(candles: Candle[], binCount = 60): HistBin[] {
  if (candles.length === 0) return [];

  // 이상치 제거 후 몸통 가격 범위
  const clean = removeOutliers(candles, 0.05);
  const bodyPrices = clean.flatMap(c => [c.open, c.close]);
  const minP = Math.min(...bodyPrices);
  const maxP = Math.max(...bodyPrices);
  if (maxP <= minP) return [];

  const binSize = (maxP - minP) / binCount;

  const bins: HistBin[] = Array.from({ length: binCount }, (_, i) => ({
    price: minP + (i + 0.5) * binSize,
    weight: 0,
    count: 0,
  }));

  for (const c of clean) {
    const vol = c.volume > 0 ? c.volume : 1;
    // 몸통 × 2, 꼬리 × 1 가중치
    const points: [number, number][] = [
      [c.close, 2 * vol],
      [c.open,  2 * vol],
      [c.high,  1 * vol],
      [c.low,   1 * vol],
    ];
    for (const [price, w] of points) {
      if (price < minP || price > maxP) continue;
      const idx = Math.min(Math.floor((price - minP) / binSize), binCount - 1);
      bins[idx].weight += w;
      bins[idx].count  += 1;
    }
  }

  return bins;
}

// ─── 5-bin 가우시안 스무딩 ────────────────────────────────────────────────────
function smoothBins(bins: HistBin[]): number[] {
  const weights = [0.06, 0.24, 0.4, 0.24, 0.06]; // 정규화된 가우시안
  return bins.map((_, i) =>
    weights.reduce((sum, w, j) => {
      const idx = i - 2 + j;
      return sum + w * (bins[idx]?.weight ?? 0);
    }, 0)
  );
}

// ─── POC 탐지 ─────────────────────────────────────────────────────────────────
function findPOC(bins: HistBin[], smoothed: number[]): number {
  let maxIdx = 0;
  for (let i = 1; i < smoothed.length; i++) {
    if (smoothed[i] > smoothed[maxIdx]) maxIdx = i;
  }
  return bins[maxIdx].price;
}

// ─── POC 중심으로 박스 확장 ──────────────────────────────────────────────────
function expandBox(
  bins: HistBin[],
  smoothed: number[],
  pocPrice: number,
  dropThreshold = 0.12 // 최대 밀도의 12% 이하면 박스 경계
): { top: number; bottom: number } {
  if (bins.length === 0) return { top: pocPrice, bottom: pocPrice };

  const binSize = bins.length > 1 ? bins[1].price - bins[0].price : 1;
  const pocIdx = smoothed.reduce(
    (best, v, i) => (Math.abs(bins[i].price - pocPrice) < Math.abs(bins[best].price - pocPrice) ? i : best),
    0
  );

  const maxW  = Math.max(...smoothed);
  const cutoff = maxW * dropThreshold;

  let topIdx    = pocIdx;
  let bottomIdx = pocIdx;

  while (topIdx + 1 < bins.length    && smoothed[topIdx + 1]    >= cutoff) topIdx++;
  while (bottomIdx - 1 >= 0          && smoothed[bottomIdx - 1] >= cutoff) bottomIdx--;

  return {
    top:    bins[topIdx].price    + binSize / 2,
    bottom: bins[bottomIdx].price - binSize / 2,
  };
}

// ─── 단일 기간 밀도 박스 탐지 ─────────────────────────────────────────────────
interface DensityBox {
  top: number;
  bottom: number;
  poc: number;
  density: number;
  candlesInRange: number;
}

function detectDensityBox(
  candles: Candle[],
  period: number,
  minCandlesInBox: number
): DensityBox | null {
  const target = candles.slice(-period);
  if (target.length < 20) return null;

  const bins     = buildHistogram(target, 60);
  if (bins.length === 0) return null;

  const smoothed = smoothBins(bins);
  const poc      = findPOC(bins, smoothed);
  const { top, bottom } = expandBox(bins, smoothed, poc, 0.12);

  // 박스 높이 검증: 1.5% ~ 6%
  const heightPct = (top - bottom) / bottom;
  if (heightPct < 0.015 || heightPct > 0.06) return null;

  // close 기준 박스 내 캔들 수 (1% 여유)
  const inBox = target.filter(c => c.close <= top * 1.01 && c.close >= bottom * 0.99).length;
  if (inBox < minCandlesInBox) return null;

  const density = inBox / target.length;
  if (density < 0.50) return null; // 50% 이상 캔들이 박스 안에 있어야 함

  return { top, bottom, poc, density, candlesInRange: inBox };
}

// ─── 지지/저항 레벨 탐지 (Volume-Weighted Histogram 피크) ───────────────────
export function findSupportResistanceLevels(
  candles4h: Candle[],
  candles1d: Candle[],
  candles1h: Candle[],
  currentPrice: number,
  minTouches = 3
): PriceLevel[] {
  if (candles1h.length === 0) return [];

  const midPrice = candles1h[candles1h.length - 1].close;

  // 멀티 타임프레임 캔들 합산 (4h, 1d는 더 강한 레벨이므로 가중치 복제)
  const combined = [
    ...candles1h.slice(-200),
    ...candles4h.slice(-60),  ...candles4h.slice(-60),  // × 2
    ...candles1d.slice(-30),  ...candles1d.slice(-30),  ...candles1d.slice(-30), // × 3
  ];

  const bins     = buildHistogram(combined, 80);
  if (bins.length === 0) return [];

  const smoothed = smoothBins(bins);
  const maxW     = Math.max(...smoothed);
  const peakCut  = maxW * 0.25; // 최대 밀도의 25% 이상인 피크만

  // 지역 극대값 탐지
  const touchRange = midPrice * 0.015;
  const peaks: PriceLevel[] = [];

  for (let i = 1; i < smoothed.length - 1; i++) {
    if (
      smoothed[i] > smoothed[i - 1] &&
      smoothed[i] >= smoothed[i + 1] &&
      smoothed[i] >= peakCut
    ) {
      const price = bins[i].price;

      // 1h봉 터치 횟수 (close/open/high/low 기준)
      const touches = candles1h.filter(c =>
        Math.abs(c.close - price) <= touchRange ||
        Math.abs(c.open  - price) <= touchRange ||
        Math.abs(c.high  - price) <= touchRange ||
        Math.abs(c.low   - price) <= touchRange
      ).length;

      if (touches >= minTouches) {
        peaks.push({
          price,
          touches,
          type: price >= currentPrice ? 'resistance' : 'support',
        });
      }
    }
  }

  return peaks.sort((a, b) => a.price - b.price);
}

// ─── 박스권 탐지 (Density KDE 메인) ─────────────────────────────────────────
export function detectBoxRanges(
  levels: PriceLevel[],
  candles1h: Candle[],
  minCandlesInBox = 10
): BoxRange[] {
  const boxes: BoxRange[] = [];

  // 여러 lookback 윈도우로 탐지 (짧은 기간부터)
  const periods = [48, 72, 96, 120];

  for (const period of periods) {
    const result = detectDensityBox(candles1h, period, minCandlesInBox);
    if (!result) continue;

    const { top, bottom, poc, density, candlesInRange } = result;

    // 중복 박스 제거 (top/bottom 모두 2% 이내면 같은 박스)
    const isDup = boxes.some(
      b => Math.abs(b.top - top) / top < 0.02 && Math.abs(b.bottom - bottom) / bottom < 0.02
    );
    if (isDup) continue;

    // levels에서 박스 상/하단에 가장 가까운 레벨로 type 결정
    const nearBottom = levels
      .filter(l => Math.abs(l.price - bottom) / bottom < 0.03)
      .sort((a, b) => Math.abs(a.price - bottom) - Math.abs(b.price - bottom))[0];
    const nearTop = levels
      .filter(l => Math.abs(l.price - top) / top < 0.03)
      .sort((a, b) => Math.abs(a.price - top) - Math.abs(b.price - top))[0];

    const bType = nearBottom?.type ?? 'support';
    const tType = nearTop?.type    ?? 'resistance';

    let type: BoxRange['type'];
    if (bType === 'support' && tType === 'support') type = 'support-support';
    else if (bType === 'support')                    type = 'support-resistance';
    else                                             type = 'resistance-resistance';

    // score = density × 박스내비율 × 100
    const target = candles1h.slice(-period);
    const score  = density * (candlesInRange / target.length) * 100;

    boxes.push({ top, bottom, type, candlesInRange, score, density, poc });
  }

  return boxes.sort((a, b) => b.score - a.score);
}
