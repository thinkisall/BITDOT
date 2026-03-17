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

// ── 업비트 전용 API rate limiter (동시 요청 5개 제한) ─────────────────────
// 5심볼 × 5타임프레임 동시 fetch = 25개 동시 요청 → 업비트 rate limit 초과 방지
const upbitApiLimit = createConcurrencyLimiter(5);

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

// ── 업비트 캔들 fetch (rate limiter 적용) ────────────────────────────────
async function fetchUpbitCandles(market, timeframe, count = 200) {
  const tfMap = { '5m': 'minutes/5', '30m': 'minutes/30', '1h': 'minutes/60', '4h': 'minutes/240', '1d': 'days' };
  const endpoint = tfMap[timeframe] || 'minutes/60';
  const url = `https://api.upbit.com/v1/candles/${endpoint}?market=${market}&count=${count}`;
  const data = await upbitApiLimit(() => fetchJson(url));
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
      changeRate: parseFloat(t.fluctate_rate_24H || '0'),
      exchange: 'bithumb',
    }));
}

// ── 기술적 분석 함수들 ─────────────────────────────────────────────────────

// 가격 배열을 tolerance 범위로 클러스터링 → 많이 겹치는 구간 추출
function clusterPriceLevels(prices, tolerance = 0.015) {
  const sorted = [...prices].sort((a, b) => a - b);
  const clusters = [];

  for (const price of sorted) {
    let merged = false;
    for (const cluster of clusters) {
      if (Math.abs(price - cluster.center) / cluster.center <= tolerance) {
        cluster.prices.push(price);
        cluster.center = cluster.prices.reduce((s, p) => s + p, 0) / cluster.prices.length;
        merged = true;
        break;
      }
    }
    if (!merged) clusters.push({ center: price, prices: [price] });
  }

  return clusters
    .map(c => ({ center: c.center, count: c.prices.length }))
    .sort((a, b) => b.count - a.count);
}

// 클러스터 목록에서 박스 상단/하단 한 쌍 선택
// - 최소 스프레드 2%, 최대 30%
// - 상위 터치 클러스터들 중 (center 기준 높은 쪽 / 낮은 쪽) 조합 중 터치 합산 최대인 쌍
function pickBoxLevels(clusters, minSpread = 0.02, maxSpread = 0.30) {
  // count >= 2 이거나 전체 후보가 부족하면 count 1도 포함
  let candidates = clusters.filter(c => c.count >= 2);
  if (candidates.length < 2) candidates = clusters;
  if (candidates.length < 2) return null;

  // 상위 10개 후보만 검사
  const pool = candidates.slice(0, 10);

  let best = null;
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const hi = pool[i].center > pool[j].center ? pool[i] : pool[j];
      const lo = pool[i].center > pool[j].center ? pool[j] : pool[i];
      const spread = (hi.center - lo.center) / lo.center;
      if (spread < minSpread || spread > maxSpread) continue;
      const score = hi.count + lo.count;
      if (!best || score > best.score) best = { top: hi.center, bottom: lo.center, score };
    }
  }
  return best;
}

// 장대양봉 탐지: 몸통 비율 >= threshold (기본 3%)
function findBigBullishCandles(candles, threshold = 0.03) {
  return candles.filter(c => {
    const body = c.close - c.open;
    return body > 0 && body / c.open >= threshold;
  });
}

function detectBoxRange(candles) {
  if (candles.length < 20) return null;

  const lookback = Math.min(150, candles.length);
  const recent   = candles.slice(-lookback);

  // 1. 최근 50캔들에서 장대양봉 탐색
  const searchWindow = recent.slice(-50);
  const bigCandles   = findBigBullishCandles(searchWindow);

  let priceSamples;

  if (bigCandles.length > 0) {
    // 가장 최근 장대양봉의 위치를 recent 기준으로 찾아서, 그 이전(왼쪽) 캔들의 시/종가 수집
    const latestBig  = bigCandles[bigCandles.length - 1];
    const bigIdx     = recent.findLastIndex(c => c.time === latestBig.time);
    const leftCandles = bigIdx > 0 ? recent.slice(0, bigIdx + 1) : recent;
    priceSamples = leftCandles.flatMap(c => [c.open, c.close]);
  } else {
    // 장대 없음: 전체 구간 시/종가로 횡보 구간 탐색
    priceSamples = recent.flatMap(c => [c.open, c.close]);
  }

  if (priceSamples.length < 4) return null;

  const clusters = clusterPriceLevels(priceSamples);
  const levels   = pickBoxLevels(clusters);
  if (!levels) return null;

  const { top, bottom } = levels;
  if (bottom === 0) return null;

  const currentPrice = candles[candles.length - 1].close;
  let position;
  if      (currentPrice > top * 1.03)    position = 'breakout';
  else if (currentPrice < bottom * 0.97) position = 'below';
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
  // 선행스팬은 26기간 앞에 그려지므로, 현재 위치의 구름은 26기간 전 데이터로 계산
  if (candles.length < 78) return null; // 52 + 26
  const base = candles.slice(0, candles.length - 26); // 26기간 전까지의 데이터
  const conversion = (Math.max(...base.slice(-9).map((c) => c.high))  + Math.min(...base.slice(-9).map((c) => c.low)))  / 2;
  const kijun      = (Math.max(...base.slice(-26).map((c) => c.high)) + Math.min(...base.slice(-26).map((c) => c.low))) / 2;
  const spanA      = (conversion + kijun) / 2;
  const spanB      = (Math.max(...base.slice(-52).map((c) => c.high)) + Math.min(...base.slice(-52).map((c) => c.low))) / 2;
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

// ── VWMA (거래량 가중 이동평균) ────────────────────────────────────────────
function calculateVWMA(candles, period) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  const sumPV = slice.reduce((s, c) => s + c.close * c.volume, 0);
  const sumV  = slice.reduce((s, c) => s + c.volume, 0);
  return sumV > 0 ? sumPV / sumV : null;
}

