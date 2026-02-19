// app/api/multi-timeframe/route.ts
import { fetchUpbitCandles5M, fetchUpbitCandles30M, fetchUpbitCandles, fetchUpbitCandles4H, fetchUpbitCandles1D } from "@/lib/upbitCandles";
import { fetchBithumbCandles5M, fetchBithumbCandles30M, fetchBithumbCandles, fetchBithumbCandles4H, fetchBithumbCandles1D } from "@/lib/bithumbCandles";
import { findSupportResistanceLevels, detectBoxRanges } from "@/lib/supportResistance";
import { fetchBithumbMarkets } from "@/lib/markets";

// ─── Queue Rate Limiter ───────────────────────────────────────────────────────
// 동시 호출 시 각 consumer에게 고유한 time slot 부여 → 진짜 순차 제한
// (기존 TokenBucket은 Promise.all 동시 호출 시 모두 같은 대기 후 한꺼번에 폭발하는 버그)
class RateLimiter {
  private nextSlot: number = Date.now();

  constructor(private readonly intervalMs: number) {}

  async consume(): Promise<void> {
    const now = Date.now();
    if (this.nextSlot <= now) {
      this.nextSlot = now + this.intervalMs;
      return; // 대기 불필요
    }
    const wait = this.nextSlot - now;
    this.nextSlot += this.intervalMs; // await 전에 증가 → 다음 호출은 다른 슬롯 배정
    await new Promise(r => setTimeout(r, wait));
  }
}

// 업비트: 1000ms 간격 (2-phase fetch로 평균 API 호출 ~1.5개/심볼 → 90 호출/분, 한도 200 이내)
// 빗썸:  600ms 간격
const upbitLimiter  = new RateLimiter(1000);
const bithumbLimiter = new RateLimiter(600);

// ─── 심볼별 결과 캐시 (25분 TTL) ─────────────────────────────────────────────
// 매 5분 주기에서 캐시가 살아있는 종목은 API 호출 없이 이전 결과 재사용
interface SymbolCacheEntry {
  result: MultiTimeframeResult;
  timestamp: number;
}
const symbolCache = new Map<string, SymbolCacheEntry>();
const SYMBOL_CACHE_TTL = 25 * 60 * 1000; // 25분

// ─── 전체 결과 캐시 ───────────────────────────────────────────────────────────
let cachedResults: {
  results: MultiTimeframeResult[];
  totalAnalyzed: number;
  foundCount: number;
  lastUpdated: number; // timestamp
} | null = null;

let isAnalyzing = false; // 분석 진행 중 플래그
let backgroundWorkerStarted = false; // 백그라운드 워커 시작 플래그
const ANALYSIS_INTERVAL = 5 * 60 * 1000; // 5분마다 분석

interface TimeframeBoxInfo {
  hasBox: boolean;
  top?: number;
  bottom?: number;
  score?: number;
  type?: string;
  position?: 'breakout' | 'top' | 'middle' | 'bottom' | 'below'; // 가격 위치
  positionPercent?: number; // 박스권 내 위치 퍼센트 (0-100)
}

interface VolumeSpike {
  time: number; // timestamp (ms)
  timeAgo: string; // "3시간 전", "1일 전" 등
  volume: number;
  avgVolume: number;
  ratio: number; // 평균 대비 배수
}

interface MultiTimeframeResult {
  symbol: string;
  exchange: 'upbit' | 'bithumb';
  volume: number;
  currentPrice: number;
  timeframes: {
    '5m': TimeframeBoxInfo;
    '30m': TimeframeBoxInfo;
    '1h': TimeframeBoxInfo;
    '4h': TimeframeBoxInfo;
    '1d': TimeframeBoxInfo;
  };
  boxCount: number; // 박스권 형성된 시간대 개수
  allTimeframes: boolean; // 모든 시간대에서 박스권 형성
  above1hMA50?: boolean;             // 현재가 > 1h MA50
  above5mMA50?: boolean;             // 현재가 > 5m MA50
  cloudStatus5m?: 'above' | 'near';  // 5m 구름 위 or 구름 2% 이내 아래
  cloudStatus30m?: 'above' | 'near'; // 30m 구름 위 or 구름 2% 이내 아래
  cloudStatus?: 'above' | 'near';   // 1h 구름 위 or 구름 2% 이내 아래(주목)
  cloudStatus4h?: 'above' | 'near'; // 4h 구름 위 or 구름 2% 이내 아래(주목)
  volumeSpike?: VolumeSpike; // 거래량 급증 정보 (20배 이상)
  ma110?: number;                               // VWMA110
  ma50?: number;                                // SMA50
  isTriggered?: boolean;                                       // 최근 7일 내 기준봉 발생
  pullbackSignal?: 'TREND_110' | 'SUPPORT_50' | 'SUPPORT_180'; // 눌림목 신호
  watchlist?: { // 관심종목 (1시간봉 MA50 우상향)
    isUptrend: boolean;
    slope: number; // 기울기 퍼센트
    ma50Current: number; // 현재 MA50 값
  };
}

