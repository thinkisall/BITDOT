// server/routes/chart.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { symbol, exchange } = req.query;

    if (!symbol || !exchange) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    console.log(`[Chart] Fetching ${exchange}:${symbol}`);

    // 캔들 데이터 fetch
    let candles = [];

    if (exchange === 'upbit') {
      const market = `KRW-${symbol}`;
      const response = await fetch(
        `https://api.upbit.com/v1/candles/minutes/60?market=${market}&count=250`
      );
      const data = await response.json();

      candles = data.map(c => ({
        time: Math.floor(new Date(c.candle_date_time_kst).getTime() / 1000),
        open: c.opening_price,
        high: c.high_price,
        low: c.low_price,
        close: c.trade_price,
      })).reverse();
    } else {
      // 빗썸 캔들 데이터
      const response = await fetch(
        `https://api.bithumb.com/public/candlestick/${symbol}_KRW/1h`
      );
      const data = await response.json();

      if (data.status === '0000' && data.data) {
        candles = data.data.slice(0, 250).map(c => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(c[1]),
          high: parseFloat(c[3]),
          low: parseFloat(c[4]),
          close: parseFloat(c[2]),
        })).reverse();
      }
    }

    // SMA 계산 (간단 버전)
    const calculateSMA = (data, period) => {
      const result = [];
      for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
        result.push({
          time: data[i].time,
          value: sum / period,
        });
      }
      return result;
    };

    const sma50 = calculateSMA(candles, 50);
    const sma110 = calculateSMA(candles, 110);
    const sma180 = calculateSMA(candles, 180);

    res.json({
      candles,
      sma50,
      sma110,
      sma180,
    });
  } catch (error) {
    console.error('[Chart] Error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch chart data'
    });
  }
});

module.exports = router;
