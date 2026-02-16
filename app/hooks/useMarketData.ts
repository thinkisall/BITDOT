'use client';

import { useMemo } from 'react';
import { useBithumbData } from './useBithumbData';
import { useUpbitData } from './useUpbitData';
import { CoinData } from '../types/market';

export function useMarketData() {
  const { data: bithumbData, isConnected: bithumbConnected } = useBithumbData();
  const { data: upbitData, markets, isConnected: upbitConnected } = useUpbitData();

  const mergedData = useMemo(() => {
    const coinMap = new Map<string, CoinData>();

    // Add Upbit data
    upbitData.forEach((ticker, symbol) => {
      const market = markets.find(m => m.market === `KRW-${symbol}`);
      if (!market) return;

      coinMap.set(symbol, {
        symbol,
        name: market.korean_name,
        bithumb: null,
        upbit: {
          price: ticker.trade_price,
          change: ticker.signed_change_price,
          changeRate: ticker.signed_change_rate * 100,
          volume: ticker.acc_trade_volume_24h,
        },
        priceDiff: 0,
        avgChangeRate: ticker.signed_change_rate * 100,
      });
    });

    // Merge Bithumb data
    bithumbData.forEach((ticker, symbol) => {
      const existing = coinMap.get(symbol);
      const price = parseFloat(ticker.closing_price);
      const changeRate = parseFloat(ticker.fluctate_rate_24H);
      const volume = parseFloat(ticker.units_traded_24H);

      const bithumbInfo = {
        price,
        change: parseFloat(ticker.fluctate_24H),
        changeRate,
        volume,
      };

      if (existing) {
        existing.bithumb = bithumbInfo;
        if (existing.upbit) {
          existing.priceDiff = existing.bithumb.price - existing.upbit.price;
          existing.avgChangeRate = (existing.bithumb.changeRate + existing.upbit.changeRate) / 2;
        } else {
          existing.avgChangeRate = existing.bithumb.changeRate;
        }
      } else {
        coinMap.set(symbol, {
          symbol,
          name: symbol,
          bithumb: bithumbInfo,
          upbit: null,
          priceDiff: 0,
          avgChangeRate: changeRate,
        });
      }
    });

    // Convert to array and sort by average change rate (descending)
    return Array.from(coinMap.values())
      .sort((a, b) => b.avgChangeRate - a.avgChangeRate);
  }, [bithumbData, upbitData, markets]);

  return {
    data: mergedData,
    isConnected: bithumbConnected && upbitConnected,
    bithumbConnected,
    upbitConnected,
  };
}
