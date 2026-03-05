// server/routes/box-breakout.js
// 박스권 돌파 신호 분석 - 업비트/빗썸 전종목

const express = require('express');
const router = express.Router();

// ── 캐시 (2분 TTL) ─────────────────────────────────────────────────────────
const cacheMap = new Map(); // timeframe → { data, timestamp }
const CACHE_TTL = 2 * 60 * 1000;
let isAnalyzing = false;
let progress = { current: 0, total: 0 };

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

// ── 업비트 캔들 ──────────────────────────────────────────────────────────────
async function fetchUpbitCandles(market, timeframe, count = 100) {
  const tfMap = {
    '1m': 'minutes/1', '5m': 'minutes/5', '15m': 'minutes/15',
    '30m': 'minutes/30', '1h': 'minutes/60', '4h': 'minutes/240', '1d': 'days',
  };
  const endpoint = tfMap[timeframe] || 'minutes/60';
  const url = `https://api.upbit.com/v1/candles/${endpoint}?market=${market}&count=${count}`;
  const data = await apiLimit(() => fetchJson(url));
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c) => ({
    time: c.timestamp,
    open: c.opening_price,
    high: c.high_price,
    low: c.low_price,
    close: c.trade_price,
    volume: c.candle_acc_trade_volume,
    quoteVolume: c.candle_acc_trade_price,
  }));
}

