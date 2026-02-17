'use client';

import { useMemo } from 'react';
import { CoinData } from '../types/market';

interface PriceTickerProps {
  data: CoinData[];
}

export default function PriceTicker({ data }: PriceTickerProps) {
  // rank Map 사전 계산 — 렌더 시 O(n) findIndex 제거
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((coin, idx) => map.set(coin.symbol, idx + 1));
    return map;
  }, [data]);

  // topGainers memoize
  const topGainers = useMemo(
    () => data.filter(coin => coin.avgChangeRate > 0).slice(0, 10),
    [data]
  );

  const formatPrice = (coin: CoinData) => {
    const price = coin.upbit?.price || coin.bithumb?.price;
    if (!price) return '-';

    if (price >= 1000) {
      return `₩${new Intl.NumberFormat('ko-KR').format(Math.round(price))}`;
    }
    return `₩${price.toFixed(2)}`;
  };

  const formatChangeRate = (rate: number) => {
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(2)}%`;
  };

  if (topGainers.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex overflow-x-auto px-6 py-3 gap-8 scrollbar-hide">
        {topGainers.map((coin) => (
          <div key={coin.symbol} className="flex items-center gap-4 min-w-fit">
            <div>
              <div className="text-sm font-medium text-white flex items-center gap-2">
                {coin.symbol}
                <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-500 rounded">
                  TOP {rankMap.get(coin.symbol) ?? '-'}
                </span>
              </div>
              <div className="text-xs text-zinc-500">{formatPrice(coin)}</div>
            </div>
            <div className="text-xs font-medium text-green-500">
              {formatChangeRate(coin.avgChangeRate)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
