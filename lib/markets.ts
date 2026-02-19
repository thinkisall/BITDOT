// lib/markets.ts
// 업비트/빗썸 시장 초기화 로직 공통화 + 5분 인메모리 캐시

export interface MarketWithVolume {
  symbol: string;
  market: string; // 'KRW-BTC' for Upbit, 'BTC' for Bithumb
  volume: number;
  exchange: 'upbit' | 'bithumb';
}

const MAJOR_COINS = new Set([
  'BTC', 'ETH', 'XRP', 'USDT', 'USDC', 'BNB', 'SOL', 'ADA', 'DOGE', 'TRX',
  'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM',
  'NFT'
]);

const CACHE_TTL = 5 * 60 * 1000; // 5분

let cachedMarkets: {
  markets: MarketWithVolume[];
  timestamp: number;
} | null = null;

let cachedBithumbMarkets: {
  markets: MarketWithVolume[];
  timestamp: number;
} | null = null;

/**
 * 업비트 + 빗썸 전종목 거래대금 순 마켓 목록 반환 (5분 캐시)
 */
export async function fetchAllMarkets(): Promise<MarketWithVolume[]> {
  // 캐시 유효 시 즉시 반환
  if (cachedMarkets && Date.now() - cachedMarkets.timestamp < CACHE_TTL) {
    return cachedMarkets.markets;
  }

  const [upbitMarketsRes, bithumbRes] = await Promise.all([
    fetch('https://api.upbit.com/v1/market/all'),
    fetch('https://api.bithumb.com/public/ticker/ALL_KRW'),
  ]);

  const upbitMarkets = await upbitMarketsRes.json();
  const bithumbData = await bithumbRes.json();
  const krwMarkets = upbitMarkets.filter((m: any) => m.market.startsWith('KRW-'));

  // 업비트 티커 (거래대금 확인용)
  const marketCodes = krwMarkets.map((m: any) => m.market).join(',');
  const upbitTickerRes = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);
  const upbitTickers = await upbitTickerRes.json();

  const marketsWithVolume: MarketWithVolume[] = [];
  const upbitSymbols = new Set<string>();

  upbitTickers.forEach((ticker: any) => {
    const symbol = ticker.market.replace('KRW-', '');
    if (!MAJOR_COINS.has(symbol)) {
      upbitSymbols.add(symbol);
      marketsWithVolume.push({
        symbol,
        market: ticker.market,
        volume: ticker.acc_trade_price_24h,
        exchange: 'upbit',
      });
    }
  });

  if (bithumbData.status === '0000' && bithumbData.data) {
    Object.entries(bithumbData.data).forEach(([symbol, ticker]: [string, any]) => {
      if (symbol !== 'date' && !MAJOR_COINS.has(symbol) && !upbitSymbols.has(symbol)) {
        marketsWithVolume.push({
          symbol,
          market: symbol,
          volume: Number(ticker.acc_trade_value_24H || 0),
          exchange: 'bithumb',
        });
      }
    });
  }

  marketsWithVolume.sort((a, b) => b.volume - a.volume);

  cachedMarkets = { markets: marketsWithVolume, timestamp: Date.now() };
  return marketsWithVolume;
}

/**
 * 빗썸 전종목 거래대금 순 마켓 목록 반환 (5분 캐시)
 * 업비트 중복 제거 없이 빗썸 전체 종목 반환 (MAJOR_COINS 제외)
 */
export async function fetchBithumbMarkets(): Promise<MarketWithVolume[]> {
  if (cachedBithumbMarkets && Date.now() - cachedBithumbMarkets.timestamp < CACHE_TTL) {
    return cachedBithumbMarkets.markets;
  }

  // 최대 3회 재시도 (429 대응)
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = 3000 * attempt;
      console.warn(`[markets] Bithumb ticker 재시도 ${attempt}/2, ${delay}ms 대기...`);
      await new Promise(r => setTimeout(r, delay));
    }

    const res = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW');

    if (!res.ok) {
      lastError = new Error(`Bithumb markets HTTP ${res.status}`);
      if (res.status === 429) continue; // 재시도
      break; // 다른 에러는 재시도 불필요
    }

    const data = await res.json();
    const markets: MarketWithVolume[] = [];

    if (data.status === '0000' && data.data) {
      Object.entries(data.data).forEach(([symbol, ticker]: [string, any]) => {
        if (symbol !== 'date' && !MAJOR_COINS.has(symbol)) {
          markets.push({
            symbol,
            market: symbol,
            volume: Number(ticker.acc_trade_value_24H || 0),
            exchange: 'bithumb',
          });
        }
      });
    }

    markets.sort((a, b) => b.volume - a.volume);
    cachedBithumbMarkets = { markets, timestamp: Date.now() };
    return markets;
  }

  // 모든 재시도 실패 → 만료 캐시라도 반환
  if (cachedBithumbMarkets) {
    console.warn(`[markets] Bithumb ticker 실패, 만료 캐시 반환 (${lastError?.message})`);
    return cachedBithumbMarkets.markets;
  }
  throw lastError ?? new Error('Bithumb markets fetch failed');
}
