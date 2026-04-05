// server/routes/ma-reverse.js
// 5분봉 MA 역배열 스캐너
// 조건: MA50 < MA110 < MA180 (역배열) AND 현재가 > MA50

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
  const data = await fetchJson(url);
  if (data.retCode !== 0 || !data.result?.list) return [];
  // Bybit returns newest first, reverse to oldest-first
  return data.result.list.reverse().map((c) => ({
    close: parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

// ── 마켓 목록 ───────────────────────────────────────────────────────────────
const MAJOR_COINS = new Set([
  'BTC', 'ETH', 'XRP', 'USDT', 'USDC', 'BNB', 'SOL', 'ADA', 'DOGE', 'TRX',
  'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM',
]);

async function getMarkets() {
  const [bithumbRes, bybitRes] = await Promise.all([
    fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW').catch(() => null),
    fetchJson('https://api.bybit.com/v5/market/tickers?category=spot').catch(() => null),
  ]);

  const markets = [];

  // 빗썸 종목 — fluctate_rate_24H: 24시간 등락률(절댓값으로 변동성 계산)
  if (bithumbRes?.status === '0000' && bithumbRes.data) {
    const bithumbItems = Object.entries(bithumbRes.data)
      .filter(([symbol]) => symbol !== 'date' && !MAJOR_COINS.has(symbol))
      .map(([symbol, ticker]) => ({
        symbol,
        market: symbol,
        volatility: Math.abs(Number(ticker.fluctate_rate_24H || 0)),
        volume: Number(ticker.acc_trade_value_24H || 0),
        exchange: 'bithumb',
      }));
    markets.push(...bithumbItems);
  }

  // 바이비트 USDT 페어 종목 — price24hPcnt: 24시간 변동률
  if (bybitRes?.retCode === 0 && bybitRes.result?.list) {
    const bybitItems = bybitRes.result.list
      .filter((t) => {
        if (!t.symbol.endsWith('USDT')) return false;
        const coin = t.symbol.replace('USDT', '');
        return !MAJOR_COINS.has(coin);
      })
      .map((t) => ({
        symbol: t.symbol,
        market: t.symbol,
        volatility: Math.abs(Number(t.price24hPcnt || 0)) * 100,
        volume: Number(t.turnover24h || 0),
        exchange: 'bybit',
      }));
    markets.push(...bybitItems);
  }

  // 변동성 상위 300개 (같은 변동성이면 거래량 높은 순)
  return markets
    .sort((a, b) => b.volatility - a.volatility || b.volume - a.volume)
    .slice(0, 300);
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
      market.exchange === 'bithumb'
        ? await fetchBithumbCandles5m(market.symbol, 200)
        : await fetchBybitCandles5m(market.symbol, 200);

    if (candles.length < 180) return null;

    const ma50  = calcMA(candles, 50);
    const ma110 = calcMA(candles, 110);
    const ma180 = calcMA(candles, 180);

    if (isNaN(ma50) || isNaN(ma110) || isNaN(ma180)) return null;

    const currentPrice = candles[candles.length - 1].close;

    // 조건 1: 역배열 — MA50 < MA110 < MA180
    if (!(ma50 < ma110 && ma110 < ma180)) return null;

    // 조건 2: 현재가 > MA50
    if (currentPrice <= ma50) return null;

    // 역배열 강도 (MA180과 MA50의 차이 / MA50 * 100)
    const reversePct = Math.round(((ma180 - ma50) / ma50) * 10000) / 100;

    // MA50 위 얼마나?
    const priceAboveMa50Pct = Math.round(((currentPrice - ma50) / ma50) * 10000) / 100;

    // 24시간 거래대금 (마지막 288개 5분봉 = 24h)
    const vol24h = candles
      .slice(-Math.min(288, candles.length))
      .reduce((s, c) => s + (c.volume || 0), 0);

    return {
      symbol:            market.symbol,
      exchange:          market.exchange,
      currentPrice,
      ma50,
      ma110,
      ma180,
      reversePct,
      priceAboveMa50Pct,
      vol24h,
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

  // 거래량 내림차순
  results.sort((a, b) => b.vol24h - a.vol24h);

  return {
    items:        results,
    scannedCount: markets.length,
    matchedCount: results.length,
    scannedAt:    new Date().toISOString(),
  };
}

// ── Route ───────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return res.json({ ...cache, fromCache: true });
  }

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
    console.error('[ma-reverse] 스캔 오류:', err.message);
    return res.status(500).json({ error: err.message });
  } finally {
    isRunning = false;
  }
});

module.exports = router;