// 1시간봉 MA50 기울기 분석 함수 (우상향 추세 판별)
function detectMA50Uptrend(candles: any[]): { isUptrend: boolean; slope?: number; ma50Current?: number } {
  if (candles.length < 55) return { isUptrend: false }; // MA50 계산 + 기울기 비교에 최소 55개 필요

  // MA50 계산 (최근 5개 시점)
  const ma50Values: number[] = [];
  for (let i = 0; i < 5; i++) {
    const endIdx = candles.length - i;
    const startIdx = endIdx - 50;
    if (startIdx < 0) break;
    const slice = candles.slice(startIdx, endIdx);
    const ma50 = slice.reduce((sum, c) => sum + c.close, 0) / 50;
    ma50Values.unshift(ma50); // 시간순 정렬
  }

  if (ma50Values.length < 3) return { isUptrend: false };

  // 기울기 판별: 최근 MA50 값들이 연속 상승하는지 확인
  let risingCount = 0;
  for (let i = 1; i < ma50Values.length; i++) {
    if (ma50Values[i] > ma50Values[i - 1]) {
      risingCount++;
    }
  }

  // 기울기 퍼센트 (최근 MA50 vs 5봉 전 MA50)
  const oldestMA = ma50Values[0];
  const latestMA = ma50Values[ma50Values.length - 1];
  const slopePercent = ((latestMA - oldestMA) / oldestMA) * 100;

  // 조건: 최근 5개 중 3개 이상 상승 + 기울기 0% 초과
  const isUptrend = risingCount >= 3 && slopePercent > 0;

  return {
    isUptrend,
    slope: Math.round(slopePercent * 100) / 100, // 소수점 2자리
    ma50Current: Math.round(latestMA),
  };
}


// 일목구름 대비 현재가 상태 반환
// 'above' : 구름 위  (통과)
// 'near'  : 구름 상단 2% 이내 아래  (주목)
// 'below' : 구름 상단 2% 이상 아래  (제외)
function getIchimokuCloudStatus(
  candles: any[],
  currentPrice: number
): 'above' | 'near' | 'below' {
  const N = candles.length;
  if (N < 78) return 'below';

  const highs: number[] = candles.map((c: any) => c.high);
  const lows:  number[] = candles.map((c: any) => c.low);
  const i = N - 1 - 26; // 현재 캔들에 표시되는 구름의 계산 시점
  if (i < 51) return 'below';

  const tHigh = Math.max(...highs.slice(i - 8,  i + 1));
  const tLow  = Math.min(...lows.slice( i - 8,  i + 1));
  const tenkan = (tHigh + tLow) / 2;

  const kHigh = Math.max(...highs.slice(i - 25, i + 1));
  const kLow  = Math.min(...lows.slice( i - 25, i + 1));
  const kijun = (kHigh + kLow) / 2;

  const spanA = (tenkan + kijun) / 2;

  const bHigh = Math.max(...highs.slice(i - 51, i + 1));
  const bLow  = Math.min(...lows.slice( i - 51, i + 1));
  const spanB = (bHigh + bLow) / 2;

  const cloudTop = Math.max(spanA, spanB);

  if (currentPrice >= cloudTop) return 'above';
  if (currentPrice >= cloudTop * 0.98) return 'near'; // 2% 이내 아래
  return 'below';
}

