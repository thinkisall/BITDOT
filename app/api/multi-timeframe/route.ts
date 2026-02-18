// app/api/multi-timeframe/route.ts
import { fetchUpbitCandles5M, fetchUpbitCandles30M, fetchUpbitCandles, fetchUpbitCandles4H, fetchUpbitCandles1D } from "@/lib/upbitCandles";
import { fetchBithumbCandles5M, fetchBithumbCandles30M, fetchBithumbCandles, fetchBithumbCandles4H, fetchBithumbCandles1D } from "@/lib/bithumbCandles";
import { findSupportResistanceLevels, detectBoxRanges } from "@/lib/supportResistance";
import { fetchAllMarkets } from "@/lib/markets";

// ─── Token Bucket Rate Limiter ───────────────────────────────────────────────
// API 레이트 리밋을 초과하지 않으면서 최대한 빠르게 요청
class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async consume(): Promise<void> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSecond);
    this.lastRefill = now;

    if (this.tokens < 1) {
      const waitMs = ((1 - this.tokens) / this.refillPerSecond) * 1000;
      await new Promise(r => setTimeout(r, Math.ceil(waitMs)));
      this.tokens = 0;
    } else {
      this.tokens -= 1;
    }
  }
}

// 업비트: 최대 2 심볼/초 (= 10 API호출/초, 리밋 내)
// 빗썸:  최대 3 심볼/초 (= 15 API호출/초, 리밋 내)
const upbitBucket = new TokenBucket(2, 2);
const bithumbBucket = new TokenBucket(3, 3);

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
  goldenAlignment?: boolean; // 1시간봉 정배열 (MA50 > MA110 > MA180)
  cloudStatus?: 'above' | 'near';   // 1h 구름 위 or 구름 2% 이내 아래(주목)
  cloudStatus4h?: 'above' | 'near'; // 4h 구름 위 or 구름 2% 이내 아래(주목)
  volumeSpike?: VolumeSpike; // 거래량 급증 정보 (20배 이상)
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

