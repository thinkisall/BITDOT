// server/routes/ma-squeeze.js
// 조건1: 일봉 OR 4h 구름대 위 (일목균형표)
// 조건2: 1h AND 4h 모두 구름대 위 + MA 정배열 (MA50 > MA110 > MA180)
// 정렬: 24h 거래대금 내림차순

const express = require('express');
const router = express.Router();

// ── 캐시 (5분 TTL) ─────────────────────────────────────────────────────────
let cache = null;
const CACHE_TTL = 3 * 60 * 1000;
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

const apiLimit      = createConcurrencyLimiter(5);
const upbitApiLimit = createConcurrencyLimiter(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

// ── 업비트 캔들 (429 재시도) ────────────────────────────────────────────────
// interval: 'minutes/60' | 'minutes/240' | 'days'
async function fetchUpbitCandles(market, interval, count) {
  const url = `https://api.upbit.com/v1/candles/${interval}?market=${market}&count=${count}`;
  return upbitApiLimit(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let res;
        try {
          res = await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }
        if (res.status === 429) { await sleep(500 + attempt * 500); continue; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.reverse().map((c) => ({
          high:   c.high_price,
          low:    c.low_price,
          close:  c.trade_price,
          volume: c.candle_acc_trade_volume,
        }));
      } catch {
        if (attempt < 2) await sleep(300);
      }
    }
    return [];
  });
}

// ── 빗썸 캔들 ──────────────────────────────────────────────────────────────
// 빗썸 지원: 1h, 6h(4h 없음), 24h
// 4h → 6h, 1h → 1h, 1d → 24h 매핑
async function fetchBithumbCandles(symbol, interval, count) {
  const intervalMap = { '1h': '1h', '4h': '6h', '1d': '24h' };
  const btInterval = intervalMap[interval] ?? interval;
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/${btInterval}`;
  try {
    const data = await fetchJson(url);
    if (data.status !== '0000' || !Array.isArray(data.data)) return [];
    // format: [timestamp, open, close, high, low, volume]
    return data.data.slice(-count).map((c) => ({
      high:   parseFloat(c[3]),
      low:    parseFloat(c[4]),
      close:  parseFloat(c[2]),
      volume: parseFloat(c[5]),
    }));
  } catch {
    return [];
  }
}

// ── 바이비트 캔들 ──────────────────────────────────────────────────────────
// interval: '60' | '240' | 'D'
// format: [startTime, open, high, low, close, volume, turnover]
async function fetchBybitCandles(symbol, interval, count) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${interval}&limit=${count}`;
  try {
    const data = await apiLimit(() => fetchJson(url));
    if (data.retCode !== 0 || !data.result?.list) return [];
    return data.result.list.reverse().map((c) => ({
      high:   parseFloat(c[2]),
      low:    parseFloat(c[3]),
      close:  parseFloat(c[4]),
      volume: parseFloat(c[5]),
    }));
  } catch {
    return [];
  }
}

// ── 거래소·타임프레임별 캔들 통합 ──────────────────────────────────────────
function getCandles(market, timeframe) {
  // 일목구름 최소 78봉, MA180 최소 180봉 → 200봉 요청
  const count = 200;

  if (market.exchange === 'upbit') {
    const intervalMap = { '1h': 'minutes/60', '4h': 'minutes/240', '1d': 'days' };
    return fetchUpbitCandles(market.market, intervalMap[timeframe], count);
  }
  if (market.exchange === 'bithumb') {
    return fetchBithumbCandles(market.symbol, timeframe, count);
  }
  if (market.exchange === 'bybit') {
    const intervalMap = { '1h': '60', '4h': '240', '1d': 'D' };
    return fetchBybitCandles(market.symbol, intervalMap[timeframe], count);
  }
  return Promise.resolve([]);
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

  // 업비트 상위 300개
  const upbitFiltered = upbitMarketsRes.filter((m) => m.market.startsWith('KRW-'));
  const marketCodes = upbitFiltered.map((m) => m.market).join(',');
  const upbitTickers = await fetchJson(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);

  const upbitMarkets = upbitTickers
    .filter((t) => !MAJOR_COINS.has(t.market.replace('KRW-', '')))
    .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
    .map((t) => ({
      symbol:     t.market.replace('KRW-', ''),
      market:     t.market,
      volume:     t.acc_trade_price_24h,
      changeRate: parseFloat(t.signed_change_rate || '0') * 100,
      exchange:   'upbit',
    }));

  // 빗썸 상위 300개
  const bithumbMarkets = [];
  if (bithumbRes.status === '0000' && bithumbRes.data) {
    Object.entries(bithumbRes.data)
      .filter(([symbol]) => symbol !== 'date' && !MAJOR_COINS.has(symbol))
      .sort(([, a], [, b]) => Number(b.acc_trade_value_24H || 0) - Number(a.acc_trade_value_24H || 0))
      .forEach(([symbol, ticker]) => {
        bithumbMarkets.push({
          symbol,
          market:     symbol,
          volume:     Number(ticker.acc_trade_value_24H || 0),
          changeRate: parseFloat(ticker.fluctate_rate_24H || '0'),
          exchange:   'bithumb',
        });
      });
  }

  // 바이비트 상위 300개
  const bybitMarkets = [];
  if (bybitRes?.retCode === 0 && bybitRes.result?.list) {
    bybitRes.result.list
      .filter((t) => t.symbol.endsWith('USDT') && !MAJOR_COINS.has(t.symbol.replace('USDT', '')))
      .sort((a, b) => Number(b.turnover24h || 0) - Number(a.turnover24h || 0))
      .slice(0, 300)
      .forEach((t) => {
        bybitMarkets.push({
          symbol:     t.symbol,
          market:     t.symbol,
          volume:     Number(t.turnover24h || 0),
          changeRate: parseFloat(t.price24hPcnt || '0') * 100,
          exchange:   'bybit',
        });
      });
  }

  return [...upbitMarkets, ...bithumbMarkets, ...bybitMarkets];
}

