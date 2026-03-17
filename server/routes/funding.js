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

    // 4개 거래소 병렬 fetch
    const [binanceData, bybitData, okxData, bitgetData] = await Promise.all([
      fetchBinanceFunding(),
      fetchBybitFunding(),
      fetchOKXFunding(),
      fetchBitgetFunding(),
    ]);

    console.log(`Fetched - Binance: ${binanceData.length}, Bybit: ${bybitData.length}, OKX: ${okxData.length}, Bitget: ${bitgetData.length}`);

    const allData = [...binanceData, ...bybitData, ...okxData, ...bitgetData];

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

// OKX Funding Rate — USDT-SWAP 전종목 (tickers 1회 → 펀딩비 병렬 batch)
async function fetchOKXFunding() {
  try {
    const tickersResp = await fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP');
    if (!tickersResp.ok) throw new Error(`OKX tickers error: ${tickersResp.status}`);
    const tickersData = await tickersResp.json();
    if (tickersData.code !== '0' || !tickersData.data) return [];

    const instIds = tickersData.data
      .filter((t) => t.instId.endsWith('-USDT-SWAP'))
      .map((t) => t.instId);

    // 50개씩 병렬 batch
    const results = [];
    const BATCH = 50;
    for (let i = 0; i < instIds.length; i += BATCH) {
      const batch = instIds.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(async (instId) => {
          try {
            const resp = await fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`);
            if (!resp.ok) return null;
            const d = await resp.json();
            if (d.code !== '0' || !d.data?.[0]) return null;
            const item = d.data[0];
            const fundingRate = parseFloat(item.fundingRate || '0');
            return {
              symbol: instId.replace('-USDT-SWAP', ''),
              exchange: 'okx',
              fundingRate,
              fundingRatePercent: fundingRate * 100,
              nextFundingTime: parseInt(item.nextFundingTime || '0'),
              markPrice: 0,
            };
          } catch { return null; }
        })
      );
      results.push(...batchResults.filter(Boolean));
    }
    return results;
  } catch (error) {
    console.error('OKX funding error:', error.message);
    return [];
  }
}

// Bitget Funding Rate — USDT-FUTURES 단일 요청
async function fetchBitgetFunding() {
  try {
    const resp = await fetch('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES');
    if (!resp.ok) throw new Error(`Bitget API error: ${resp.status}`);
    const data = await resp.json();
    if (data.code !== '00000' || !data.data) return [];

    return data.data
      .filter((item) => item.symbol && item.fundingRate != null)
      .map((item) => {
        const fundingRate = parseFloat(item.fundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'bitget',
          fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.lastPr || '0'),
        };
      });
  } catch (error) {
    console.error('Bitget funding error:', error.message);
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
