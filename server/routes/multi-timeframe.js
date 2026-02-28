// server/routes/multi-timeframe.js
// Python 의존성 없이 순수 Node.js로 멀티 타임프레임 분석
// 업비트 + 빗썸 전종목 대상으로 박스권 / MA / 일목구름 / 기준봉 분석

const express = require('express');
const router = express.Router();

// ── 캐시 (10분 TTL) ────────────────────────────────────────────────────────
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;
let isAnalyzing = false;

// ── 동시 요청 제한 헬퍼 ────────────────────────────────────────────────────
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

// ── fetch 헬퍼 (타임아웃 포함) ────────────────────────────────────────────
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

// ── 업비트 캔들 fetch ─────────────────────────────────────────────────────
async function fetchUpbitCandles(market, timeframe, count = 200) {
  const tfMap = { '5m': 'minutes/5', '30m': 'minutes/30', '1h': 'minutes/60', '4h': 'minutes/240', '1d': 'days' };
  const endpoint = tfMap[timeframe] || 'minutes/60';
  const url = `https://api.upbit.com/v1/candles/${endpoint}?market=${market}&count=${count}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c) => ({
    timestamp: c.timestamp,
    open:   c.opening_price,
    high:   c.high_price,
    low:    c.low_price,
    close:  c.trade_price,
    volume: c.candle_acc_trade_volume,
  }));
}

// ── 빗썸 캔들 fetch ───────────────────────────────────────────────────────
async function fetchBithumbCandles(symbol, timeframe) {
  const tfMap = { '5m': '5m', '30m': '30m', '1h': '1h', '4h': '4h', '1d': '24h' };
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/${tfMap[timeframe] || '1h'}`;
  const data = await fetchJson(url);
  if (data.status !== '0000' || !data.data) return [];
  return data.data.slice(-200).map((c) => ({
    timestamp: Number(c[0]),
    open:   parseFloat(c[1]),
    close:  parseFloat(c[2]),
    high:   parseFloat(c[3]),
    low:    parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

// ── 마켓 목록 fetch ───────────────────────────────────────────────────────
const MAJOR_COINS = new Set([
  'BTC','ETH','XRP','USDT','USDC','BNB','SOL','ADA','DOGE','TRX',
  'DOT','MATIC','AVAX','LINK','UNI','ATOM','LTC','BCH','ETC','XLM','NFT',
]);

async function fetchUpbitMarkets() {
  const allRes = await fetchJson('https://api.upbit.com/v1/market/all');
  const krw = allRes.filter((m) => m.market.startsWith('KRW-'));
  const codes = krw.map((m) => m.market).join(',');
  const tickers = await fetchJson(`https://api.upbit.com/v1/ticker?markets=${codes}`);
  return tickers
    .filter((t) => !MAJOR_COINS.has(t.market.replace('KRW-', '')))
    .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
    .map((t) => ({
      symbol: t.market.replace('KRW-', ''),
      market: t.market,
      volume: t.acc_trade_price_24h,
      exchange: 'upbit',
    }));
}

async function fetchBithumbMarkets() {
  const data = await fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW');
  if (data.status !== '0000' || !data.data) return [];
  return Object.entries(data.data)
    .filter(([sym]) => sym !== 'date' && !MAJOR_COINS.has(sym))
    .map(([sym, t]) => ({
      symbol: sym,
      market: sym,
      volume: Number(t.acc_trade_value_24H || 0),
      exchange: 'bithumb',
    }))
    .sort((a, b) => b.volume - a.volume);
}

// ── 기술적 분석 함수들 ─────────────────────────────────────────────────────

function detectBoxRange(candles) {
  if (candles.length < 20) return null;
  const recent = candles.slice(-20);
  const top    = Math.max(...recent.map((c) => c.high));
  const bottom = Math.min(...recent.map((c) => c.low));
  if (bottom === 0) return null;
  const boxRange = ((top - bottom) / bottom) * 100;
  if (boxRange > 30) return null;

  const currentPrice = candles[candles.length - 1].close;
  let position;
  if      (currentPrice > top * 1.03)       position = 'breakout';
  else if (currentPrice < bottom * 0.97)    position = 'below';
  else {
    const pct = ((currentPrice - bottom) / (top - bottom)) * 100;
    if      (pct >= 66) position = 'top';
    else if (pct >= 33) position = 'middle';
    else                position = 'bottom';
  }

  return {
    hasBox: true,
    top,
    bottom,
    position,
    positionPercent: top !== bottom ? ((currentPrice - bottom) / (top - bottom)) * 100 : 50,
  };
}

function calculateMA(candles, period) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  return slice.reduce((s, c) => s + c.close, 0) / period;
}

function calculateIchimokuCloud(candles) {
  if (candles.length < 52) return null;
  const last9  = candles.slice(-9);
  const last26 = candles.slice(-26);
  const last52 = candles.slice(-52);
  const conversion = (Math.max(...last9.map((c) => c.high))  + Math.min(...last9.map((c) => c.low)))  / 2;
  const base       = (Math.max(...last26.map((c) => c.high)) + Math.min(...last26.map((c) => c.low))) / 2;
  const spanA      = (conversion + base) / 2;
  const spanB      = (Math.max(...last52.map((c) => c.high)) + Math.min(...last52.map((c) => c.low))) / 2;
  return { spanA, spanB, cloudTop: Math.max(spanA, spanB), cloudBottom: Math.min(spanA, spanB) };
}

function checkCloudStatus(price, cloud) {
  if (!cloud) return null;
  if (price > cloud.cloudTop)           return 'above';
  if (price >= cloud.cloudBottom * 0.98) return 'near';
  return null;
}

function detectTriggerCandle(candles) {
  if (candles.length < 20) return false;
  const recent7 = candles.slice(-7);
  const prev13  = candles.slice(-20, -7);
  const avgVol  = prev13.reduce((s, c) => s + c.volume, 0) / prev13.length;
  return recent7.some((c) => {
    const bodyPct  = Math.abs(c.close - c.open) / c.open * 100;
    const volRatio = avgVol > 0 ? c.volume / avgVol : 0;
    return bodyPct >= 7 && volRatio >= 10 && c.close > c.open;
  });
}

function checkPullbackSignal(price, ma110, ma50, ma180) {
  if (ma110 && Math.abs(price - ma110) / ma110 <= 0.02) return 'TREND_110';
  if (ma50  && Math.abs(price - ma50)  / ma50  <= 0.02) return 'SUPPORT_50';
  if (ma180 && Math.abs(price - ma180) / ma180 <= 0.02) return 'SUPPORT_180';
  return null;
}

function calculateMASlope(candles, period, lookback = 5) {
  if (candles.length < period + lookback) return null;
  const slopes = [];
  for (let i = 0; i < lookback; i++) {
    const cur  = calculateMA(candles.slice(0, candles.length - i),     period);
    const prev = calculateMA(candles.slice(0, candles.length - i - 1), period);
    if (cur && prev && prev > 0) slopes.push(((cur - prev) / prev) * 100);
  }
  return slopes.length > 0 ? slopes.reduce((a, b) => a + b, 0) / slopes.length : null;
}

function checkSwingRecovery(candles, price, ma50) {
  if (!ma50 || price <= ma50) return null;
  const slopeOld    = calculateMASlope(candles, 50, 10);
  const slopeRecent = calculateMASlope(candles, 50, 5);
  if (slopeOld && slopeRecent && slopeOld < -0.5 && slopeRecent > -0.3) {
    return { slopeOld: +slopeOld.toFixed(2), slopeRecent: +slopeRecent.toFixed(2), ma50Current: ma50 };
  }
  return null;
}

// ── 단일 심볼 분석 ─────────────────────────────────────────────────────────
async function analyzeSymbol(item) {
  try {
    const timeframes = ['5m', '30m', '1h', '4h', '1d'];
    const candlesMap = {};

    await Promise.all(
      timeframes.map(async (tf) => {
        try {
          candlesMap[tf] = item.exchange === 'upbit'
            ? await fetchUpbitCandles(item.market, tf, 200)
            : await fetchBithumbCandles(item.symbol, tf);
        } catch {
          candlesMap[tf] = [];
        }
      })
    );

    const candles1h = candlesMap['1h'];
    if (!candles1h || candles1h.length < 10) return null;

    const currentPrice = candles1h[candles1h.length - 1].close;
    const volume       = candles1h[candles1h.length - 1].volume;

    // 박스권 탐지 (5개 타임프레임)
    let boxCount = 0;
    const tfResults = {};
    for (const tf of timeframes) {
      const box = detectBoxRange(candlesMap[tf] || []);
      if (box) { tfResults[tf] = box; boxCount++; }
      else      { tfResults[tf] = { hasBox: false }; }
    }
    if (boxCount === 0) return null;

    // MA 계산
    const ma50_1h  = calculateMA(candles1h, 50);
    const ma50_5m  = calculateMA(candlesMap['5m'] || [], 50);
    const candles1d = candlesMap['1d'] || [];
    const ma50_1d  = calculateMA(candles1d, 50);
    const ma110    = calculateMA(candles1d, 110);
    const ma180    = calculateMA(candles1d, 180);

    // 일목구름
    const clouds = {
      '5m':  calculateIchimokuCloud(candlesMap['5m']  || []),
      '30m': calculateIchimokuCloud(candlesMap['30m'] || []),
      '1h':  calculateIchimokuCloud(candles1h),
      '4h':  calculateIchimokuCloud(candlesMap['4h']  || []),
    };

    // 기준봉 & 눌림목
    const isTriggered   = candles1d.length > 0 ? detectTriggerCandle(candles1d) : false;
    const pullback      = isTriggered ? checkPullbackSignal(currentPrice, ma110, ma50_1d, ma180) : null;
    const swingRecovery = checkSwingRecovery(candles1h, currentPrice, ma50_1h);

    const result = {
      symbol:        item.symbol,
      exchange:      item.exchange,
      volume,
      currentPrice,
      timeframes:    tfResults,
      boxCount,
      allTimeframes: boxCount === 5,
      above1hMA50:   ma50_1h ? currentPrice > ma50_1h : false,
      above5mMA50:   ma50_5m ? currentPrice > ma50_5m : false,
    };

    const cs = {
      cloudStatus5m:  checkCloudStatus(currentPrice, clouds['5m']),
      cloudStatus30m: checkCloudStatus(currentPrice, clouds['30m']),
      cloudStatus:    checkCloudStatus(currentPrice, clouds['1h']),
      cloudStatus4h:  checkCloudStatus(currentPrice, clouds['4h']),
    };
    Object.entries(cs).forEach(([k, v]) => { if (v) result[k] = v; });
    if (isTriggered)  result.isTriggered    = true;
    if (pullback)     result.pullbackSignal = pullback;
    if (swingRecovery) result.swingRecovery = swingRecovery;

    return result;
  } catch {
    return null;
  }
}

// ── 메인 분석 루프 ─────────────────────────────────────────────────────────
async function performAnalysis() {
  try {
    console.log('[Multi-TF] 마켓 목록 로드 중...');
    const [upbitMarkets, bithumbMarkets] = await Promise.all([
      fetchUpbitMarkets(),
      fetchBithumbMarkets(),
    ]);

    const upbitSymbols = new Set(upbitMarkets.map((m) => m.symbol));
    const bithumbOnly  = bithumbMarkets.filter((m) => !upbitSymbols.has(m.symbol));
    const allMarkets   = [...upbitMarkets, ...bithumbOnly].slice(0, 300);

    console.log(`[Multi-TF] 분석 시작: ${allMarkets.length}종목`);

    const limit = createConcurrencyLimiter(5);
    let done = 0;

    const results = (
      await Promise.all(
        allMarkets.map((item) =>
          limit(async () => {
            const r = await analyzeSymbol(item);
            done++;
            if (done % 50 === 0) console.log(`[Multi-TF] 진행: ${done}/${allMarkets.length}`);
            return r;
          })
        )
      )
    ).filter(Boolean);

    results.sort((a, b) => b.volume - a.volume);

    cache = { results, totalAnalyzed: allMarkets.length, foundCount: results.length, lastUpdated: Date.now() };
    cacheTimestamp = Date.now();
    isAnalyzing = false;

    console.log(`[Multi-TF] 완료: ${results.length}개 결과`);
  } catch (err) {
    console.error('[Multi-TF] 분석 실패:', err.message);
    isAnalyzing = false;
    throw err;
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────
router.post('/', async (_req, res) => {
  try {
    const now = Date.now();

    if (cache && now - cacheTimestamp < CACHE_TTL) {
      return res.json(cache);
    }

    if (!isAnalyzing) {
      isAnalyzing = true;
      performAnalysis().catch((err) => {
        console.error('[Multi-TF] 백그라운드 분석 에러:', err.message);
        isAnalyzing = false;
      });
    }

    if (cache) {
      const cacheAge = Math.floor((now - cacheTimestamp) / 1000);
      return res.json({ ...cache, cached: true, stale: true, cacheAge, analyzing: true });
    }

    return res.json({
      results: [], totalAnalyzed: 0, foundCount: 0, lastUpdated: 0,
      cached: false, analyzing: true,
      message: '최초 분석 중입니다. 1~2분 후 다시 요청해주세요.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message, results: [], totalAnalyzed: 0, foundCount: 0 });
  }
});

// 서버 시작 시 초기 분석
console.log('[Multi-TF] 서버 초기화 - 첫 분석 시작...');
performAnalysis().catch((err) => {
  console.error('[Multi-TF] 초기 분석 실패:', err.message);
  isAnalyzing = false;
});

// 10분마다 자동 갱신
setInterval(() => {
  if (!isAnalyzing) {
    console.log('[Multi-TF] 정기 갱신 시작...');
    isAnalyzing = true;
    performAnalysis().catch((err) => {
      console.error('[Multi-TF] 정기 갱신 실패:', err.message);
      isAnalyzing = false;
    });
  }
}, CACHE_TTL);

module.exports = router;
