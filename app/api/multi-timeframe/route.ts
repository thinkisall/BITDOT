// app/api/multi-timeframe/route.ts
import { fetchUpbitCandles30M, fetchUpbitCandles, fetchUpbitCandles4H, fetchUpbitCandles1D } from "@/lib/upbitCandles";
import { fetchBithumbCandles30M, fetchBithumbCandles, fetchBithumbCandles4H, fetchBithumbCandles1D } from "@/lib/bithumbCandles";
import { findSupportResistanceLevels, detectBoxRanges } from "@/lib/supportResistance";

// 메이저 코인 리스트 (제외할 코인들)
const MAJOR_COINS = new Set([
  'BTC', 'ETH', 'XRP', 'USDT', 'USDC', 'BNB', 'SOL', 'ADA', 'DOGE', 'TRX',
  'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM'
]);

// 캐시 저장소 (메모리)
let cachedResults: {
  results: MultiTimeframeResult[];
  totalAnalyzed: number;
  foundCount: number;
  lastUpdated: number; // timestamp
} | null = null;

let isAnalyzing = false; // 분석 진행 중 플래그
let backgroundWorkerStarted = false; // 백그라운드 워커 시작 플래그
const ANALYSIS_INTERVAL = 5 * 60 * 1000; // 5분마다 분석

interface MarketWithVolume {
  symbol: string;
  market: string;
  volume: number;
  exchange: 'upbit' | 'bithumb';
}

interface TimeframeBoxInfo {
  hasBox: boolean;
  top?: number;
  bottom?: number;
  score?: number;
  type?: string;
  position?: 'breakout' | 'top' | 'middle' | 'bottom' | 'below'; // 가격 위치
  positionPercent?: number; // 박스권 내 위치 퍼센트 (0-100)
}

interface MultiTimeframeResult {
  symbol: string;
  exchange: 'upbit' | 'bithumb';
  volume: number;
  currentPrice: number;
  timeframes: {
    '30m': TimeframeBoxInfo;
    '1h': TimeframeBoxInfo;
    '4h': TimeframeBoxInfo;
    '1d': TimeframeBoxInfo;
  };
  boxCount: number; // 박스권 형성된 시간대 개수
  allTimeframes: boolean; // 모든 시간대에서 박스권 형성
}

// 실제 분석 수행 함수
async function performAnalysis() {
  try {
    isAnalyzing = true;
    console.log('Starting multi-timeframe analysis...');
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
          volume: ticker.acc_trade_price_24h,
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
            volume: Number(ticker.acc_trade_value_24H || 0),
            exchange: 'bithumb',
          });
        }
      });
    }

    // 4. 거래량 순으로 정렬 (전체 종목)
    const allMarkets = marketsWithVolume.sort((a, b) => b.volume - a.volume);

    // 디버깅: 업비트와 빗썸 종목 수 확인
    const upbitCount = allMarkets.filter(m => m.exchange === 'upbit').length;
    const bithumbCount = allMarkets.filter(m => m.exchange === 'bithumb').length;
    console.log(`Total markets: ${allMarkets.length} (Upbit: ${upbitCount}, Bithumb: ${bithumbCount})`);
    console.log(`Top 5 by volume:`, allMarkets.slice(0, 5).map(m => `${m.symbol}(${m.exchange})`));

    // 5. 각 종목의 모든 시간대 스캔 (배치 처리로 Rate Limit 회피)
    const BATCH_SIZE = 3; // 한 번에 3개씩 처리 (Rate Limit 회피)
    const DELAY_MS = 2000; // 배치 사이 2초 대기
    const results: MultiTimeframeResult[] = [];

    for (let i = 0; i < allMarkets.length; i += BATCH_SIZE) {
      const batch = allMarkets.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allMarkets.length / BATCH_SIZE)}`);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
        try {
          let candles30m, candles1h, candles4h, candles1d;

          if (item.exchange === 'upbit') {
            [candles30m, candles1h, candles4h, candles1d] = await Promise.all([
              fetchUpbitCandles30M(item.market, 250),
              fetchUpbitCandles(item.market, 250),
              fetchUpbitCandles4H(item.market, 100),
              fetchUpbitCandles1D(item.market, 100),
            ]);
          } else {
            [candles30m, candles1h, candles4h, candles1d] = await Promise.all([
              fetchBithumbCandles30M(item.symbol, 250),
              fetchBithumbCandles(item.symbol, 250),
              fetchBithumbCandles4H(item.symbol, 100),
              fetchBithumbCandles1D(item.symbol, 100),
            ]);
          }

          const currentPrice = candles1h[candles1h.length - 1].close;

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
            '30m': analyzeTimeframe(candles30m, candles1h, candles4h),
            '1h': analyzeTimeframe(candles1h, candles4h, candles1d),
            '4h': analyzeTimeframe(candles4h, candles1d, candles1h),
            '1d': analyzeTimeframe(candles1d, candles4h, candles1h),
          };

          const boxCount = Object.values(timeframes).filter(tf => tf.hasBox).length;
          const allTimeframes = boxCount === 4;

          return {
            symbol: item.symbol,
            exchange: item.exchange,
            volume: item.volume,
            currentPrice,
            timeframes,
            boxCount,
            allTimeframes,
          };
        } catch (e: any) {
          console.error(`Error analyzing ${item.symbol} (${item.exchange}):`, e.message);
          // 에러가 발생해도 빈 결과 반환 (분석 계속)
          return {
            symbol: item.symbol,
            exchange: item.exchange,
            volume: item.volume,
            currentPrice: 0,
            timeframes: {
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

    // 디버깅: 거래소별 박스권 종목 수
    const upbitBoxCount = validResults.filter(r => r.exchange === 'upbit').length;
    const bithumbBoxCount = validResults.filter(r => r.exchange === 'bithumb').length;
    console.log(`Box patterns found: ${validResults.length} (Upbit: ${upbitBoxCount}, Bithumb: ${bithumbBoxCount})`);

    // 박스권 개수순, 거래량순 정렬
    validResults.sort((a, b) => {
      if (b.boxCount !== a.boxCount) return b.boxCount - a.boxCount;
      return b.volume - a.volume;
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

// 백그라운드 워커 시작 함수
function startBackgroundWorker() {
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

      return Response.json({
        ...cachedResults,
        cached: true,
        cacheAge: Math.floor(cacheAge / 1000), // 초 단위
        analyzing: isAnalyzing, // 현재 분석 중인지 여부
      });
    }

    // 캐시가 아직 없는 경우 (서버 첫 시작)
    console.log('No cache available yet. Analysis in progress...');
    return Response.json({
      results: [],
      totalAnalyzed: 0,
      foundCount: 0,
      lastUpdated: 0,
      cached: false,
      analyzing: isAnalyzing,
      message: '분석이 진행 중입니다. 잠시 후 다시 시도해주세요.',
    });
  } catch (error: any) {
    console.error('Multi-timeframe API error:', error);
    return Response.json(
      { error: error?.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
