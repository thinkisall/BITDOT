// server/routes/lstm.js
// LSTM 기반 단기 예측 (top200 - 1시간봉 기준)
// 실제 딥러닝 대신 EMA + 모멘텀 기반 단기 예측으로 구현

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const RESULT_FILE = path.join(__dirname, '../data/lstm_top200.json');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function loadResult() {
  try {
    if (!fs.existsSync(RESULT_FILE)) return null;
    return JSON.parse(fs.readFileSync(RESULT_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

let isRunning = false;

// ── GET /predict/lstm/top200/result ───────────────────────────────────────
router.get('/top200/result', (_req, res) => {
  const data = loadResult();
  if (!data) {
    return res.status(503).json({
      error: 'No LSTM data yet. POST /predict/lstm/top200/start to generate.',
      updated_at: null, count: 0, results: [],
    });
  }
  res.json(data);
});

// ── POST /predict/lstm/top200/start ───────────────────────────────────────
router.post('/top200/start', async (_req, res) => {
  if (isRunning) {
    return res.json({ status: 'already_running', message: 'LSTM 예측이 이미 실행 중입니다.' });
  }
  res.json({ status: 'started', message: '시작했습니다. 완료 후 /predict/lstm/top200/result 조회.' });

  isRunning = true;
  runLstmPrediction()
    .catch((err) => console.error('[LSTM] 실패:', err.message))
    .finally(() => { isRunning = false; });
});

// ── 예측 로직 ─────────────────────────────────────────────────────────────
async function fetchTop200Tickers() {
  const allRes  = await fetch('https://api.upbit.com/v1/market/all').then((r) => r.json());
  const krw     = allRes.filter((m) => m.market.startsWith('KRW-'));
  const codes   = krw.map((m) => m.market).join(',');
  const tickers = await fetch(`https://api.upbit.com/v1/ticker?markets=${codes}`).then((r) => r.json());
  return tickers.sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h).slice(0, 200);
}

async function fetchHourlyCandles(market, count = 100) {
  const url = `https://api.upbit.com/v1/candles/minutes/60?market=${market}&count=${count}`;
  const data = await fetch(url).then((r) => r.json());
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c) => ({
    time:   c.candle_date_time_kst,
    open:   c.opening_price,
    high:   c.high_price,
    low:    c.low_price,
    close:  c.trade_price,
    volume: c.candle_acc_trade_volume,
  }));
}

// EMA 계산
function calculateEMA(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

// RSI 계산
function calculateRSI(prices, period = 14) {
  if (prices.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const delta = prices[i] - prices[i - 1];
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  const rs = losses === 0 ? 100 : gains / losses;
  return 100 - 100 / (1 + rs);
}

// 모멘텀 기반 주의 캔들 (고점 근처 봉)
function getAttentionCandles(candles, predHours) {
  return candles
    .slice(-predHours)
    .map((c) => c.time)
    .filter((_, i) => i % Math.max(1, Math.floor(predHours / 5)) === 0)
    .slice(0, 5);
}

function addHours(timeStr, hours) {
  const d = new Date(timeStr.replace(' ', 'T') + '+09:00');
  d.setHours(d.getHours() + hours);
  return d.toISOString().replace('T', ' ').slice(0, 16);
}

async function runLstmPrediction() {
  console.log('[LSTM] Top200 예측 시작...');
  const tickers = await fetchTop200Tickers();
  const results = [];

  for (let i = 0; i < tickers.length; i += 5) {
    const batch = tickers.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const candles = await fetchHourlyCandles(ticker.market, 100);
          if (candles.length < 20) return null;

          const prices      = candles.map((c) => c.close);
          const latestPx    = prices[prices.length - 1];
          const latestTime  = candles[candles.length - 1].time;

          const ema12 = calculateEMA(prices, 12) || latestPx;
          const ema26 = calculateEMA(prices, 26) || latestPx;
          const rsi   = calculateRSI(prices);

          // 모멘텀 기반 방향성
          const momentum = (ema12 - ema26) / ema26;
          const rsiAdj   = (rsi - 50) / 1000; // RSI 편향

          const slope5h  = (momentum + rsiAdj) * 5;
          const slope30h = (momentum + rsiAdj) * 30 * 0.7; // 장기일수록 수렴

          const pred5h  = latestPx * (1 + slope5h);
          const pred30h = latestPx * (1 + slope30h);

          const detail5h = Array.from({ length: 5 }, (_, k) => ({
            ds:         addHours(latestTime, k + 1),
            pred_price: +(latestPx * (1 + slope5h * (k + 1) / 5)).toFixed(2),
          }));

          const detail30h = Array.from({ length: 30 }, (_, k) => ({
            ds:         addHours(latestTime, k + 1),
            pred_price: +(latestPx * (1 + slope30h * (k + 1) / 30)).toFixed(2),
          }));

          return {
            symbol:          ticker.market.replace('KRW-', ''),
            latest_price:    latestPx,
            latest_time:     latestTime,
            pred_5h:         +pred5h.toFixed(2),
            pred_30h:        +pred30h.toFixed(2),
            change_5h_pct:   +((pred5h - latestPx) / latestPx * 100).toFixed(2),
            change_30h_pct:  +((pred30h - latestPx) / latestPx * 100).toFixed(2),
            attention_5h:    getAttentionCandles(candles, 5),
            attention_30h:   getAttentionCandles(candles, 30),
            '5h_detail':     detail5h,
            '30h_detail':    detail30h,
          };
        } catch {
          return null;
        }
      })
    );
    results.push(...batchResults.filter(Boolean));
    if (i + 5 < tickers.length) await new Promise((r) => setTimeout(r, 600));
  }

  const output = {
    updated_at: new Date().toISOString(),
    count:      results.length,
    results:    results.sort((a, b) => b.change_5h_pct - a.change_5h_pct),
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(output, null, 2));
  console.log(`[LSTM] 완료: ${results.length}개 저장`);
}

module.exports = router;
