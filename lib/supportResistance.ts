// lib/supportResistance.ts
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
  score: number; // 박스권 신뢰도
}

// 장대양봉 탐지
export function findLongBullishCandles(candles: Candle[], multiplier = 1.5): Candle[] {
  const avgBodySize = candles.reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / candles.length;

  return candles.filter(c => {
    const bodySize = Math.abs(c.close - c.open);
    const isBullish = c.close > c.open;
    return isBullish && bodySize >= avgBodySize * multiplier;
  });
}

// 가격 레벨에서 터치 횟수 계산
function countTouches(candles: Candle[], priceLevel: number, tolerance = 0.01): number {
  let touches = 0;
  const range = priceLevel * tolerance;

  for (const candle of candles) {
    // 고가나 저가가 가격 레벨 근처에 있으면 터치로 간주
    if (Math.abs(candle.high - priceLevel) <= range ||
        Math.abs(candle.low - priceLevel) <= range ||
        Math.abs(candle.open - priceLevel) <= range ||
        Math.abs(candle.close - priceLevel) <= range) {
      touches++;
    }
  }

  return touches;
}

// 비슷한 가격 레벨 그룹화
function groupSimilarLevels(levels: number[], tolerance = 0.005): number[] {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a - b);
  const grouped: number[] = [];
  let currentGroup = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.abs(sorted[i] - sorted[i - 1]) / sorted[i - 1];

    if (diff <= tolerance) {
      currentGroup.push(sorted[i]);
    } else {
      // 그룹의 평균을 대표 레벨로 사용
      const avg = currentGroup.reduce((sum, v) => sum + v, 0) / currentGroup.length;
      grouped.push(avg);
      currentGroup = [sorted[i]];
    }
  }

  // 마지막 그룹 처리
  if (currentGroup.length > 0) {
    const avg = currentGroup.reduce((sum, v) => sum + v, 0) / currentGroup.length;
    grouped.push(avg);
  }

  return grouped;
}

// 지지/저항 레벨 탐지
export function findSupportResistanceLevels(
  candles4h: Candle[],
  candles1d: Candle[],
  candles1h: Candle[],
  currentPrice: number,
  minTouches = 3
): PriceLevel[] {
  // 1시간봉, 4시간봉, 일봉에서 장대양봉 찾기
  const longCandles1h = findLongBullishCandles(candles1h, 2.0);
  const longCandles4h = findLongBullishCandles(candles4h, 2.0);
  const longCandles1d = findLongBullishCandles(candles1d, 2.0);

  // 가격 레벨 수집 (시가와 종가)
  const priceLevels: number[] = [];

  longCandles1h.forEach(c => {
    priceLevels.push(c.open, c.close);
  });

  longCandles4h.forEach(c => {
    priceLevels.push(c.open, c.close);
  });

  longCandles1d.forEach(c => {
    priceLevels.push(c.open, c.close);
  });

  // 비슷한 레벨 그룹화
  const groupedLevels = groupSimilarLevels(priceLevels, 0.01);

  // 각 레벨에서 1시간봉 터치 횟수 계산
  const levels: PriceLevel[] = groupedLevels
    .map(price => ({
      price,
      touches: countTouches(candles1h, price, 0.015),
      type: (price > currentPrice ? 'resistance' : 'support') as 'support' | 'resistance',
    }))
    .filter(level => level.touches >= minTouches)
    .sort((a, b) => a.price - b.price);

  return levels;
}

// 캔들이 범위 안에 있는지 확인
function candlesInRange(candles: Candle[], bottom: number, top: number): number {
  let count = 0;

  for (const candle of candles) {
    // 캔들의 대부분이 범위 안에 있으면 카운트
    const candleCenter = (candle.high + candle.low) / 2;
    if (candleCenter >= bottom && candleCenter <= top) {
      count++;
    }
  }

  return count;
}

// 박스권 탐지
export function detectBoxRanges(
  levels: PriceLevel[],
  candles1h: Candle[],
  minCandlesInBox = 10
): BoxRange[] {
  const boxes: BoxRange[] = [];
  const recentCandles = candles1h.slice(-72); // 최근 72개 (3일)

  // 연속된 레벨 쌍을 확인하여 박스권 찾기
  for (let i = 0; i < levels.length - 1; i++) {
    const bottom = levels[i].price;
    const top = levels[i + 1].price;
    const range = top - bottom;
    const midPrice = (top + bottom) / 2;
    const rangePercent = range / midPrice;

    // 범위가 너무 넓거나 좁으면 스킵
    if (rangePercent > 0.2 || rangePercent < 0.01) continue;

    const candlesCount = candlesInRange(recentCandles, bottom, top);

    // 최소 캔들 수 이상이면 박스권으로 인정
    if (candlesCount >= minCandlesInBox) {
      const bottomType = levels[i].type;
      const topType = levels[i + 1].type;

      let boxType: 'support-support' | 'support-resistance' | 'resistance-resistance';
      if (bottomType === 'support' && topType === 'support') {
        boxType = 'support-support';
      } else if (bottomType === 'support' && topType === 'resistance') {
        boxType = 'support-resistance';
      } else {
        boxType = 'resistance-resistance';
      }

      // 점수 계산 (터치 횟수와 범위 내 캔들 수 기반)
      const score = (levels[i].touches + levels[i + 1].touches) * candlesCount / recentCandles.length;

      boxes.push({
        top,
        bottom,
        type: boxType,
        candlesInRange: candlesCount,
        score,
      });
    }
  }

  // 점수순으로 정렬
  return boxes.sort((a, b) => b.score - a.score);
}
