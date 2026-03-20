// server/routes/ma-trend.js
// MA 정배열 + 일목구름 스캐너
// 조건: 1시간봉 MA50>MA110>MA180 정배열 AND 4시간봉 MA50>MA110>MA180 정배열 AND 4시간봉 일목구름 위

const express = require('express');
const router = express.Router();

// ── 캐시 (5분 TTL) ─────────────────────────────────────────────────────────
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;
let isRunning = false;

// ── 동시 요청 제한 ──────────────────────────────────────────────────────────
function createConcurrencyLimiter(concurrency) {
  let running = 0;
  const queue = [];
  return async (fn) => {
    while (running >= concurrency) {
      await new Promise((r) => queue.push(r));
    }
    running++;
    try {
      return await fn();
    } finally {
      running--;
      const r = queue.shift();
      if (r) r();
    }
  };
}

const apiLimit = createConcurrencyLimiter(5);

// ── fetch 헬퍼 ──────────────────────────────────────────────────────────────
async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── 캔들 조회 ───────────────────────────────────────────────────────────────
async function fetchUpbitCandles(market, interval, count = 200) {
  const tfMap = { '1h': 'minutes/60', '4h': 'minutes/240' };
  const url = `https://api.upbit.com/v1/candles/${tfMap[interval]}?market=${market}&count=${count}`;
  const data = await apiLimit(() => fetchJson(url));
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c) => ({
    high:  c.high_price,
    low:   c.low_price,
    close: c.trade_price,
  }));
}