// ── MA 계산 ─────────────────────────────────────────────────────────────────
function calcMA(candles, period) {
  if (candles.length < period) return NaN;
  return candles.slice(-period).reduce((s, c) => s + c.close, 0) / period;
}

// ── 박스권 탐지 ─────────────────────────────────────────────────────────────
function detectBox(candles) {
  if (candles.length < 20) return null;
  const recent = candles.slice(-20);
  const highs  = recent.map((c) => c.high).sort((a, b) => a - b);
  const lows   = recent.map((c) => c.low).sort((a, b) => a - b);
  const top    = highs[Math.floor(highs.length * 0.9)];
  const bottom = lows[Math.floor(lows.length * 0.1)];
  if (!top || !bottom || bottom === 0) return null;
  const range = ((top - bottom) / bottom) * 100;
  if (range > 25 || range < 1) return null;
  return { top, bottom, range };
}

// ── 거래량 급등 ─────────────────────────────────────────────────────────────
function checkVolumeSurge(candles) {
  if (candles.length < 20) return false;
  const avgVol  = candles.slice(-20, -1).reduce((s, c) => s + (c.volume || 0), 0) / 19;
  const lastVol = candles[candles.length - 1].volume || 0;
  return avgVol > 0 && lastVol / avgVol >= 3;
}

// ── 일목균형표 구름대 계산 ──────────────────────────────────────────────────
// 선행스팬A = (전환선9 + 기준선26) / 2  (26봉 선행)
// 선행스팬B = 52봉 고저 평균            (26봉 선행)
// 현재 구름 = 26봉 전 시점 기준 계산
// 최소 필요: 52 + 26 = 78봉
function calcIchimokuAboveCloud(candles) {
  const len = candles.length;
  if (len < 78) return false;

  // 26봉 전 인덱스 (구름대가 현재 위치에 표시되는 기준점)
  const ci = len - 27;
  if (ci < 51) return false;

  const hi = (s, e) => Math.max(...candles.slice(s, e + 1).map((c) => c.high));
  const lo = (s, e) => Math.min(...candles.slice(s, e + 1).map((c) => c.low));

  const tenkan = (hi(ci - 8,  ci) + lo(ci - 8,  ci)) / 2;
  const kijun  = (hi(ci - 25, ci) + lo(ci - 25, ci)) / 2;
  const spanA  = (tenkan + kijun) / 2;
  const spanB  = (hi(ci - 51, ci) + lo(ci - 51, ci)) / 2;

  const cloudTop = Math.max(spanA, spanB);
  const currentPrice = candles[len - 1].close;

  return currentPrice > cloudTop;
}

// ── 정배열 확인 (MA50 > MA110 > MA180) ─────────────────────────────────────
function isMABullish(candles) {
  const ma50  = calcMA(candles, 50);
  const ma110 = calcMA(candles, 110);
  const ma180 = calcMA(candles, 180);
  if (isNaN(ma50) || isNaN(ma110) || isNaN(ma180)) return false;
  return ma50 > ma110 && ma110 > ma180;
}