// 거래량 급증 탐지 함수 (1시간봉 기준)
function detectVolumeSpike(candles: any[], threshold: number = 20): VolumeSpike | undefined {
  if (candles.length < 21) return undefined; // 최소 21개 필요 (20개 평균 + 1개 비교)

  // 최근 50개 캔들 확인 (최대 50시간 전까지)
  const recentCandles = candles.slice(-50);

  for (let i = recentCandles.length - 1; i >= 20; i--) {
    const currentCandle = recentCandles[i];
    // 이전 20개 캔들의 평균 거래량
    const previousCandles = recentCandles.slice(i - 20, i);
    const avgVolume = previousCandles.reduce((sum, c) => sum + c.volume, 0) / 20;

    if (avgVolume > 0) {
      const ratio = currentCandle.volume / avgVolume;

      // 20배 이상 급증
      if (ratio >= threshold) {
        const now = Date.now();
        const spikeTime = currentCandle.t;
        const hoursAgo = Math.floor((now - spikeTime) / (1000 * 60 * 60));

        let timeAgo: string;
        if (hoursAgo < 1) {
          const minutesAgo = Math.floor((now - spikeTime) / (1000 * 60));
          timeAgo = `${minutesAgo}분 전`;
        } else if (hoursAgo < 24) {
          timeAgo = `${hoursAgo}시간 전`;
        } else {
          const daysAgo = Math.floor(hoursAgo / 24);
          timeAgo = `${daysAgo}일 전`;
        }

        return {
          time: spikeTime,
          timeAgo,
          volume: currentCandle.volume,
          avgVolume,
          ratio: Math.round(ratio * 10) / 10, // 소수점 1자리
        };
      }
    }
  }

  return undefined;
}

// 일봉 기반 눌림목 분석
// - 기준봉 조건: 최근 7일 이내 장대양봉(몸통 7% 이상) + 거래량 10배 이상
// - TREND_110: 현재가 > VWMA110 AND VWMA110 우상향 (5일 전보다 현재 VWMA110 높음)
// - SUPPORT_50: 현재가 ≈ SMA50 (±3%) AND SMA50 횡보 or 우상향 (5일 전 이상)
function analyzePullback(
  candles: any[],
  currentPrice: number
): { ma110: number | null; ma50: number | null; isTriggered: boolean; pullbackSignal: 'TREND_110' | 'SUPPORT_50' | 'SUPPORT_180' | null } {
  const LOOKBACK_DAYS = 7;
  const VOL_MULTIPLIER = 10;
  const BODY_THRESHOLD = 0.07;

  if (candles.length < 115) return { ma110: null, ma50: null, isTriggered: false, pullbackSignal: null };

  // VWMA (거래량 가중 이동평균) 계산
  const getVWMA = (slice: any[]) => {
    const totalVol = slice.reduce((s: number, c: any) => s + c.volume, 0);
    if (totalVol === 0) return slice.reduce((s: number, c: any) => s + c.close, 0) / slice.length;
    return slice.reduce((s: number, c: any) => s + c.close * c.volume, 0) / totalVol;
  };
  const getSMA = (slice: any[]) =>
    slice.reduce((s: number, c: any) => s + c.close, 0) / slice.length;

  // VWMA110: 현재 vs 5일 전
  const vwma110 = getVWMA(candles.slice(-110));
  const vwma110Prev = candles.length >= 115 ? getVWMA(candles.slice(-115, -5)) : null;

  // SMA50: 현재 vs 5일 전
  const sma50 = candles.length >= 50 ? getSMA(candles.slice(-50)) : null;
  const sma50Prev = candles.length >= 55 ? getSMA(candles.slice(-55, -5)) : null;

  // SMA180: 현재 vs 5일 전
  const sma180 = candles.length >= 180 ? getSMA(candles.slice(-180)) : null;
  const sma180Prev = candles.length >= 185 ? getSMA(candles.slice(-185, -5)) : null;

  // 기준봉 탐지: 최근 7일 이내 (오늘 제외)
  const avgVol = candles.slice(-20).reduce((s: number, c: any) => s + c.volume, 0) / 20;
  const recentCandles = candles.slice(-(LOOKBACK_DAYS + 1), -1);

  const isTriggered =
    avgVol > 0 &&
    recentCandles.some((c: any) => {
      if (c.open <= 0) return false;
      const bodyPct = (c.close - c.open) / c.open;
      return bodyPct >= BODY_THRESHOLD && c.volume >= avgVol * VOL_MULTIPLIER;
    });

  if (!isTriggered) return { ma110: vwma110, ma50: sma50, isTriggered: false, pullbackSignal: null };

  // Signal 1: TREND_110 — 현재가 > VWMA110 AND VWMA110 우상향 (5일 전보다 높음)
  const isTrend110 =
    currentPrice > vwma110 &&
    vwma110Prev !== null && vwma110 > vwma110Prev;

  // Signal 2: SUPPORT_50 — 현재가 ≈ SMA50 (±3%) AND SMA50 횡보 or 우상향
  const isSupport50 =
    sma50 !== null &&
    currentPrice >= sma50 * 0.97 &&
    currentPrice <= sma50 * 1.03 &&
    sma50Prev !== null && sma50 >= sma50Prev;

  // Signal 3: SUPPORT_180 — 현재가 ≈ SMA180 (±3%) AND SMA180 횡보 or 우상향
  const isSupport180 =
    sma180 !== null &&
    currentPrice >= sma180 * 0.97 &&
    currentPrice <= sma180 * 1.03 &&
    sma180Prev !== null && sma180 >= sma180Prev;

  let pullbackSignal: 'TREND_110' | 'SUPPORT_50' | 'SUPPORT_180' | null = null;
  if (isTrend110)    pullbackSignal = 'TREND_110';
  else if (isSupport50)  pullbackSignal = 'SUPPORT_50';
  else if (isSupport180) pullbackSignal = 'SUPPORT_180';

  return { ma110: vwma110, ma50: sma50, isTriggered: true, pullbackSignal };
}

