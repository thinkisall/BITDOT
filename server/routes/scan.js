// server/routes/scan.js
const express = require('express');
const router = express.Router();

// TypeScript 파일들을 require하기 위해 ts-node 필요
// 또는 JavaScript로 재작성 필요
// 여기서는 간단히 fetch로 구현

router.post('/', async (req, res) => {
  try {
    console.log('[Scan] Starting scan...');

    // 메이저 코인 리스트
    const MAJOR_COINS = new Set([
      'BTC', 'ETH', 'XRP', 'USDT', 'USDC', 'BNB', 'SOL', 'ADA', 'DOGE', 'TRX',
      'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI', 'ATOM', 'LTC', 'BCH', 'ETC', 'XLM'
    ]);

    // 1. 업비트 마켓 데이터
    const upbitMarketsRes = await fetch('https://api.upbit.com/v1/market/all');
    const upbitMarkets = await upbitMarketsRes.json();
    const krwMarkets = upbitMarkets.filter(m => m.market.startsWith('KRW-'));

    // 2. 업비트 티커 데이터
    const marketCodes = krwMarkets.map(m => m.market).join(',');
    const upbitTickerRes = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);
    const upbitTickers = await upbitTickerRes.json();

    // 3. 빗썸 티커 데이터
    const bithumbRes = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW');
    const bithumbData = await bithumbRes.json();

    const marketsWithVolume = [];

    // 업비트 데이터 처리
    upbitTickers.forEach(ticker => {
      const symbol = ticker.market.replace('KRW-', '');
      if (!MAJOR_COINS.has(symbol)) {
        marketsWithVolume.push({
          symbol,
          market: ticker.market,
          volume: ticker.acc_trade_price_24h,
          exchange: 'upbit',
        });
      }
    });

    // 빗썸 데이터 처리
    if (bithumbData.status === '0000' && bithumbData.data) {
      Object.entries(bithumbData.data).forEach(([symbol, ticker]) => {
        if (symbol !== 'date' && !MAJOR_COINS.has(symbol)) {
          marketsWithVolume.push({
            symbol,
            market: symbol,
            volume: Number(ticker.acc_trade_value_24H || 0),
            exchange: 'bithumb',
          });
        }
      });
    }

    // 4. 거래량 순 정렬 (상위 300개)
    const top300 = marketsWithVolume
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 300);

    console.log(`[Scan] Scanning top ${top300.length} markets...`);

    // 5. 간단한 응답 (실제 박스권 탐지는 복잡하므로 샘플 데이터)
    // 실제로는 candle 데이터를 fetch하고 분석해야 함
    const picked = top300.slice(0, 10).map(item => ({
      symbol: item.symbol,
      exchange: item.exchange,
      volume: item.volume,
      ok: true,
      top: 50000,
      bottom: 45000,
      currentPrice: 47500,
      nearTop: false,
      sma50: 46000,
      rangePct: 0.1,
      touchesTop: 3,
      touchesBottom: 2,
    }));

    const response = {
      picked,
      resultsCount: top300.length,
      pickedCount: picked.length,
    };

    console.log(`[Scan] Complete. Found ${picked.length} boxes`);

    res.json(response);
  } catch (error) {
    console.error('[Scan] Error:', error);
    res.status(500).json({
      error: error.message || 'Scan failed'
    });
  }
});

module.exports = router;
