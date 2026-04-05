// server/routes/funding.js
const express = require('express');
const router = express.Router();

// ── 메인 캐시 (1분 TTL) ────────────────────────────────────────────────────
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000;

// ── OKX 전용 캐시 (2분 TTL, 백그라운드 갱신) ─────────────────────────────
let okxCache = [];
let okxCacheTimestamp = 0;
const OKX_CACHE_TTL = 2 * 60 * 1000;
let okxRefreshing = false;

// ── fetch with timeout ────────────────────────────────────────────────────────
async function fetchWithTimeout(url, timeoutMs = 10000) {
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

// ── Binance ────────────────────────────────────────────────────────────────
async function fetchBinanceFunding() {
  try {
    const data = await fetchWithTimeout('https://fapi.binance.com/fapi/v1/premiumIndex', 10000);
    if (!Array.isArray(data)) throw new Error('Unexpected response');
    return data
      .filter((item) => item.symbol.endsWith('USDT'))
      .map((item) => {
        const fundingRate = parseFloat(item.lastFundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'binance',
          fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('[funding] Binance error:', error.message);
    return [];
  }
}

// ── Bybit ─────────────────────────────────────────────────────────────────
async function fetchBybitFunding() {
  try {
    const data = await fetchWithTimeout('https://api.bybit.com/v5/market/tickers?category=linear', 10000);
    if (data.retCode !== 0 || !data.result?.list) throw new Error('Bad response');
    return data.result.list
      .filter((item) => item.symbol.endsWith('USDT'))
      .map((item) => {
        const fundingRate = parseFloat(item.fundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'bybit',
          fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('[funding] Bybit error:', error.message);
    return [];
  }
}

// ── Bitget ────────────────────────────────────────────────────────────────
async function fetchBitgetFunding() {
  try {
    const data = await fetchWithTimeout(
      'https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES',
      10000
    );
    if (data.code !== '00000' || !data.data) throw new Error('Bad response');
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
    console.error('[funding] Bitget error:', error.message);
    return [];
  }
}

// ── OKX (백그라운드 갱신 전용) ────────────────────────────────────────────
// 심볼별 개별 호출이 필요해서 오래 걸림 → 별도 캐시로 분리
async function refreshOKXCache() {
  if (okxRefreshing) return;
  okxRefreshing = true;
  try {
    const tickersData = await fetchWithTimeout(
      'https://www.okx.com/api/v5/market/tickers?instType=SWAP',
      10000
    );
    if (tickersData.code !== '0' || !tickersData.data) return;

    const instIds = tickersData.data
      .filter((t) => t.instId.endsWith('-USDT-SWAP'))
      .map((t) => t.instId);

    // 30개씩 병렬, 배치 사이에 짧은 딜레이
    const results = [];
    const BATCH = 30;
    for (let i = 0; i < instIds.length; i += BATCH) {
      const batch = instIds.slice(i, i + BATCH);
      const batchResults = await Promise.all(
        batch.map(async (instId) => {
          try {
            const d = await fetchWithTimeout(
              `https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`,
              5000
            );
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

    okxCache = results;
    okxCacheTimestamp = Date.now();
    console.log(`[funding] OKX cache refreshed: ${results.length}개`);
  } catch (error) {
    console.error('[funding] OKX refresh error:', error.message);
  } finally {
    okxRefreshing = false;
  }
}

// 서버 시작 시 OKX 첫 갱신 (논블로킹)
refreshOKXCache();
// 2분마다 백그라운드 갱신
setInterval(refreshOKXCache, OKX_CACHE_TTL);

// ── Route ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const now = Date.now();

  // 메인 캐시 유효 시 즉시 반환
  if (cache && now - cacheTimestamp < CACHE_TTL) {
    console.log('[funding] serving from cache');
    return res.json(cache);
  }

  // 전체 응답 20초 타임아웃 — Cloudflare 30초 전에 응답
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      console.error('[funding] response timeout, returning partial data');
      const partial = buildResult([], [], okxCache, [], now);
      res.json({ ...partial, partial: true });
    }
  }, 20000);

  try {
    console.log('[funding] fetching fresh data...');

    // Binance·Bybit·Bitget 병렬, OKX는 캐시에서
    const [binanceData, bybitData, bitgetData] = await Promise.all([
      fetchBinanceFunding(),
      fetchBybitFunding(),
      fetchBitgetFunding(),
    ]);

    console.log(
      `[funding] Binance:${binanceData.length} Bybit:${bybitData.length} Bitget:${bitgetData.length} OKX(cache):${okxCache.length}`
    );

    const result = buildResult(binanceData, bybitData, okxCache, bitgetData, now);
    cache = result;
    cacheTimestamp = now;

    if (!res.headersSent) {
      clearTimeout(timeout);
      res.json(result);
    }
  } catch (error) {
    clearTimeout(timeout);
    console.error('[funding] error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: error.message || 'Failed to fetch funding rates',
        data: [],
        timestamp: now,
        count: 0,
      });
    }
  }
});

function buildResult(binance, bybit, okx, bitget, timestamp) {
  const allData = [...binance, ...bybit, ...okx, ...bitget];
  allData.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
  return { data: allData, timestamp, count: allData.length };
}

module.exports = router;