function calculateVWMASlope(candles, period, lookback = 5) {
  if (candles.length < period + lookback) return null;
  const slopes = [];
  for (let i = 0; i < lookback; i++) {
    const cur  = calculateVWMA(candles.slice(0, candles.length - i),     period);
    const prev = calculateVWMA(candles.slice(0, candles.length - i - 1), period);
    if (cur && prev && prev > 0) slopes.push(((cur - prev) / prev) * 100);
  }
  return slopes.length > 0 ? slopes.reduce((a, b) => a + b, 0) / slopes.length : null;
}

// ── MA 라이딩 판별 ──────────────────────────────────────────────────────────
// 현재가가 MA 바로 위(0~maxAbovePct%)에 있고 MA 기울기가 양수이면 "MA를 따라 올라가는 중"
function checkMARiding(price, maValue, slope, maxAbovePct = 0.05) {
  if (!maValue || slope === null || slope === undefined) return false;
  const distPct = (price - maValue) / maValue;
  return distPct >= 0 && distPct <= maxAbovePct && slope > 0;
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

    // MA 계산
    const ma50_1h    = calculateMA(candles1h, 50);
    const ma110_1h   = calculateMA(candles1h, 110);
    const ma180_1h   = calculateMA(candles1h, 180);
    const vwma110_1h = calculateVWMA(candles1h, 110);
    const ma50_5m    = calculateMA(candlesMap['5m'] || [], 50);
    const candles1d  = candlesMap['1d'] || [];
    const ma50_1d    = calculateMA(candles1d, 50);
    const ma110      = calculateMA(candles1d, 110);
    const ma180      = calculateMA(candles1d, 180);
    const vwma110    = calculateVWMA(candles1d, 110);

    // MA 기울기 (라이딩 판별용)
    const slope5mMA50    = calculateMASlope(candlesMap['5m'] || [], 50, 5);
    const slope1hMA50    = calculateMASlope(candles1h, 50, 5);
    const slope1hMA110   = calculateMASlope(candles1h, 110, 5);
    const slope1hMA180   = calculateMASlope(candles1h, 180, 5);
    const slope1hVWMA110 = calculateVWMASlope(candles1h, 110, 5);
    const slopeMA110     = calculateMASlope(candles1d, 110, 5);
    const slopeVWMA110   = calculateVWMASlope(candles1d, 110, 5);
    const slopeMA180     = calculateMASlope(candles1d, 180, 5);

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
      changeRate:    item.changeRate ?? 0,
      timeframes:    tfResults,
      boxCount,
      allTimeframes: boxCount === 5,
      above1hMA50:   ma50_1h ? currentPrice > ma50_1h : false,
      above5mMA50:   ma50_5m ? currentPrice > ma50_5m : false,
      // MA 현재값 (5m)
      ...(ma50_5m    ? { ma50_5m }    : {}),
      // MA 현재값 (1h)
      ...(ma50_1h    ? { ma50_1h }    : {}),
      ...(ma110_1h   ? { ma110_1h }   : {}),
      ...(ma180_1h   ? { ma180_1h }   : {}),
      ...(vwma110_1h ? { vwma110_1h } : {}),
      // MA 현재값 (1d)
      ...(ma110    ? { ma110 }    : {}),
      ...(vwma110  ? { vwma110 }  : {}),
      ...(ma180    ? { ma180 }    : {}),
      // MA 라이딩 플래그 — 5분봉
      riding5mMA50:    checkMARiding(currentPrice, ma50_5m,    slope5mMA50),
      // MA 라이딩 플래그 — 1시간봉
      riding1hMA50:    checkMARiding(currentPrice, ma50_1h,    slope1hMA50),
      riding1hMA110:   checkMARiding(currentPrice, ma110_1h,   slope1hMA110),
      riding1hMA180:   checkMARiding(currentPrice, ma180_1h,   slope1hMA180),
      riding1hVWMA110: checkMARiding(currentPrice, vwma110_1h, slope1hVWMA110),
      // MA 라이딩 플래그 — 일봉
      ridingMA110:   checkMARiding(currentPrice, ma110,    slopeMA110),
      ridingVWMA110: checkMARiding(currentPrice, vwma110,  slopeVWMA110),
      ridingMA180:   checkMARiding(currentPrice, ma180,    slopeMA180),
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
    const allMarkets = (await fetchBithumbMarkets())
      .sort((a, b) => b.changeRate - a.changeRate);

    console.log(`[Multi-TF] 분석 시작: 전체 ${allMarkets.length}종목`);

    const limit = createConcurrencyLimiter(15);
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

    results.sort((a, b) => b.changeRate - a.changeRate);

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