// ── 빗썸 캔들 ──────────────────────────────────────────────────────────────
async function fetchBithumbCandles(symbol, timeframe) {
  const tfMap = {
    '1m': '1m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '4h': '4h', '1d': '24h',
  };
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/${tfMap[timeframe] || '1h'}`;
  const data = await fetchJson(url);
  if (data.status !== '0000' || !Array.isArray(data.data)) return [];
  return data.data.slice(-200).map((c) => ({
    time: Number(c[0]),
    open: parseFloat(c[1]),
    close: parseFloat(c[2]),
    high: parseFloat(c[3]),
    low: parseFloat(c[4]),
    volume: parseFloat(c[5]),
    quoteVolume: parseFloat(c[5]) * parseFloat(c[2]),
  }));
}

// ── 마켓 목록 ───────────────────────────────────────────────────────────────
const MAJOR_COINS = new Set([
  'BTC','ETH','XRP','USDT','USDC','BNB','SOL','ADA','DOGE','TRX',
  'DOT','MATIC','AVAX','LINK','UNI','ATOM','LTC','BCH','ETC','XLM',
]);

async function getMarkets() {
  const bithumbRes = await fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW');

  if (bithumbRes.status !== '0000' || !bithumbRes.data) return [];

  return Object.entries(bithumbRes.data)
    .filter(([sym]) => sym !== 'date' && !MAJOR_COINS.has(sym))
    .map(([sym, t]) => ({
      symbol: sym + 'KRW',
      market: sym,
      exchange: 'bithumb',
      quoteVolume: Number(t.acc_trade_value_24H || 0),
    }))
    .sort((a, b) => b.quoteVolume - a.quoteVolume);
}

// ── 기술 분석 ───────────────────────────────────────────────────────────────
function detectBox(candles) {
  if (candles.length < 20) return null;
  const recent = candles.slice(-20);

  // 스파이크 캔들로 인한 상단 과대평가 방지: 퍼센타일 방식
  const highs  = recent.map((c) => c.high).sort((a, b) => a - b);
  const lows   = recent.map((c) => c.low).sort((a, b) => a - b);
  const top    = highs[Math.floor(highs.length * 0.9)];  // 상위 10% 제외
  const bottom = lows[Math.floor(lows.length * 0.1)];    // 하위 10% 제외

  if (!top || !bottom || bottom === 0) return null;
  const range = ((top - bottom) / bottom) * 100;
  if (range > 25 || range < 1) return null;
  return { top, bottom, range };
}

function calcMA(candles, period) {
  if (candles.length < period) return null;
  return candles.slice(-period).reduce((s, c) => s + c.close, 0) / period;
}

function calcIchimoku(candles) {
  // 선행스팬은 26기간 앞에 그려지므로, 현재 위치의 구름은 26기간 전 데이터로 계산
  if (candles.length < 78) return null; // 52 + 26
  const base = candles.slice(0, candles.length - 26); // 26기간 전까지의 데이터
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

function checkVolumeSurge(candles) {
  if (candles.length < 20) return false;
  const avgVol = candles.slice(-20, -1).reduce((s, c) => s + c.volume, 0) / 19;
  const lastVol = candles[candles.length - 1].volume;
  return avgVol > 0 && lastVol / avgVol >= 3;
}

function scoreSignal(signal, candles, ma50) {
  let score = 0;
  if (signal.positionInBox >= 80) score++;
  if (signal.isBreakout) score += 2;
  if (signal.volumeSurge) score++;
  const cloud = calcIchimoku(candles);
  if (cloud && signal.currentPrice > cloud.cloudTop) score++;
  const above50 = ma50 && signal.currentPrice > ma50;
  if (above50) score++;
  return score;
}

// ── 종목 분석 ───────────────────────────────────────────────────────────────
async function analyzeSymbol(market, timeframe) {
  try {
    const candles = market.exchange === 'upbit'
      ? await fetchUpbitCandles(market.market, timeframe, 100)
      : await fetchBithumbCandles(market.market, timeframe);

    if (candles.length < 25) return null;

    const box = detectBox(candles);
    if (!box) return null;

    const currentPrice = candles[candles.length - 1].close;
    const quoteVolume = candles.slice(-24).reduce((s, c) => s + (c.quoteVolume || 0), 0);

    const isBreakout = currentPrice > box.top * 1.01;
    const positionInBox = isBreakout
      ? 100
      : Math.min(100, Math.max(0, ((currentPrice - box.bottom) / (box.top - box.bottom)) * 100));

    // 매수/손절/목표 계산
    const buyPrice = isBreakout ? currentPrice : box.top * 1.002;
    const stopLoss = isBreakout ? box.top * 0.97 : box.bottom * 0.97;
    const profitTarget = isBreakout ? currentPrice * 1.05 : box.top * 1.05;
    const profitPercent = ((profitTarget - buyPrice) / buyPrice) * 100;
    const riskPercent = ((buyPrice - stopLoss) / buyPrice) * 100;

    const volumeSurge = checkVolumeSurge(candles);
    const ma50 = calcMA(candles, 50);
    const buySignal5m = ma50 ? currentPrice > ma50 : false;

    // 일목균형표 점수
    const cloud = calcIchimoku(candles);
    const ichimokuAboveCloudCount = cloud && currentPrice > cloud.cloudTop ? 1 : 0;

    const signal = {
      symbol: market.symbol,
      exchange: market.exchange,
      currentPrice,
      quoteVolume,
      isBreakout,
      positionInBox,
      boxTop: box.top,
      boxBottom: box.bottom,
      resistance: box.top,
      support: box.bottom,
      boxHeight: box.range,
      consolidationPeriods: 20,
      buyPrice,
      stopLoss,
      profitTarget,
      targetPrice: profitTarget,
      profitPercent,
      riskPercent,
      volumeSurge,
      buySignal5m,
      ichimokuAboveCloudCount,
      btcDecouplingScore: 50,
      analyzedAt: Date.now(),
    };

    const totalScore = scoreSignal(signal, candles, ma50);
    signal.scoreDetails = {
      totalScore,
      volumeScore: volumeSurge ? 1 : 0,
      positionScore: positionInBox >= 80 ? 1 : 0,
      ichimokuScore: ichimokuAboveCloudCount,
      maScore: buySignal5m ? 1 : 0,
    };
    signal.signalGrade = totalScore >= 4 ? 'A' : totalScore >= 2 ? 'B' : 'C';

    return signal;
  } catch {
    return null;
  }
}

// ── 분석 실행 ───────────────────────────────────────────────────────────────
async function performAnalysis(timeframe) {
  isAnalyzing = true;
  try {
    const markets = await getMarkets();
    progress = { current: 0, total: markets.length };

    const limit = createConcurrencyLimiter(5);
    const results = (
      await Promise.all(
        markets.map((m) =>
          limit(async () => {
            const r = await analyzeSymbol(m, timeframe);
            progress.current++;
            return r;
          })
        )
      )
    ).filter(Boolean);

    results.sort((a, b) => (b.scoreDetails?.totalScore || 0) - (a.scoreDetails?.totalScore || 0));

    const cacheEntry = { signals: results, lastUpdated: Date.now() };
    cacheMap.set(timeframe, { data: cacheEntry, timestamp: Date.now() });
    return cacheEntry;
  } finally {
    isAnalyzing = false;
    progress = { current: 0, total: 0 };
  }
}

// ── 단일 종목 멀티 타임프레임 분석 ─────────────────────────────────────────
router.get('/symbol/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase(); // e.g. 'ALGO'
  const TIMEFRAMES = ['5m', '30m', '1h', '4h', '1d'];
  const market = { symbol: symbol + 'KRW', market: symbol, exchange: 'bithumb', quoteVolume: 0 };

  try {
    const results = await Promise.all(
      TIMEFRAMES.map((tf) => analyzeSymbol(market, tf))
    );

    const timeframes = {};
    TIMEFRAMES.forEach((tf, i) => {
      const r = results[i];
      if (!r) {
        timeframes[tf] = { hasBox: false };
      } else {
        let position;
        if (r.isBreakout) position = 'breakout';
        else if (r.positionInBox >= 80) position = 'top';
        else if (r.positionInBox >= 50) position = 'middle';
        else if (r.positionInBox >= 20) position = 'bottom';
        else position = 'below';
        timeframes[tf] = {
          hasBox: true,
          top: r.resistance,
          bottom: r.support,
          position,
          positionPercent: r.positionInBox,
        };
      }
    });

    return res.json({ symbol, exchange: 'bithumb', timeframes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Route ──────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const timeframe = req.query.timeframe || '1h';

  const cached = cacheMap.get(timeframe);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return res.json({ ...cached.data, isAnalyzing: false, progress });
  }

  if (isAnalyzing) {
    if (cached) {
      return res.json({ ...cached.data, isAnalyzing: true, progress });
    }
    return res.json({ signals: [], lastUpdated: 0, isAnalyzing: true, progress });
  }

  // 백그라운드 분석 시작
  performAnalysis(timeframe).catch((err) => {
    console.error('[BoxBreakout] 분석 실패:', err.message);
  });

  if (cached) {
    return res.json({ ...cached.data, isAnalyzing: true, progress });
  }

  return res.json({ signals: [], lastUpdated: 0, isAnalyzing: true, progress });
});

module.exports = router;
