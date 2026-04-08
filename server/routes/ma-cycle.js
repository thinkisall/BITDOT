// server/routes/ma-cycle.js
// MA매수포인트 스캐너
// 전략: 일봉 일목구름 위 + 5분봉 역배열(MA180>MA110>MA50) + MA50 ㄴ자 수평화 후 돌파
// 대상: 업비트·빗썸·바이비트 전종목

const express = require('express');
const router = express.Router();

let cache = null;
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

const apiLimit      = createConcurrencyLimiter(5); // 빗썸·바이비트
const upbitApiLimit = createConcurrencyLimiter(2); // 업비트: 초당 5req 제한 → 여유있게 2

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── fetch 헬퍼 ──────────────────────────────────────────────────────────────
async function fetchJson(url, timeoutMs = 12000) {
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

// ── 업비트 캔들 (429 재시도 포함) ───────────────────────────────────────────
async function fetchUpbitCandles(url) {
  return upbitApiLimit(async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 12000);
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
        return data;
      } catch {
        if (attempt < 2) await sleep(300);
      }
    }
    return [];
  });
}

// ── 5분봉 캔들 조회 ─────────────────────────────────────────────────────────
// 업비트 포맷: {trade_price, high_price, low_price, candle_acc_trade_price}
async function fetchUpbitCandles5m(market, count = 250) {
  const url = `https://api.upbit.com/v1/candles/minutes/5?market=${market}&count=${count}`;
  const data = await fetchUpbitCandles(url);
  return data.reverse().map((c) => ({
    close:  c.trade_price,
    volume: c.candle_acc_trade_price,
  }));
}

// 빗썸 포맷: [timestamp, open, close, high, low, volume]
async function fetchBithumbCandles5m(symbol, count = 250) {
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/5m`;
  const data = await apiLimit(() => fetchJson(url));
  if (data.status !== '0000' || !Array.isArray(data.data)) return [];
  return data.data.slice(-count).map((c) => ({
    close:  parseFloat(c[2]),
    volume: parseFloat(c[5]),
  }));
}

// 바이비트 포맷: [startTime, open, high, low, close, volume, turnover]
async function fetchBybitCandles5m(symbol, count = 250) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=5&limit=${count}`;
  const data = await apiLimit(() => fetchJson(url));
  if (data.retCode !== 0 || !data.result?.list) return [];
  return data.result.list.reverse().map((c) => ({
    close:  parseFloat(c[4]),
    volume: parseFloat(c[5]),
  }));
}

// ── 일봉 캔들 조회 (OHLC 포함 - 일목구름 계산용) ────────────────────────────
// 업비트 일봉: {trade_price, high_price, low_price}
async function fetchUpbitCandlesDaily(market, count = 100) {
  const url = `https://api.upbit.com/v1/candles/days?market=${market}&count=${count}`;
  const data = await fetchUpbitCandles(url);
  return data.reverse().map((c) => ({
    close: c.trade_price,
    high:  c.high_price,
    low:   c.low_price,
  }));
}

async function fetchBithumbCandlesDaily(symbol, count = 100) {
  const url = `https://api.bithumb.com/public/candlestick/${symbol}_KRW/24h`;
  const data = await apiLimit(() => fetchJson(url));
  if (data.status !== '0000' || !Array.isArray(data.data)) return [];
  return data.data.slice(-count).map((c) => ({
    close: parseFloat(c[2]),
    high:  parseFloat(c[3]),
    low:   parseFloat(c[4]),
  }));
}

