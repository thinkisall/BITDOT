'use client';

import Header from '../components/Header';
import PriceTicker from '../components/PriceTicker';
import MarketTable from '../components/MarketTable';
import { useMarketData } from '../hooks/useMarketData';

export default function MarketPage() {
  const { data, isConnected } = useMarketData();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <PriceTicker data={data} />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-xl font-bold text-white">업비트 · 빗썸 시세</h1>
          <p className="text-xs text-zinc-500 mt-1">실시간 원화 마켓 시세 비교</p>
        </div>
        <MarketTable data={data} isConnected={isConnected} />
      </main>
    </div>
  );
}