// 실제 분석 수행 함수
async function performAnalysis() {
  try {
    isAnalyzing = true;
    console.log('Starting multi-timeframe analysis...');
    // 마켓 목록 (5분 캐시, scan/multi-timeframe 공유)
    const bithumbMarkets = await fetchBithumbMarkets();
    console.log(`Bithumb markets: ${bithumbMarkets.length}`);

    // 5. 각 종목의 모든 시간대 스캔
    // - 2-phase fetch: 1h 먼저 → cloud 필터 통과 시에만 나머지 4개 fetch
    //   → 평균 API 호출 ~1.5개/심볼 (기존 5개 대비 70% 감소)
    // - 배치 완료마다 중간 결과 캐시 저장 → 첫 배치 후 즉시 결과 표시
    const BATCH_SIZE = 10;
    const DELAY_MS = 50;
    const results: MultiTimeframeResult[] = [];

    // 정렬 함수 (중간 캐시 업데이트에도 재사용)
    const sortResults = (arr: MultiTimeframeResult[]) => arr.sort((a, b) => {
      const score = (r: MultiTimeframeResult) => {
        const h1 = r.cloudStatus, h4 = r.cloudStatus4h;
        if (h1 === 'above' && h4 === 'above') return 3;
        if (h1 === 'above' && h4 === 'near')  return 2;
        if (h1 === 'above')                   return 1;
        return 0;
      };
      const sd = score(b) - score(a);
      if (sd !== 0) return sd;
      if (b.volume !== a.volume) return b.volume - a.volume;
      return b.boxCount - a.boxCount;
    });

    // 429 재시도 헬퍼
    const fetchWithRetry = async <T>(fn: () => Promise<T>, symbol: string): Promise<T> => {
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          return await fn();
        } catch (e: any) {
          if (e.message?.includes('429') && attempt < 2) {
            const delay = 5000 * (attempt + 1);
            console.warn(`429 (${symbol}), ${delay}ms 후 재시도...`);
            await new Promise(r => setTimeout(r, delay));
          } else throw e;
        }
      }
      throw new Error('unreachable');
    };

    let cacheHits = 0;
    let cacheMisses = 0;

    for (let i = 0; i < bithumbMarkets.length; i += BATCH_SIZE) {
      const batch = bithumbMarkets.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
        try {
          // ─ 심볼 캐시 확인 ────────────────────────────────────────────────
          const cacheKey = `${item.exchange}-${item.symbol}`;
          const cached = symbolCache.get(cacheKey);
          if (cached && Date.now() - cached.timestamp < SYMBOL_CACHE_TTL) {
            cacheHits++;
            return cached.result;
          }
          cacheMisses++;

          // ─ Rate Limiter: 캐시 미스 심볼만 레이트 리밋 적용 ───────────────
          if (item.exchange === 'upbit') {
            await upbitLimiter.consume();
          } else {
            await bithumbLimiter.consume();
          }

          // ─ Phase 1: 1h + 1d 동시 fetch ───────────────────────────────────
          // 1d는 cloud 필터 전에 기준봉 분석 실행 (cloud below 종목도 기준봉 탐지)
          let candles1h: any[], candles1d: any[];
          [candles1h, candles1d] = await fetchWithRetry(
            () => item.exchange === 'upbit'
              ? Promise.all([
                  fetchUpbitCandles(item.market, 250),
                  fetchUpbitCandles1D(item.market, 200),
                ])
              : Promise.all([
                  fetchBithumbCandles(item.symbol, 250),
                  fetchBithumbCandles1D(item.symbol, 200),
                ]),
            item.symbol
          );

          const currentPrice = candles1h[candles1h.length - 1].close;

          // 기준봉 분석: cloud 필터 전에 실행 → 모든 종목 대상
          const pullback = analyzePullback(candles1d, currentPrice);

          // ─ 사전 필터: 1h 일목구름 상태 확인 ──────────────────────────────
          // 'above': 구름 위 (통과)
          // 'near' : 구름 상단 2% 이내 아래 (주목으로 통과)
          // 'below': 구름 상단 2% 이상 아래 (제외) → 기준봉 정보만 저장 후 종료
          const cloudStatus = getIchimokuCloudStatus(candles1h, currentPrice);
          if (cloudStatus === 'below') {
            const filtered: MultiTimeframeResult = {
              symbol: item.symbol, exchange: item.exchange, volume: item.volume,
              currentPrice, boxCount: 0, allTimeframes: false,
              timeframes: { '5m': { hasBox: false }, '30m': { hasBox: false }, '1h': { hasBox: false }, '4h': { hasBox: false }, '1d': { hasBox: false } },
              ma110: pullback.ma110 ?? undefined,
              ma50: pullback.ma50 ?? undefined,
              isTriggered: pullback.isTriggered,
              pullbackSignal: pullback.pullbackSignal ?? undefined,
            };
            symbolCache.set(cacheKey, { result: filtered, timestamp: Date.now() });
            return filtered;
          }

          // ─ Phase 2: 나머지 3개 타임프레임 fetch (cloud 통과 종목만) ──────
          // 1d는 Phase 1에서 이미 fetch
          let candles5m: any[], candles30m: any[], candles4h: any[];
          [candles5m, candles30m, candles4h] = await fetchWithRetry(
            () => item.exchange === 'upbit'
              ? Promise.all([
                  fetchUpbitCandles5M(item.market, 250),
                  fetchUpbitCandles30M(item.market, 250),
                  fetchUpbitCandles4H(item.market, 100),
                ])
              : Promise.all([
                  fetchBithumbCandles5M(item.symbol, 250),
                  fetchBithumbCandles30M(item.symbol, 250),
                  fetchBithumbCandles4H(item.symbol, 100),
                ]),
            item.symbol
          );

          // ─ 4h / 5m / 30m 일목구름 상태 확인 (필터 없음 — 섹션 분류에 사용) ──
          const cloudStatus4h  = getIchimokuCloudStatus(candles4h,  currentPrice);
          const cloudStatus5m  = getIchimokuCloudStatus(candles5m,  currentPrice);
          const cloudStatus30m = getIchimokuCloudStatus(candles30m, currentPrice);

          // 1시간봉 거래량 급증 탐지
          const volumeSpike = detectVolumeSpike(candles1h, 20);

          // MA50 현재가 비교 (1h, 5m)
          const getMA50 = (candles: any[]) =>
            candles.length >= 50
              ? candles.slice(-50).reduce((s: number, c: any) => s + c.close, 0) / 50
              : null;
          const ma50_1h = getMA50(candles1h);
          const ma50_5m = getMA50(candles5m);
          const above1hMA50 = ma50_1h !== null && currentPrice > ma50_1h;
          const above5mMA50 = ma50_5m !== null && currentPrice > ma50_5m;

          // 1시간봉 MA50 우상향 추세 판별
          const ma50Analysis = detectMA50Uptrend(candles1h);

          // 가격 위치 계산 함수
          const calculatePosition = (price: number, top: number, bottom: number) => {
            const boxHeight = top - bottom;

            // 박스권 상단 돌파 (3% 이상 위)
            if (price > top * 1.03) {
              return { position: 'breakout' as const, positionPercent: 100 };
            }

            // 박스권 하단 이탈 (3% 이상 아래)
            if (price < bottom * 0.97) {
              return { position: 'below' as const, positionPercent: 0 };
            }

            // 박스권 내부
            if (price >= bottom && price <= top) {
              const percentInBox = ((price - bottom) / boxHeight) * 100;

              let position: 'top' | 'middle' | 'bottom';
              if (percentInBox >= 66) {
                position = 'top';
              } else if (percentInBox >= 33) {
                position = 'middle';
              } else {
                position = 'bottom';
              }

              return { position, positionPercent: Math.round(percentInBox) };
            }

            // 박스권 근처 (돌파/이탈 임계값 내)
            if (price > top) {
              return { position: 'breakout' as const, positionPercent: 100 };
            } else {
              return { position: 'below' as const, positionPercent: 0 };
            }
          };

          // 각 시간대별 박스권 탐지
          const analyzeTimeframe = (candles: any[], shortCandles: any[], longCandles: any[]): TimeframeBoxInfo => {
            const levels = findSupportResistanceLevels(shortCandles, longCandles, candles, currentPrice, 3);
            const boxes = detectBoxRanges(levels, candles, 10);

            if (boxes.length > 0) {
              const bestBox = boxes[0];
              const { position, positionPercent } = calculatePosition(currentPrice, bestBox.top, bestBox.bottom);

              return {
                hasBox: true,
                top: bestBox.top,
                bottom: bestBox.bottom,
                score: bestBox.score,
                type: bestBox.type,
                position,
                positionPercent,
              };
            }

            return { hasBox: false };
          };

          // 각 시간대 분석
          const timeframes = {
            '5m': analyzeTimeframe(candles5m, candles30m, candles1h),
            '30m': analyzeTimeframe(candles30m, candles1h, candles4h),
            '1h': analyzeTimeframe(candles1h, candles4h, candles1d),
            '4h': analyzeTimeframe(candles4h, candles1d, candles1h),
            '1d': analyzeTimeframe(candles1d, candles4h, candles1h),
          };

          const boxCount = Object.values(timeframes).filter(tf => tf.hasBox).length;
          const allTimeframes = boxCount === 5;

          const analysisResult: MultiTimeframeResult = {
            symbol: item.symbol,
            exchange: item.exchange,
            volume: item.volume,
            currentPrice,
            timeframes,
            boxCount,
            allTimeframes,
            above1hMA50,
            above5mMA50,
            cloudStatus5m:  cloudStatus5m  === 'below' ? undefined : cloudStatus5m,
            cloudStatus30m: cloudStatus30m === 'below' ? undefined : cloudStatus30m,
            cloudStatus,
            cloudStatus4h: cloudStatus4h === 'below' ? undefined : cloudStatus4h,
            volumeSpike,
            ma110: pullback.ma110 ?? undefined,
            ma50: pullback.ma50 ?? undefined,
            isTriggered: pullback.isTriggered,
            pullbackSignal: pullback.pullbackSignal ?? undefined,
            watchlist: ma50Analysis.isUptrend ? {
              isUptrend: true,
              slope: ma50Analysis.slope!,
              ma50Current: ma50Analysis.ma50Current!,
            } : undefined,
          };

          // ─ 심볼 캐시 저장 ─────────────────────────────────────────────────
          symbolCache.set(`${item.exchange}-${item.symbol}`, {
            result: analysisResult,
            timestamp: Date.now(),
          });

          return analysisResult;
        } catch (e: any) {
          console.error(`Error analyzing ${item.symbol} (${item.exchange}):`, e.message);
          // 에러가 발생해도 빈 결과 반환 (분석 계속)
          return {
            symbol: item.symbol,
            exchange: item.exchange,
            volume: item.volume,
            currentPrice: 0,
            timeframes: {
              '5m': { hasBox: false },
              '30m': { hasBox: false },
              '1h': { hasBox: false },
              '4h': { hasBox: false },
              '1d': { hasBox: false },
            },
            boxCount: 0,
            allTimeframes: false,
          };
        }
      })
    );

      results.push(...batchResults);

      // ─ 배치 완료마다 중간 결과 캐시 업데이트 ───────────────────────────
      // 첫 배치 완료 후 즉시 결과 표시 (분석 중에도 부분 결과 노출)
      const partialValid = results.filter(r => r && (r.boxCount > 0 || r.isTriggered));
      sortResults(partialValid);
      cachedResults = {
        results: partialValid,
        totalAnalyzed: i + batch.length,
        foundCount: partialValid.length,
        lastUpdated: Date.now(),
      };

      // 마지막 배치가 아니면 대기
      if (i + BATCH_SIZE < bithumbMarkets.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // 최종 결과 확정
    const validResults = results.filter(r => r && (r.boxCount > 0 || r.isTriggered));
    sortResults(validResults);

    // 캐시 효율 및 박스권 종목 수 로그
    const bithumbBoxCount = validResults.filter(r => r.exchange === 'bithumb').length;
    console.log(
      `Analysis done — total: ${bithumbMarkets.length}, ` +
      `cache hits: ${cacheHits} (${Math.round(cacheHits / bithumbMarkets.length * 100)}%), ` +
      `misses: ${cacheMisses}, ` +
      `box patterns: ${validResults.length} (Bithumb: ${bithumbBoxCount})`
    );

    // 최종 캐시 저장
    cachedResults = {
      results: validResults,
      totalAnalyzed: bithumbMarkets.length,
      foundCount: validResults.length,
      lastUpdated: Date.now(),
    };

    console.log(`Analysis complete. Cached ${validResults.length} results.`);
    isAnalyzing = false;
    return cachedResults;
  } catch (error: any) {
    console.error('Multi-timeframe API error:', error);
    isAnalyzing = false;
    throw error;
  }
}