async function fetchBybitCandlesDaily(symbol, count = 100) {
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=D&limit=${count}`;
  const data = await apiLimit(() => fetchJson(url));
  if (data.retCode !== 0 || !data.result?.list) return [];
  return data.result.list.reverse().map((c) => ({
    high:  parseFloat(c[2]),
    low:   parseFloat(c[3]),
    close: parseFloat(c[4]),
  }));
}

// ── 마켓 목록 (전종목) ───────────────────────────────────────────────────────
// 스테이블코인만 제외 (가격 움직임 없어 패턴 탐지 의미 없음)
const STABLE_COINS = new Set(['USDT', 'USDC', 'BUSD', 'DAI', 'TUSD', 'USDP', 'FDUSD', 'PYUSD']);

async function getMarkets() {
  const [upbitAllRes, bithumbRes, bybitRes] = await Promise.all([
    fetchJson('https://api.upbit.com/v1/market/all').catch(() => null),
    fetchJson('https://api.bithumb.com/public/ticker/ALL_KRW').catch(() => null),
    fetchJson('https://api.bybit.com/v5/market/tickers?category=spot').catch(() => null),
  ]);

  const markets = [];

  // ── 업비트 전종목 (KRW 마켓) ──
  if (Array.isArray(upbitAllRes)) {
    const krwMarkets = upbitAllRes.filter((m) => m.market.startsWith('KRW-'));
    const codes = krwMarkets.map((m) => m.market).join(',');
    try {
      const tickers = await fetchJson(`https://api.upbit.com/v1/ticker?markets=${codes}`);
      if (Array.isArray(tickers)) {
        tickers
          .filter((t) => !STABLE_COINS.has(t.market.replace('KRW-', '')))
          .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
          .forEach((t) => {
            markets.push({
              symbol:     t.market.replace('KRW-', ''),
              market:     t.market,
              volume:     t.acc_trade_price_24h,
              changeRate: parseFloat(t.signed_change_rate || '0') * 100,
              exchange:   'upbit',
            });
          });
      }
    } catch { /* 업비트 ticker 실패 시 skip */ }
  }

  // ── 빗썸 전종목 ──
  if (bithumbRes?.status === '0000' && bithumbRes.data) {
    Object.entries(bithumbRes.data)
      .filter(([symbol]) => symbol !== 'date' && !STABLE_COINS.has(symbol))
      .sort(([, a], [, b]) => Number(b.acc_trade_value_24H || 0) - Number(a.acc_trade_value_24H || 0))
      .forEach(([symbol, ticker]) => {
        markets.push({
          symbol,
          market:     symbol,
          volume:     Number(ticker.acc_trade_value_24H || 0),
          changeRate: parseFloat(ticker.fluctate_rate_24H || '0'),
          exchange:   'bithumb',
        });
      });
  }

  // ── 바이비트 전종목 (USDT 스팟) ──
  if (bybitRes?.retCode === 0 && bybitRes.result?.list) {
    bybitRes.result.list
      .filter((t) => t.symbol.endsWith('USDT') && !STABLE_COINS.has(t.symbol.replace('USDT', '')))
      .sort((a, b) => Number(b.turnover24h || 0) - Number(a.turnover24h || 0))
      .forEach((t) => {
        markets.push({
          symbol:     t.symbol,
          market:     t.symbol,
          volume:     Number(t.turnover24h || 0),
          changeRate: parseFloat(t.price24hPcnt || '0') * 100,
          exchange:   'bybit',
        });
      });
  }

  return markets;
}

// ── MA 계산 (SMA) ───────────────────────────────────────────────────────────
function calcMA(closes, period) {
  if (closes.length < period) return null;
  return closes.slice(-period).reduce((s, v) => s + v, 0) / period;
}

// ── 일봉 일목균형표: 현재가가 구름 위인지 확인 ───────────────────────────────
// 선행스팬 A: (전환선 + 기준선) / 2  — 26봉 전 값을 현재 구름으로 투영
// 선행스팬 B: 52봉 고저 중간값        — 26봉 전 값을 현재 구름으로 투영
// 필요 최소 캔들 수: 52 + 26 = 78개
function isAboveIchimokuCloud(dailyCandles) {
  const N = dailyCandles.length;
  if (N < 78) return null; // 데이터 부족 → 필터 통과 처리

  const highs        = dailyCandles.map((c) => c.high);
  const lows         = dailyCandles.map((c) => c.low);
  const currentClose = dailyCandles[N - 1].close;

  // 현재 구름은 26봉 전에 계산된 스팬이 투영된 것
  const ci = N - 1 - 26;
  if (ci < 51) return null;

  const tenkan = (Math.max(...highs.slice(ci - 8,  ci + 1)) + Math.min(...lows.slice(ci - 8,  ci + 1))) / 2;
  const kijun  = (Math.max(...highs.slice(ci - 25, ci + 1)) + Math.min(...lows.slice(ci - 25, ci + 1))) / 2;
  const spanA  = (tenkan + kijun) / 2;
  const spanB  = (Math.max(...highs.slice(ci - 51, ci + 1)) + Math.min(...lows.slice(ci - 51, ci + 1))) / 2;

  return currentClose > Math.max(spanA, spanB);
}

