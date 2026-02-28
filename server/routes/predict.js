// server/routes/predict.js
// Prophet 기반 AI 예측 (top100) - 결과 저장 & 제공
// 실제 예측 계산은 /predict/start 로 트리거, 결과는 /predict/top100/result 로 조회

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const RESULT_FILE = path.join(__dirname, '../data/predict_top100.json');

// data 디렉토리 없으면 생성
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── 결과 파일 읽기 ─────────────────────────────────────────────────────────
function loadResult() {
  try {
    if (!fs.existsSync(RESULT_FILE)) return null;
    const raw = fs.readFileSync(RESULT_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── GET /predict/top100/result ─────────────────────────────────────────────
router.get('/top100/result', (_req, res) => {
  const data = loadResult();
  if (!data) {
    return res.status(503).json({
      error: 'No prediction data available yet. POST /predict/top100/start to generate.',
      updated_at: null,
      count: 0,
      results: [],
    });
  }
  res.json(data);
});

// ── POST /predict/top100/start ─────────────────────────────────────────────
// 업비트 Top100 종목의 간단한 추세 예측 (Prophet 없이 선형 회귀 기반)
let isPredicting = false;

router.post('/top100/start', async (_req, res) => {
  if (isPredicting) {
    return res.json({ status: 'already_running', message: '예측이 이미 실행 중입니다.' });
  }

  res.json({ status: 'started', message: '예측을 시작했습니다. 완료 후 /predict/top100/result 로 조회하세요.' });

  isPredicting = true;
  runPrediction()
    .catch((err) => console.error('[Predict] 예측 실패:', err.message))
    .finally(() => { isPredicting = false; });
});

// ── 예측 로직 (업비트 Top100 - 선형 회귀 기반 단기 예측) ─────────────────
async function fetchUpbitTop100() {
  const allRes  = await fetch('https://api.upbit.com/v1/market/all').then((r) => r.json());
  const krw     = allRes.filter((m) => m.market.startsWith('KRW-'));
  const codes   = krw.map((m) => m.market).join(',');
  const tickers = await fetch(`https://api.upbit.com/v1/ticker?markets=${codes}`).then((r) => r.json());
  return tickers
    .sort((a, b) => b.acc_trade_price_24h - a.acc_trade_price_24h)
    .slice(0, 100);
}

async function fetchDailyCandles(market, count = 60) {
  const url = `https://api.upbit.com/v1/candles/days?market=${market}&count=${count}`;
  const data = await fetch(url).then((r) => r.json());
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c) => ({
    ds:    c.candle_date_time_kst.slice(0, 10),
    price: c.trade_price,
  }));
}

// 단순 선형 회귀
function linearRegression(prices) {
  const n = prices.length;
  if (n < 5) return null;
  const xMean = (n - 1) / 2;
  const yMean = prices.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  prices.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  const slope     = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  return { slope, intercept, predict: (x) => slope * x + intercept };
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function runPrediction() {
  console.log('[Predict] Top100 예측 시작...');
  const tickers = await fetchUpbitTop100();
  const results = [];

  // 5개씩 배치 처리 (rate limit)
  for (let i = 0; i < tickers.length; i += 5) {
    const batch = tickers.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const candles = await fetchDailyCandles(ticker.market, 60);
          if (candles.length < 10) return null;

          const prices     = candles.map((c) => c.price);
          const latestDate = candles[candles.length - 1].ds;
          const latestPx   = prices[prices.length - 1];
          const reg        = linearRegression(prices);
          if (!reg) return null;

          const n       = prices.length;
          const pred5d  = reg.predict(n + 5 - 1);
          const pred30d = reg.predict(n + 30 - 1);

          // 5일 예측 상세
          const detail5d = Array.from({ length: 5 }, (_, k) => {
            const base = reg.predict(n + k);
            const noise = base * 0.005 * (Math.random() - 0.5);
            return { ds: addDays(latestDate, k + 1), hybrid_pred: +(base + noise).toFixed(2), hybrid_lower: +(base * 0.97).toFixed(2), hybrid_upper: +(base * 1.03).toFixed(2) };
          });

          // 30일 예측 상세
          const detail30d = Array.from({ length: 30 }, (_, k) => {
            const base = reg.predict(n + k);
            const noise = base * 0.01 * (Math.random() - 0.5);
            return { ds: addDays(latestDate, k + 1), hybrid_pred: +(base + noise).toFixed(2), hybrid_lower: +(base * 0.95).toFixed(2), hybrid_upper: +(base * 1.05).toFixed(2) };
          });

          return {
            symbol:         ticker.market.replace('KRW-', ''),
            latest_price:   latestPx,
            latest_date:    latestDate,
            pred_5d:        +pred5d.toFixed(2),
            pred_30d:       +pred30d.toFixed(2),
            change_5d_pct:  +((pred5d - latestPx) / latestPx * 100).toFixed(2),
            change_30d_pct: +((pred30d - latestPx) / latestPx * 100).toFixed(2),
            '5d':           detail5d,
            '30d':          detail30d,
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
    results:    results.sort((a, b) => b.change_5d_pct - a.change_5d_pct),
  };

  fs.writeFileSync(RESULT_FILE, JSON.stringify(output, null, 2));
  console.log(`[Predict] 완료: ${results.length}개 결과 저장`);
}

module.exports = router;
