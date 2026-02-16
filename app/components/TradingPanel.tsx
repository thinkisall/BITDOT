'use client';

import { useState } from 'react';

export default function TradingPanel() {
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSide('buy')}
          className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
            side === 'buy'
              ? 'bg-green-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          매수
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`flex-1 py-2 text-sm font-medium rounded transition-colors ${
            side === 'sell'
              ? 'bg-red-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          매도
        </button>
      </div>

      <div className="flex gap-2 mb-4 bg-zinc-800 rounded p-1">
        <button
          onClick={() => setOrderType('limit')}
          className={`flex-1 py-1.5 text-xs rounded transition-colors ${
            orderType === 'limit'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          지정가
        </button>
        <button
          onClick={() => setOrderType('market')}
          className={`flex-1 py-1.5 text-xs rounded transition-colors ${
            orderType === 'market'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          시장가
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
          <span>사용가능</span>
          <span className="text-white">0.00 USDT</span>
        </div>

        {orderType === 'limit' && (
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">가격</label>
            <div className="flex items-center bg-zinc-800 rounded">
              <input
                type="text"
                placeholder="0.00"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
              />
              <span className="px-3 text-xs text-zinc-500">USDT</span>
            </div>
          </div>
        )}

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">수량</label>
          <div className="flex items-center bg-zinc-800 rounded">
            <input
              type="text"
              placeholder="0.00"
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
            />
            <span className="px-3 text-xs text-zinc-500">BTC</span>
          </div>
        </div>

        <div className="flex gap-2">
          {['25%', '50%', '75%', '100%'].map((percent) => (
            <button
              key={percent}
              className="flex-1 py-1.5 text-xs bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-white transition-colors"
            >
              {percent}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs text-zinc-500 mb-1 block">총액</label>
          <div className="flex items-center bg-zinc-800 rounded">
            <input
              type="text"
              placeholder="0.00"
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none"
            />
            <span className="px-3 text-xs text-zinc-500">USDT</span>
          </div>
        </div>

        <button
          className={`w-full py-3 text-sm font-medium rounded transition-colors ${
            side === 'buy'
              ? 'bg-green-500 hover:bg-green-600 text-white'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          {side === 'buy' ? '매수' : '매도'} BTC
        </button>

        <div className="pt-3 border-t border-zinc-800 text-xs text-zinc-500">
          <div className="flex justify-between mb-1">
            <span>수수료</span>
            <span>0.1%</span>
          </div>
          <div className="flex justify-between">
            <span>예상 체결가</span>
            <span className="text-white">--</span>
          </div>
        </div>
      </div>
    </div>
  );
}
