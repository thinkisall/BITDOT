// app/api/volume-surge/route.ts

import { NextResponse } from 'next/server';

// 설정값
const CANDLE_COUNT = 21;   // 가져올 캔들 수 (현재 1 + 과거 20)
const SURGE_THRESHOLD = 5; // 급등 기준 (예: 평균 거래량의 5배)
const CANDLE_MINUTE_UNIT = '5m'; // 캔들 단위 (빗썸은 '5m', 업비트는 5)

/**
 * API 호출을 위한 유틸리티 함수
 */
async function fetchJson(url: string, options: RequestInit = {}): Promise<any> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorBody}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    throw error;
  }
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 업비트에서 거래량 급등 종목을 스캔합니다.
 */
async function scanUpbit() {
  console.log('[VolumeSurge API] Starting Upbit scan for all markets...');
  
  // 1. 모든 KRW 마켓 코드 가져오기
  const markets = await fetchJson('https://api.upbit.com/v1/market/all');
  const krwMarkets: any[] = markets.filter((m: any) => m.market.startsWith('KRW-'));
  
  console.log(`[VolumeSurge API] Analyzing ${krwMarkets.length} Upbit markets in batches...`);

  // 2. 모든 종목들에 대해 캔들 분석 (배치 처리)
  const results: any[] = [];
  const batchSize = 10;

  for (let i = 0; i < krwMarkets.length; i += batchSize) {
    const batch = krwMarkets.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (market: any) => {
      try {
        const candles = await fetchJson(`https://api.upbit.com/v1/candles/minutes/5?market=${market.market}&count=${CANDLE_COUNT}`);

        if (candles.length < CANDLE_COUNT) return null;

        const latestCandle = candles[0];
        const previousCandles = candles.slice(1);

        const totalVolume = previousCandles.reduce((sum: number, candle: any) => sum + candle.candle_acc_trade_volume, 0);
        const averageVolume = totalVolume / previousCandles.length;

        if (averageVolume > 0) {
          const surgeFactor = latestCandle.candle_acc_trade_volume / averageVolume;
          if (surgeFactor >= SURGE_THRESHOLD) {
            return {
              exchange: 'Upbit',
              market: market.market,
              korean_name: market.korean_name || '',
              surgeFactor: surgeFactor.toFixed(2),
              currentPrice: latestCandle.trade_price,
              volume: latestCandle.candle_acc_trade_volume,
              averageVolume: averageVolume,
            };
          }
        }
        return null;
      } catch (error: any) {
        // console.error(`[VolumeSurge API] Error analyzing Upbit ${market.market}:`, error.message);
        return null;
      }
    });

    const batchResults = (await Promise.all(batchPromises)).filter(r => r !== null);
    results.push(...batchResults);

    if (i + batchSize < krwMarkets.length) {
      await delay(1000); // 다음 배치 전에 1초 대기
    }
  }

  console.log(`[VolumeSurge API] Found ${results.length} surging tickers on Upbit.`);
  return results;
}

/**
 * 빗썸에서 거래량 급등 종목을 스캔합니다.
 */
async function scanBithumb() {
    console.log('[VolumeSurge API] Starting Bithumb scan for all markets...');

    // 1. 모든 KRW 마켓 코드 가져오기
    const response = await fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW');
    if (response.status !== '0000') {
        console.error('[VolumeSurge API] Failed to fetch Bithumb markets');
        return [];
    }
    const allTickers = response.data;
    const krwMarkets = Object.keys(allTickers).filter(k => k !== 'date');

    console.log(`[VolumeSurge API] Analyzing ${krwMarkets.length} Bithumb markets in batches...`);

    // 2. 모든 종목들에 대해 캔들 분석 (배치 처리)
    const results: any[] = [];
    const batchSize = 10; 

    for (let i = 0; i < krwMarkets.length; i += batchSize) {
        const batch = krwMarkets.slice(i, i + batchSize);

        const batchPromises = batch.map(async (marketSymbol: string) => {
            try {
                const candleResponse = await fetchJson(`https://api.bithumb.com/public/candlestick/${marketSymbol}_KRW/${CANDLE_MINUTE_UNIT}`);
                if (candleResponse.status !== '0000' || candleResponse.data.length < CANDLE_COUNT) {
                    return null;
                }
                const candles = candleResponse.data.slice(-CANDLE_COUNT); // 마지막 N개 사용
                
                // 데이터 형식: [타임스탬프, 시가, 종가, 고가, 저가, 거래량]
                const latestCandle = candles[candles.length - 1];
                const previousCandles = candles.slice(0, candles.length - 1);

                const latestVolume = parseFloat(latestCandle[5]);
                const currentPrice = parseFloat(latestCandle[2]);

                const totalVolume = previousCandles.reduce((sum: number, candle: any) => sum + parseFloat(candle[5]), 0);
                const averageVolume = totalVolume / previousCandles.length;

                if (averageVolume > 0) {
                    const surgeFactor = latestVolume / averageVolume;
                    if (surgeFactor >= SURGE_THRESHOLD) {
                        return {
                            exchange: 'Bithumb',
                            market: `${marketSymbol}-KRW`,
                            korean_name: marketSymbol, // Bithumb API는 한글 이름을 별도로 제공하지 않음
                            surgeFactor: surgeFactor.toFixed(2),
                            currentPrice: currentPrice,
                            volume: latestVolume,
                            averageVolume: averageVolume,
                        };
                    }
                }
                return null;
            } catch (error: any) {
                // console.error(`[VolumeSurge API] Error analyzing Bithumb ${marketSymbol}:`, error.message);
                return null;
            }
        });

        const batchResults = (await Promise.all(batchPromises)).filter(r => r !== null);
        results.push(...batchResults);

        if (i + batchSize < krwMarkets.length) {
            await delay(1000); // 다음 배치 전에 1초 대기
        }
    }

    console.log(`[VolumeSurge API] Found ${results.length} surging tickers on Bithumb.`);
    return results;
}


export async function GET(request: Request) {
  try {
    // 업비트와 빗썸 스캔을 동시에 실행
    const [upbitResults, bithumbResults] = await Promise.all([
      scanUpbit(),
      scanBithumb()
    ]);
    
    const allResults = [...upbitResults, ...bithumbResults];

    // 급등률 순으로 정렬
    allResults.sort((a, b) => parseFloat(b.surgeFactor) - parseFloat(a.surgeFactor));

    return NextResponse.json({
      lastUpdated: new Date().toISOString(),
      results: allResults,
    });

  } catch (error: any) {
    console.error('[VolumeSurge API] Failed to get surge data:', error);
    return NextResponse.json({ error: 'Failed to fetch or analyze data.' }, { status: 500 });
  }
}

// Vercel Edge 환경에서 실행되도록 설정 (선택 사항)
// export const config = {
//   runtime: 'edge',
// };
