// server/routes/funding.js
const express = require('express');
const router = express.Router();

// 캐시 (1분 TTL)
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1분

router.get('/', async (req, res) => {
  try {
    // 캐시 확인
    const now = Date.now();
    if (cache && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('Returning cached funding data');
      return res.json(cache);
    }

    console.log('Fetching fresh funding data...');

    // Binance와 Bybit 데이터를 병렬로 가져오기
    const [binanceData, bybitData] = await Promise.all([
      fetchBinanceFunding(),
      fetchBybitFunding(),
    ]);

    console.log(`Fetched - Binance: ${binanceData.length}, Bybit: ${bybitData.length}`);

    const allData = [...binanceData, ...bybitData];

    // 펀딩비 절대값 기준으로 정렬 (높은 순)
    allData.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

    const result = {
      data: allData,
      timestamp: now,
      count: allData.length,
    };

    // 캐시 저장
    cache = result;
    cacheTimestamp = now;

    res.json(result);
  } catch (error) {
    console.error('Funding API error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch funding rates',
      data: [],
      timestamp: Date.now(),
      count: 0,
    });
  }
});

// Binance Futures Funding Rate
async function fetchBinanceFunding() {
  try {
    const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }

    const data = await response.json();

    return data
      .filter((item) => item.symbol.endsWith('USDT'))
      .map((item) => {
        const fundingRate = parseFloat(item.lastFundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'binance',
          fundingRate: fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('Binance funding error:', error.message);
    return [];
  }
}

// Bybit Funding Rate
async function fetchBybitFunding() {
  try {
    const response = await fetch(
      'https://api.bybit.com/v5/market/tickers?category=linear'
    );

    if (!response.ok) {
      throw new Error(`Bybit API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.retCode !== 0 || !data.result?.list) {
      console.error('Bybit API error:', data);
      return [];
    }

    return data.result.list
      .filter((item) => item.symbol.endsWith('USDT'))
      .map((item) => {
        const fundingRate = parseFloat(item.fundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'bybit',
          fundingRate: fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('Bybit funding error:', error.message);
    return [];
  }
}

module.exports = router;