async function fetchBithumbCandles(symbol, interval, count = 200) {
  const tfMap = { '1h': '1h', '4h': '4h' };
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/${tfMap[interval]}`;
  const data = await fetchJson(url);
  if (data.status !== '0000' || !Array.isArray(data.data)) return [];
  return data.data.slice(-count).map((c) => ({
    high:  parseFloat(c[3]),
    low:   parseFloat(c[4]),
    close: parseFloat(c[2]),
  }));
}

// ── 마켓 목록 ───────────────────────────────────────────────────────────────
const MAJOR_COINS = new Set([
  'BTC','ETH','XRP','USDT','USDC','BNB','SOL','ADA','DOGE','TRX',
  'DOT','MATIC','AVAX','LINK','UNI','ATOM','LTC','BCH','ETC','XLM','NFT',
]);

async function getMarkets() {
  const [upbitMarketsRes, bithumbRes] = await Promise.all([
    fetchJson('https://api.upbit.com/v1/market/all'),
    fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW'),
  ]);

  const krwMarkets = upbitMarketsRes.filter((m) => m.market.startsWith('KRW-'));
  const marketCodes = krwMarkets.map((m) => m.market).join(',');
  const upbitTickers = await fetchJson(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);

  const markets = [];
  const upbitSymbols = new Set();

  upbitTickers.forEach((ticker) => {
    const symbol = ticker.market.replace('KRW-', '');
    if (!MAJOR_COINS.has(symbol)) {
      upbitSymbols.add(symbol);
      markets.push({
        symbol,
        market: ticker.market,
        volume: ticker.acc_trade_price_24h,
        exchange: 'upbit',
      });
    }
  });

  if (bithumbRes.status === '0000' && bithumbRes.data) {
    Object.entries(bithumbRes.data).forEach(([symbol, ticker]) => {
      if (symbol !== 'date' && !MAJOR_COINS.has(symbol) && !upbitSymbols.has(symbol)) {
        markets.push({
          symbol,
          market: symbol,
          volume: Number(ticker.acc_trade_value_24H || 0),
          exchange: 'bithumb',
        });
      }
    });
  }

  return markets;
}

// ── 기술 지표 계산 ──────────────────────────────────────────────────────────
function calcMA(candles, period) {
  if (candles.length < period) return NaN;
  const slice = candles.slice(-period);
  return slice.reduce((s, c) => s + c.close, 0) / period;
}

function calcIchimokuCloud(candles) {
  if (candles.length < 78) return null;
  const base = candles.slice(0, candles.length - 26);

  const h9  = Math.max(...base.slice(-9).map((c) => c.high));
  const l9  = Math.min(...base.slice(-9).map((c) => c.low));
  const h26 = Math.max(...base.slice(-26).map((c) => c.high));
  const l26 = Math.min(...base.slice(-26).map((c) => c.low));
  const h52 = Math.max(...base.slice(-52).map((c) => c.high));
  const l52 = Math.min(...base.slice(-52).map((c) => c.low));

  const spanA = ((h9 + l9) / 2 + (h26 + l26) / 2) / 2;
  const spanB = (h52 + l52) / 2;

  return { cloudTop: Math.max(spanA, spanB), cloudBottom: Math.min(spanA, spanB) };
}

// ── 종목 분석 ───────────────────────────────────────────────────────────────
async function analyzeMarket(market) {
  try {
    const isUpbit = market.exchange === 'upbit';
    const id = isUpbit ? market.market : market.symbol;

    const [candles1h, candles4h] = await Promise.all([
      isUpbit ? fetchUpbitCandles(id, '1h', 200) : fetchBithumbCandles(id, '1h', 200),
      isUpbit ? fetchUpbitCandles(id, '4h', 200) : fetchBithumbCandles(id, '4h', 200),
    ]);

    if (candles1h.length < 180 || candles4h.length < 78) return null;

    // 1시간봉 MA
    const ma50_1h  = calcMA(candles1h, 50);
    const ma110_1h = calcMA(candles1h, 110);
    const ma180_1h = calcMA(candles1h, 180);

    if (isNaN(ma50_1h) || isNaN(ma110_1h) || isNaN(ma180_1h)) return null;
    if (!(ma50_1h > ma110_1h && ma110_1h > ma180_1h)) return null;

    // 4시간봉 MA
    const ma50_4h  = calcMA(candles4h, 50);
    const ma110_4h = calcMA(candles4h, 110);
    const ma180_4h = calcMA(candles4h, 180);

    if (isNaN(ma50_4h) || isNaN(ma110_4h) || isNaN(ma180_4h)) return null;
    if (!(ma50_4h > ma110_4h && ma110_4h > ma180_4h)) return null;

    // 4시간봉 일목구름
    const cloud = calcIchimokuCloud(candles4h);
    if (!cloud) return null;

    const currentPrice = candles1h[candles1h.length - 1].close;
    if (currentPrice <= cloud.cloudTop) return null;

    return {
      symbol:        market.symbol,
      market:        market.market,
      exchange:      market.exchange,
      currentPrice,
      volume:        market.volume,
      ma50_1h,
      ma110_1h,
      ma180_1h,
      ma50_4h,
      ma110_4h,
      ma180_4h,
      cloudTop_4h:    cloud.cloudTop,
      cloudBottom_4h: cloud.cloudBottom,
    };
  } catch {
    return null;
  }
}

// ── 스캔 실행 ───────────────────────────────────────────────────────────────
async function performScan() {
  const markets = await getMarkets();
  const limit = createConcurrencyLimiter(5);

  const results = (
    await Promise.all(markets.map((m) => limit(() => analyzeMarket(m))))
  ).filter(Boolean);

  // 1H 정배열 강도(MA50-MA180 괴리율) 내림차순 정렬
  results.sort((a, b) => {
    const sa = (a.ma50_1h - a.ma180_1h) / a.ma180_1h;
    const sb = (b.ma50_1h - b.ma180_1h) / b.ma180_1h;
    return sb - sa;
  });

  return {
    items:        results,
    scannedCount: markets.length,
    matchedCount: results.length,
    scannedAt:    new Date().toISOString(),
  };
}

// ── Route ───────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // 캐시 유효 시 즉시 반환
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return res.json({ ...cache, fromCache: true });
  }

  // 중복 실행 방지
  if (isRunning) {
    return res.status(202).json({ isAnalyzing: true, items: [], scannedCount: 0, matchedCount: 0, scannedAt: new Date().toISOString() });
  }

  isRunning = true;
  try {
    const result = await performScan();
    cache = result;
    cacheTimestamp = Date.now();
    return res.json(result);
  } catch (err) {
    console.error('[ma-trend] 스캔 오류:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    isRunning = false;
  }
});

module.exports = router;