// ── 종목 분석 ───────────────────────────────────────────────────────────────
async function analyzeMarket(market) {
  try {
    // ── 1단계: 일봉 OR 4h 구름대 위 필터 ──
    const [candles1d, candles4h_step1] = await Promise.all([
      getCandles(market, '1d'),
      getCandles(market, '4h'),
    ]);

    const aboveCloud1d = calcIchimokuAboveCloud(candles1d);
    const aboveCloud4h = calcIchimokuAboveCloud(candles4h_step1);

    if (!aboveCloud1d && !aboveCloud4h) return null;

    // ── 2단계: 1h AND 4h 구름대 위 + 정배열 ──
    // 4h 캔들은 이미 있으므로 재활용, 1h만 추가 조회
    const candles1h = await getCandles(market, '1h');

    const aboveCloud1h = calcIchimokuAboveCloud(candles1h);
    if (!aboveCloud1h && !aboveCloud4h) return null;

    const maOk1h = isMABullish(candles1h);
    const maOk4h = isMABullish(candles4h_step1);
    if (!maOk1h && !maOk4h) return null;

    // 지표값 (1h 기준, 표시용)
    const currentPrice = candles1h[candles1h.length - 1].close;
    const ma50_1h  = calcMA(candles1h, 50);
    const ma110_1h = calcMA(candles1h, 110);
    const ma180_1h = calcMA(candles1h, 180);
    const ma50_4h  = calcMA(candles4h_step1, 50);
    const ma110_4h = calcMA(candles4h_step1, 110);
    const ma180_4h = calcMA(candles4h_step1, 180);

    // ── 박스권 분석 (1h 캔들 기준) ──
    const box = detectBox(candles1h);
    const volumeSurge = checkVolumeSurge(candles1h);
    let boxTop = null, boxBottom = null, boxRange = null;
    let isBreakout = false, positionInBox = null;
    let buyPrice = null, stopLoss = null, profitTarget = null;

    if (box) {
      boxTop    = box.top;
      boxBottom = box.bottom;
      boxRange  = box.range;
      isBreakout = currentPrice > box.top * 1.01;
      positionInBox = isBreakout
        ? 100
        : Math.min(100, Math.max(0, ((currentPrice - box.bottom) / (box.top - box.bottom)) * 100));
      buyPrice     = isBreakout ? currentPrice : box.top * 1.002;
      stopLoss     = isBreakout ? box.top * 0.97 : box.bottom * 0.97;
      profitTarget = isBreakout ? currentPrice * 1.05 : box.top * 1.05;
    }

    // ── 스코어 계산 ──
    let score = 0;
    if (aboveCloud1d) score++;
    if (aboveCloud4h) score++;
    if (aboveCloud1h) score++;
    if (maOk1h) score++;
    if (maOk4h) score++;
    if (box && positionInBox >= 80) score++;
    if (isBreakout) score += 2;
    if (volumeSurge) score++;

    return {
      symbol:      market.symbol,
      exchange:    market.exchange,
      currentPrice,
      volume:      market.volume,
      changeRate:  Math.round((market.changeRate || 0) * 100) / 100,
      aboveCloud1d,
      aboveCloud4h,
      aboveCloud1h,
      ma50_1h,
      ma110_1h,
      ma180_1h,
      ma50_4h,
      ma110_4h,
      ma180_4h,
      // 박스권
      hasBox:       !!box,
      boxTop,
      boxBottom,
      boxRange,
      isBreakout,
      positionInBox,
      buyPrice,
      stopLoss,
      profitTarget,
      volumeSurge,
      score,
    };
  } catch (err) {
    console.error(`[ma-squeeze] analyzeMarket 오류 (${market.exchange}:${market.symbol}):`, err.message);
    return null;
  }
}

// ── 스캔 실행 ───────────────────────────────────────────────────────────────
async function performScan() {
  const markets = await getMarkets();
  console.log(`[ma-squeeze] 스캔 시작: 총 ${markets.length}개 종목 (업비트 ${markets.filter(m=>m.exchange==='upbit').length} / 빗썸 ${markets.filter(m=>m.exchange==='bithumb').length} / Bybit ${markets.filter(m=>m.exchange==='bybit').length})`);
  const limit = createConcurrencyLimiter(5);

  const results = (
    await Promise.all(markets.map((m) => limit(() => analyzeMarket(m))))
  ).filter(Boolean);

  // score 내림차순 → 동점 시 거래대금 내림차순
  results.sort((a, b) => b.score - a.score || b.volume - a.volume);

  return {
    items:        results,
    scannedCount: markets.length,
    matchedCount: results.length,
    scannedAt:    new Date().toISOString(),
    countByExchange: {
      upbit:   results.filter((r) => r.exchange === 'upbit').length,
      bithumb: results.filter((r) => r.exchange === 'bithumb').length,
      bybit:   results.filter((r) => r.exchange === 'bybit').length,
    },
  };
}

// ── 백그라운드 스캔 ─────────────────────────────────────────────────────────
function triggerBackgroundScan() {
  if (isRunning) return;
  isRunning = true;
  performScan()
    .then((result) => {
      cache = result;
      console.log(`[ma-squeeze] 스캔 완료: ${result.matchedCount}개 (업비트 ${result.countByExchange.upbit} / 빗썸 ${result.countByExchange.bithumb} / Bybit ${result.countByExchange.bybit})`);
    })
    .catch((err) => console.error('[ma-squeeze] 스캔 오류:', err.message))
    .finally(() => { isRunning = false; });
}

triggerBackgroundScan();
setInterval(triggerBackgroundScan, CACHE_TTL);

// ── Route ───────────────────────────────────────────────────────────────────
router.get('/', (_req, res) => {
  if (cache) {
    return res.json({ ...cache, fromCache: true, isAnalyzing: isRunning });
  }
  return res.json({
    isAnalyzing: true,
    items: [],
    scannedCount: 0,
    matchedCount: 0,
    scannedAt: new Date().toISOString(),
    countByExchange: { upbit: 0, bithumb: 0, bybit: 0 },
  });
});

module.exports = router;
