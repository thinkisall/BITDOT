'use client';

import Header from './components/Header';
import PriceTicker from './components/PriceTicker';
import MarketTable from './components/MarketTable';
import { useMarketData } from './hooks/useMarketData';

export default function Home() {
  const { data, isConnected } = useMarketData();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <PriceTicker data={data} />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Market Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">24h 거래량</div>
            <div className="text-base sm:text-xl font-bold text-white">$2.3B</div>
            <div className="text-[10px] sm:text-xs text-green-500 mt-0.5 sm:mt-1">+12.5%</div>
          </div>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">시가총액</div>
            <div className="text-base sm:text-xl font-bold text-white">$1.9T</div>
            <div className="text-[10px] sm:text-xs text-green-500 mt-0.5 sm:mt-1">+3.2%</div>
          </div>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">거래 쌍</div>
            <div className="text-base sm:text-xl font-bold text-white">489</div>
            <div className="text-[10px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">상장종목</div>
          </div>
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
            <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">활성 사용자</div>
            <div className="text-base sm:text-xl font-bold text-white">2.4M</div>
            <div className="text-[10px] sm:text-xs text-green-500 mt-0.5 sm:mt-1">+8.7%</div>
          </div>
        </div>

        {/* Exchange Comparison */}
        <MarketTable data={data} isConnected={isConnected} />
      </main>
    </div>
  );
}
