'use client';

import { useState } from 'react';

export default function TradingChart() {
  const [timeframe, setTimeframe] = useState('1D');
  const timeframes = ['1M', '5M', '15M', '1H', '4H', '1D', '1W'];

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">BTC/USDT</h2>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl font-bold text-green-500">$98,234.50</span>
            <span className="text-sm text-green-500">+2.34%</span>
          </div>
        </div>
        <div className="flex gap-1 bg-zinc-800 rounded p-1">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                timeframe === tf
                  ? 'bg-zinc-700 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Mock Chart */}
      <div className="h-96 bg-zinc-950 rounded relative overflow-hidden">
        <div className="absolute inset-0 flex items-end justify-around p-4">
          {[65, 58, 72, 68, 85, 78, 92, 88, 95, 89, 98, 94, 102, 97, 105, 100, 108, 103, 112, 106].map((height, i) => (
            <div
              key={i}
              className="w-full mx-0.5 bg-gradient-to-t from-green-500/20 to-green-500/50 rounded-t"
              style={{ height: `${height}%` }}
            >
              <div className="w-full h-1 bg-green-500"></div>
            </div>
          ))}
        </div>
        <div className="absolute bottom-4 left-4 text-xs text-zinc-500">
          Jan 2026
        </div>
        <div className="absolute bottom-4 right-4 text-xs text-zinc-500">
          Feb 2026
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-800">
        <div>
          <div className="text-xs text-zinc-500">24h High</div>
          <div className="text-sm font-medium text-white">$99,456.78</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">24h Low</div>
          <div className="text-sm font-medium text-white">$96,123.45</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">24h Volume (BTC)</div>
          <div className="text-sm font-medium text-white">23,456.78</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">24h Volume (USDT)</div>
          <div className="text-sm font-medium text-white">2.3B</div>
        </div>
      </div>
    </div>
  );
}