// 백그라운드 워커 시작 함수 (instrumentation.ts 에서도 호출)
export function startBackgroundWorker() {
  if (backgroundWorkerStarted) {
    console.log('Background worker already started');
    return;
  }

  backgroundWorkerStarted = true;
  console.log('Starting continuous background analysis worker (every 5 minutes)...');

  // 즉시 첫 번째 분석 시작
  performAnalysis().catch(err => {
    console.error('Initial background analysis failed:', err);
  });

  // 5분마다 자동으로 분석 실행
  setInterval(() => {
    if (!isAnalyzing) {
      console.log('Background worker: Starting scheduled analysis...');
      performAnalysis().catch(err => {
        console.error('Scheduled background analysis failed:', err);
      });
    } else {
      console.log('Background worker: Analysis already in progress, skipping this cycle');
    }
  }, ANALYSIS_INTERVAL);
}

// CORS 헤더 추가 함수
function addCorsHeaders(response: Response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  return response;
}

// OPTIONS 핸들러 (CORS preflight)
export async function OPTIONS() {
  return addCorsHeaders(new Response(null, { status: 200 }));
}

// POST 핸들러 - 캐시된 결과 즉시 반환
export async function POST() {
  try {
    // 첫 요청 시 백그라운드 워커 시작
    if (!backgroundWorkerStarted) {
      startBackgroundWorker();
    }

    // 캐시가 있으면 즉시 반환 (나이와 상관없이)
    if (cachedResults) {
      const cacheAge = Date.now() - cachedResults.lastUpdated;
      console.log(`Returning cached results (age: ${Math.floor(cacheAge / 1000)}s, analyzing: ${isAnalyzing})`);

      return addCorsHeaders(Response.json({
        ...cachedResults,
        cached: true,
        cacheAge: Math.floor(cacheAge / 1000), // 초 단위
        analyzing: isAnalyzing, // 현재 분석 중인지 여부
      }));
    }

    // 캐시가 아직 없는 경우 (서버 첫 시작)
    console.log('No cache available yet. Analysis in progress...');
    return addCorsHeaders(Response.json({
      results: [],
      totalAnalyzed: 0,
      foundCount: 0,
      lastUpdated: 0,
      cached: false,
      analyzing: isAnalyzing,
      message: '분석이 진행 중입니다. 잠시 후 다시 시도해주세요.',
    }));
  } catch (error: any) {
    console.error('Multi-timeframe API error:', error);
    return addCorsHeaders(Response.json(
      { error: error?.message || 'Analysis failed' },
      { status: 500 }
    ));
  }
}