// 1시간봉 정배열 판별: MA50 > MA110 > MA180
function detectGoldenAlignment(candles: any[]): boolean {
  if (candles.length < 180) return false;
  const closes: number[] = candles.map((c: any) => c.close);
  const N = closes.length;
  const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
  const ma50  = sum(closes.slice(N - 50 )) / 50;
  const ma110 = sum(closes.slice(N - 110)) / 110;
  const ma180 = sum(closes.slice(N - 180)) / 180;
  return ma50 > ma110 && ma110 > ma180;
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

// 실제 분석 수행 함수
async function performAnalysis() {
  try {
    isAnalyzing = true;
    console.log('Starting multi-timeframe analysis...');
    // 마켓 목록 (5분 캐시, scan/multi-timeframe 공유)
    const allMarkets = await fetchAllMarkets();

    // 디버깅: 업비트와 빗썸 종목 수 확인
    const upbitCount = allMarkets.filter(m => m.exchange === 'upbit').length;
    const bithumbCount = allMarkets.filter(m => m.exchange === 'bithumb').length;
    console.log(`Total markets: ${allMarkets.length} (Upbit: ${upbitCount}, Bithumb: ${bithumbCount})`);

    // 5. 각 종목의 모든 시간대 스캔
    // - 심볼 캐시 히트 시 API 호출 없이 이전 결과 재사용 (API 호출 ~80% 감소)
    // - Token Bucket으로 캐시 미스 심볼만 속도 제어
    // - BATCH_SIZE 확대: 대부분이 캐시 히트라 충분히 빠름
    const BATCH_SIZE = 10;
    const DELAY_MS = 100; // 캐시 히트 배치는 거의 즉시 완료되므로 짧게
    const results: MultiTimeframeResult[] = [];

    let cacheHits = 0;
    let cacheMisses = 0;

    for (let i = 0; i < allMarkets.length; i += BATCH_SIZE) {
      const batch = allMarkets.slice(i, i + BATCH_SIZE);

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

          // ─ Token Bucket: 캐시 미스 심볼만 레이트 리밋 적용 ────────────────
          if (item.exchange === 'upbit') {
            await upbitBucket.consume();
          } else {
            await bithumbBucket.consume();
          }

          let candles5m, candles30m, candles1h, candles4h, candles1d;

          if (item.exchange === 'upbit') {
            [candles5m, candles30m, candles1h, candles4h, candles1d] = await Promise.all([
              fetchUpbitCandles5M(item.market, 250),
              fetchUpbitCandles30M(item.market, 250),
              fetchUpbitCandles(item.market, 250),
              fetchUpbitCandles4H(item.market, 100),
              fetchUpbitCandles1D(item.market, 100),
            ]);
          } else {
            [candles5m, candles30m, candles1h, candles4h, candles1d] = await Promise.all([
              fetchBithumbCandles5M(item.symbol, 250),
              fetchBithumbCandles30M(item.symbol, 250),
              fetchBithumbCandles(item.symbol, 250),
              fetchBithumbCandles4H(item.symbol, 100),
              fetchBithumbCandles1D(item.symbol, 100),
            ]);
          }

          const currentPrice = candles1h[candles1h.length - 1].close;

          // ─ 정배열 여부 계산 (필터 아님 — 정렬 우선순위에만 사용) ──────────
          const goldenAlignment = detectGoldenAlignment(candles1h);

          // ─ 사전 필터: 1h 일목구름 상태 확인 ──────────────────────────────
          // 'above': 구름 위 (통과)
          // 'near' : 구름 상단 2% 이내 아래 (주목으로 통과)
          // 'below': 구름 상단 2% 이상 아래 (제외)
          const cloudStatus = getIchimokuCloudStatus(candles1h, currentPrice);
          if (cloudStatus === 'below') {
            const filtered: MultiTimeframeResult = {
              symbol: item.symbol, exchange: item.exchange, volume: item.volume,
              currentPrice, boxCount: 0, allTimeframes: false,
              timeframes: { '5m': { hasBox: false }, '30m': { hasBox: false }, '1h': { hasBox: false }, '4h': { hasBox: false }, '1d': { hasBox: false } },
            };
            symbolCache.set(cacheKey, { result: filtered, timestamp: Date.now() });
            return filtered;
          }

          // ─ 4h 일목구름 상태 확인 (필터 없음 — 정렬 가중치에만 사용) ────────
          const cloudStatus4h = getIchimokuCloudStatus(candles4h, currentPrice);

          // 1시간봉 거래량 급증 탐지
          const volumeSpike = detectVolumeSpike(candles1h, 20);

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
            goldenAlignment,
            cloudStatus,
            cloudStatus4h: cloudStatus4h === 'below' ? undefined : cloudStatus4h,
            volumeSpike,
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

      // 마지막 배치가 아니면 대기
      if (i + BATCH_SIZE < allMarkets.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // null 제거 및 박스권이 1개 이상 있는 종목만 필터링
    const validResults = results.filter(r => r && r.boxCount > 0);

    // 캐시 효율 및 박스권 종목 수 로그
    const upbitBoxCount = validResults.filter(r => r.exchange === 'upbit').length;
    const bithumbBoxCount = validResults.filter(r => r.exchange === 'bithumb').length;
    console.log(
      `Analysis done — total: ${allMarkets.length}, ` +
      `cache hits: ${cacheHits} (${Math.round(cacheHits / allMarkets.length * 100)}%), ` +
      `misses: ${cacheMisses}, ` +
      `box patterns: ${validResults.length} (Upbit: ${upbitBoxCount}, Bithumb: ${bithumbBoxCount})`
    );

    // ─ 6-티어 우선순위 ─────────────────────────────────────────────────────
    // Tier 6: 1h above + 4h above + 정배열  (최고)
    // Tier 5: 1h above + 4h above
    // Tier 4: 1h above + 4h near  + 정배열
    // Tier 3: 1h above + 정배열   (4h above/near 아님)
    // Tier 2: 1h above            (정배열 없음)
    // Tier 1: 1h near  + 정배열
    // Tier 0: 1h near             (정배열 없음)
    const priorityScore = (r: MultiTimeframeResult): number => {
      const h1 = r.cloudStatus;          // 'above' | 'near' | undefined
      const h4 = r.cloudStatus4h;        // 'above' | 'near' | undefined
      const ga = r.goldenAlignment ?? false;

      if (h1 === 'above' && h4 === 'above' && ga) return 6;
      if (h1 === 'above' && h4 === 'above')        return 5;
      if (h1 === 'above' && h4 === 'near'  && ga)  return 4;
      if (h1 === 'above' && ga)                    return 3;
      if (h1 === 'above')                          return 2;
      if (h1 === 'near'  && ga)                    return 1;
      return 0; // h1 === 'near', no golden
    };

    validResults.sort((a, b) => {
      // 1순위: 6-티어 우선순위 점수
      const scoreDiff = priorityScore(b) - priorityScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      // 2순위: 거래량 많은 순
      if (b.volume !== a.volume) return b.volume - a.volume;

      // 3순위: 박스권 개수 많은 순
      return b.boxCount - a.boxCount;
    });

    // 캐시에 저장
    cachedResults = {
      results: validResults,
      totalAnalyzed: allMarkets.length,
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
