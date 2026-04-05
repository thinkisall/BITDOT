// server/routes/ma-squeeze.js
// 5분봉 MA스퀴즈 스캐너
// 조건: 현재가 > MA50(5m) AND MA50·MA110·MA180(5m) 이 가깝게 수렴

const express = require('express');
const router = express.Router();

// ── 캐시 (5분 TTL) ─────────────────────────────────────────────────────────
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000;
let isRunning = false;

// MA 수렴 임계값 (세 선의 max-min / avg < SQUEEZE_THRESHOLD %)
const SQUEEZE_THRESHOLD = 3.0;

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

// ── 업비트 5분봉 캔들 ───────────────────────────────────────────────────────
async function fetchUpbitCandles5m(market, count = 200) {
  const url = `https://api.upbit.com/v1/candles/minutes/5?market=${market}&count=${count}`;
  const data = await apiLimit(() => fetchJson(url));
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c) => ({
    close: c.trade_price,
    volume: c.candle_acc_trade_price,
  }));
}

// ── 빗썸 5분봉 캔들 ────────────────────────────────────────────────────────
async function fetchBithumbCandles5m(symbol, count = 200) {
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/5m`;
  const data = await fetchJson(url);
  if (data.status !== '0000' || !Array.isArray(data.data)) return [];
  return data.data.slice(-count).map((c) => ({
    close: parseFloat(c[2]),
    volume: parseFloat(c[5]),
  }));
}

// ── 바이비트 5분봉 캔들 ────────────────────────────────────────────────────
async function fetchBybitCandles5m(symbol, count = 200) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=5&limit=${count}`;
  const data = await apiLimit(() => fetchJson(url));
  if (data.retCode !== 0 || !data.result?.list) return [];
  return data.result.list.reverse().map((c) => ({
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

// ── 마켓 목록 ───────────────────────────────────────────────────────────────
const MAJOR_COINS = new Set([
  'BTC','ETH','XRP','USDT','USDC','BNB','SOL','ADA','DOGE','TRX',
  'DOT','MATIC','AVAX','LINK','UNI','ATOM','LTC','BCH','ETC','XLM','NFT',
]);

async function getMarkets() {
  const [upbitMarketsRes, bithumbRes, bybitRes] = await Promise.all([
    fetchJson('https://api.upbit.com/v1/market/all'),
    fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW'),
    fetchJson('https://api.bybit.com/v5/market/tickers?category=spot').catch(() => null),
  ]);

  // ── 업비트 상위 300개 ──
  const upbitFiltered = upbitMarketsRes.filter((m) => m.market.startsWith('KRW-'));
  const marketCodes = upbitFiltered.map((m) => m.market).join(',');
  const upbitTickers = await fetchJson(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);

  const upbitMarkets = upbitTickers
    .filter((t) => !MAJOR_COINS.has(t.market.replace('KRW-', '')))
    .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
    .slice(0, 300)
    .map((t) => ({
      symbol: t.market.replace('KRW-', ''),
      market: t.market,
      volume: t.acc_trade_price_24h,
      changeRate: parseFloat(t.signed_change_rate || '0') * 100,
      exchange: 'upbit',
    }));

  // ── 빗썸 상위 300개 ──
  const bithumbMarkets = [];
  if (bithumbRes.status === '0000' && bithumbRes.data) {
    Object.entries(bithumbRes.data)
      .filter(([symbol]) => symbol !== 'date' && !MAJOR_COINS.has(symbol))
      .sort(([, a], [, b]) => Number(b.acc_trade_value_24H || 0) - Number(a.acc_trade_value_24H || 0))
      .slice(0, 300)
      .forEach(([symbol, ticker]) => {
        bithumbMarkets.push({
          symbol,
          market: symbol,
          volume: Number(ticker.acc_trade_value_24H || 0),
          changeRate: parseFloat(ticker.fluctate_rate_24H || '0'),
          exchange: 'bithumb',
        });
      });
  }

  // ── 바이비트 상위 300개 ──
  const bybitMarkets = [];
  if (bybitRes?.retCode === 0 && bybitRes.result?.list) {
    bybitRes.result.list
      .filter((t) => t.symbol.endsWith('USDT') && !MAJOR_COINS.has(t.symbol.replace('USDT', '')))
      .sort((a, b) => Number(b.turnover24h || 0) - Number(a.turnover24h || 0))
      .slice(0, 300)
      .forEach((t) => {
        bybitMarkets.push({
          symbol: t.symbol,
          market: t.symbol,
          volume: Number(t.turnover24h || 0),
          changeRate: parseFloat(t.price24hPcnt || '0') * 100,
          exchange: 'bybit',
        });
      });
  }

  return [...upbitMarkets, ...bithumbMarkets, ...bybitMarkets];
}

// ── 기술 지표 ───────────────────────────────────────────────────────────────
function calcMA(candles, period) {
  if (candles.length < period) return NaN;
  return candles.slice(-period).reduce((s, c) => s + c.close, 0) / period;
}

// ── 종목 분석 ───────────────────────────────────────────────────────────────
async function analyzeMarket(market) {
  try {
    const candles =
      market.exchange === 'upbit'
        ? await fetchUpbitCandles5m(market.market, 200)
        : market.exchange === 'bybit'
        ? await fetchBybitCandles5m(market.symbol, 200)
        : await fetchBithumbCandles5m(market.symbol, 200);

    if (candles.length < 180) return null;

    const ma50  = calcMA(candles, 50);
    const ma110 = calcMA(candles, 110);
    const ma180 = calcMA(candles, 180);

    if (isNaN(ma50) || isNaN(ma110) || isNaN(ma180)) return null;

    const currentPrice = candles[candles.length - 1].close;

    // 조건 1: 현재가 > MA50
    if (currentPrice <= ma50) return null;

    // 조건 2: MA50·MA110·MA180 수렴 (spread < SQUEEZE_THRESHOLD%)
    const maMax = Math.max(ma50, ma110, ma180);
    const maMin = Math.min(ma50, ma110, ma180);
    const maAvg = (ma50 + ma110 + ma180) / 3;
    const spreadPct = ((maMax - maMin) / maAvg) * 100;

    if (spreadPct > SQUEEZE_THRESHOLD) return null;

    // 24시간 거래대금 (마지막 288개 5분봉 = 24h)
    const vol24h = candles.slice(-Math.min(288, candles.length))
      .reduce((s, c) => s + (c.volume || 0), 0);

    return {
      symbol:       market.symbol,
      exchange:     market.exchange,
      currentPrice,
      ma50,
      ma110,
      ma180,
      spreadPct:    Math.round(spreadPct * 100) / 100,
      vol24h,
      changeRate:   Math.round((market.changeRate || 0) * 100) / 100,
      priceAboveMa50Pct: Math.round(((currentPrice - ma50) / ma50) * 10000) / 100,
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

  // 24시간 등락률 내림차순
  results.sort((a, b) => b.changeRate - a.changeRate);

  return {
    items:        results,
    scannedCount: markets.length,
    matchedCount: results.length,
    scannedAt:    new Date().toISOString(),
    threshold:    SQUEEZE_THRESHOLD,
    countByExchange: {
      upbit:   results.filter((r) => r.exchange === 'upbit').length,
      bithumb: results.filter((r) => r.exchange === 'bithumb').length,
      bybit:   results.filter((r) => r.exchange === 'bybit').length,
    },
  };
}

// ── Route ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  // 캐시 유효 시 즉시 반환
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return res.json({ ...cache, fromCache: true });
  }

  // 중복 실행 방지
  if (isRunning) {
    return res.status(202).json({
      isAnalyzing: true,
      items: [],
      scannedCount: 0,
      matchedCount: 0,
      scannedAt: new Date().toISOString(),
    });
  }

  isRunning = true;
  try {
    const result = await performScan();
    cache = result;
    cacheTimestamp = Date.now();
    return res.json(result);
  } catch (err) {
    console.error('[ma-squeeze] 스캔 오류:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    isRunning = false;
  }
});

module.exports = router;
