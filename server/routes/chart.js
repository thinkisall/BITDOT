// server/routes/chart.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { symbol, exchange, timeframe = '1h' } = req.query;

    if (!symbol || !exchange) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    console.log(`[Chart] Fetching ${exchange}:${symbol} (${timeframe})`);

    // 타임프레임 매핑
    const upbitTfMap = {
      '5m':  'minutes/5',
      '15m': 'minutes/15',
      '30m': 'minutes/30',
      '1h':  'minutes/60',
      '4h':  'minutes/240',
      '1d':  'days',
    };
    const bithumbTfMap = {
      '5m':  '5m',
      '15m': '15m',
      '30m': '30m',
      '1h':  '1h',
      '4h':  '4h',
      '1d':  '24h',
    };
    const bybitTfMap = {
      '5m':  '5',
      '15m': '15',
      '30m': '30',
      '1h':  '60',
      '4h':  '240',
      '1d':  'D',
    };

    // 캔들 데이터 fetch
    let candles = [];

    if (exchange === 'upbit') {
      const market = `KRW-${symbol}`;
      const tf = upbitTfMap[timeframe] || 'minutes/60';
      const response = await fetch(
        `https://api.upbit.com/v1/candles/${tf}?market=${market}&count=250`
      );
      const data = await response.json();

      candles = data.map(c => ({
        time: Math.floor(new Date(c.candle_date_time_kst).getTime() / 1000),
        open: c.opening_price,
        high: c.high_price,
        low: c.low_price,
        close: c.trade_price,
      })).reverse();
    } else if (exchange === 'bybit') {
      // 바이비트 캔들 데이터
      const tf = bybitTfMap[timeframe] || '60';
      const response = await fetch(
        `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${tf}&limit=250`
      );
      const data = await response.json();

      if (data.retCode === 0 && data.result?.list) {
        candles = data.result.list.reverse().map(c => ({
          time: Math.floor(Number(c[0]) / 1000),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
        }));
      }
    } else {
      // 빗썸 캔들 데이터
      const tf = bithumbTfMap[timeframe] || '1h';
      const response = await fetch(
        `https://api.bithumb.com/public/candlestick/${symbol}_KRW/${tf}`
      );
      const data = await response.json();

      if (data.status === '0000' && data.data) {
        candles = data.data.slice(-250).map(c => ({
          time: Math.floor(c[0] / 1000),
          open: parseFloat(c[1]),
          high: parseFloat(c[3]),
          low: parseFloat(c[4]),
          close: parseFloat(c[2]),
        }));
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