// ── MA매수포인트 탐지 (5분봉) ────────────────────────────────────────────────
// 조건 1. 역배열: MA180 > MA110 > MA50
// 조건 2. ㄴ자 수평화: MA50이 하락하다가 기울기가 55% 이하로 감소
//          직전(5~15봉 전) 실제 하락 중이었어야 함
// 조건 3. 가격이 MA50 근접: −0.5% ~ +1.5%
function detectBuyPoint(candles) {
  const closes = candles.map((c) => c.close);
  const N = closes.length;
  if (N < 220) return null;

  const ma50  = calcMA(closes, 50);
  const ma110 = calcMA(closes, 110);
  const ma180 = calcMA(closes, 180);
  if (!ma50 || !ma110 || !ma180) return null;

  // 조건 1: 역배열
  if (!(ma180 > ma110 && ma110 > ma50)) return null;

  // 기울기 계산
  const ma50_5ago  = calcMA(closes.slice(0, N - 5),  50);
  const ma50_15ago = calcMA(closes.slice(0, N - 15), 50);
  if (!ma50_5ago || !ma50_15ago) return null;

  // 조건 2: 직전에 실제로 하락 중이었어야 함
  if (ma50_15ago <= ma50_5ago) return null;

  const slopeRecent = Math.abs(ma50 - ma50_5ago);
  const slopePrev   = Math.abs(ma50_5ago - ma50_15ago);

  // 조건 2: 기울기 55% 이하로 감소 (수평화)
  if (slopePrev === 0 || slopeRecent >= slopePrev * 0.55) return null;

  // 조건 3: 가격이 MA50 근접
  const currentClose = closes[N - 1];
  const priceDiffPct = ((currentClose - ma50) / ma50) * 100;
  if (priceDiffPct < -0.5 || priceDiffPct > 1.5) return null;

  return {
    ma50:         Math.round(ma50   * 10000) / 10000,
    ma110:        Math.round(ma110  * 10000) / 10000,
    ma180:        Math.round(ma180  * 10000) / 10000,
    priceDiffPct: Math.round(priceDiffPct * 100) / 100,
    slopeRatio:   Math.round((slopeRecent / slopePrev) * 1000) / 1000,
  };
}

// ── 종목 분석 ───────────────────────────────────────────────────────────────
async function analyzeMarket(market) {
  try {
    const isUpbit   = market.exchange === 'upbit';
    const isBithumb = market.exchange === 'bithumb';

    const [candles5m, candlesDaily] = await Promise.all([
      isUpbit   ? fetchUpbitCandles5m(market.market, 250)
      : isBithumb ? fetchBithumbCandles5m(market.symbol, 250)
                  : fetchBybitCandles5m(market.symbol, 250),
      isUpbit   ? fetchUpbitCandlesDaily(market.market, 100)
      : isBithumb ? fetchBithumbCandlesDaily(market.symbol, 100)
                  : fetchBybitCandlesDaily(market.symbol, 100),
    ]);

    if (candles5m.length < 220) return null;

    // 필터 1: 일봉 일목구름 위 (false = 구름 아래 제외, null = 데이터 부족 통과)
    const aboveCloud = isAboveIchimokuCloud(candlesDaily);
    if (aboveCloud === false) return null;

    // 필터 2: 5분봉 MA매수포인트 신호
    const signal = detectBuyPoint(candles5m);
    if (!signal) return null;

    const currentPrice = candles5m[candles5m.length - 1].close;
    const vol24h = candles5m
      .slice(-Math.min(288, candles5m.length))
      .reduce((s, c) => s + (c.volume || 0), 0);

    return {
      symbol:       market.symbol,
      exchange:     market.exchange,
      currentPrice,
      ma50:         signal.ma50,
      ma110:        signal.ma110,
      ma180:        signal.ma180,
      priceDiffPct: signal.priceDiffPct,
      slopeRatio:   signal.slopeRatio,
      isAboveCloud: aboveCloud === true,
      vol24h,
      changeRate:   Math.round((market.changeRate || 0) * 100) / 100,
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

  // MA50에 가장 근접한 종목 상단 (|priceDiffPct| 오름차순)
  results.sort((a, b) => Math.abs(a.priceDiffPct) - Math.abs(b.priceDiffPct));

  const countByExchange = {
    upbit:   results.filter((r) => r.exchange === 'upbit').length,
    bithumb: results.filter((r) => r.exchange === 'bithumb').length,
    bybit:   results.filter((r) => r.exchange === 'bybit').length,
  };

  console.log(`[ma-cycle] 스캔 완료: ${results.length}개 / ${markets.length}종목 (업비트 ${countByExchange.upbit} / 빗썸 ${countByExchange.bithumb} / Bybit ${countByExchange.bybit})`);

  return {
    items:        results,
    scannedCount: markets.length,
    matchedCount: results.length,
    scannedAt:    new Date().toISOString(),
    countByExchange,
  };
}

// ── 백그라운드 스캔 ─────────────────────────────────────────────────────────
function triggerBackgroundScan() {
  if (isRunning) return;
  isRunning = true;
  performScan()
    .then((result) => { cache = result; })
    .catch((err) => console.error('[ma-cycle] 스캔 오류:', err.message))
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
