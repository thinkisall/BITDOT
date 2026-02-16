'use client';

const trades = [
  { price: '98,234.50', amount: '0.1234', time: '14:32:15', type: 'buy' },
  { price: '98,223.45', amount: '0.5678', time: '14:32:12', type: 'sell' },
  { price: '98,245.67', amount: '0.3421', time: '14:32:09', type: 'buy' },
  { price: '98,212.34', amount: '1.2345', time: '14:32:05', type: 'sell' },
  { price: '98,256.78', amount: '0.8765', time: '14:32:01', type: 'buy' },
  { price: '98,198.23', amount: '0.4567', time: '14:31:58', type: 'sell' },
  { price: '98,267.89', amount: '0.6543', time: '14:31:54', type: 'buy' },
  { price: '98,189.12', amount: '0.9876', time: '14:31:51', type: 'sell' },
  { price: '98,278.90', amount: '0.2345', time: '14:31:47', type: 'buy' },
  { price: '98,176.54', amount: '1.5678', time: '14:31:43', type: 'sell' },
];

export default function RecentTrades() {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 h-full">
      <h3 className="text-sm font-medium text-white mb-4">최근 체결</h3>

      <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 mb-2 px-2">
        <div>가격(USDT)</div>
        <div className="text-right">수량(BTC)</div>
        <div className="text-right">시간</div>
      </div>

      <div className="space-y-0.5">
        {trades.map((trade, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 text-xs py-1 px-2 rounded hover:bg-zinc-800/50">
            <div className={trade.type === 'buy' ? 'text-green-500' : 'text-red-500'}>
              {trade.price}
            </div>
            <div className="text-zinc-400 text-right">{trade.amount}</div>
            <div className="text-zinc-500 text-right">{trade.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
