'use client';

const sellOrders = [
  { price: '98,456.78', amount: '0.5234', total: '51,543.21' },
  { price: '98,445.32', amount: '1.2341', total: '121,456.78' },
  { price: '98,423.45', amount: '0.8765', total: '86,234.56' },
  { price: '98,398.23', amount: '2.1234', total: '208,876.43' },
  { price: '98,367.89', amount: '0.3421', total: '33,654.32' },
  { price: '98,345.67', amount: '1.5678', total: '154,234.56' },
  { price: '98,312.45', amount: '0.9876', total: '97,098.76' },
];

const buyOrders = [
  { price: '98,234.50', amount: '1.3456', total: '132,145.67' },
  { price: '98,223.45', amount: '0.7654', total: '75,187.65' },
  { price: '98,198.76', amount: '2.3421', total: '229,987.43' },
  { price: '98,176.54', amount: '0.5432', total: '53,345.21' },
  { price: '98,156.32', amount: '1.8765', total: '184,234.56' },
  { price: '98,134.21', amount: '0.6543', total: '64,234.32' },
  { price: '98,112.34', amount: '1.2345', total: '121,098.76' },
];

export default function OrderBook() {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 h-full">
      <h3 className="text-sm font-medium text-white mb-4">호가창</h3>

      <div className="grid grid-cols-3 gap-2 text-xs text-zinc-500 mb-2 px-2">
        <div>가격(USDT)</div>
        <div className="text-right">수량(BTC)</div>
        <div className="text-right">총액</div>
      </div>

      {/* Sell Orders */}
      <div className="space-y-0.5 mb-3">
        {sellOrders.reverse().map((order, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 text-xs py-1 px-2 rounded hover:bg-zinc-800/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-red-500/10" style={{ width: `${Math.random() * 60 + 20}%` }}></div>
            <div className="text-red-500 relative z-10">{order.price}</div>
            <div className="text-zinc-400 text-right relative z-10">{order.amount}</div>
            <div className="text-zinc-500 text-right relative z-10">{order.total}</div>
          </div>
        ))}
      </div>

      {/* Current Price */}
      <div className="bg-zinc-800 rounded py-2 px-3 mb-3">
        <div className="text-lg font-bold text-green-500">98,234.50</div>
        <div className="text-xs text-zinc-500">≈ $98,234.50</div>
      </div>

      {/* Buy Orders */}
      <div className="space-y-0.5">
        {buyOrders.map((order, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 text-xs py-1 px-2 rounded hover:bg-zinc-800/50 relative overflow-hidden">
            <div className="absolute inset-0 bg-green-500/10" style={{ width: `${Math.random() * 60 + 20}%` }}></div>
            <div className="text-green-500 relative z-10">{order.price}</div>
            <div className="text-zinc-400 text-right relative z-10">{order.amount}</div>
            <div className="text-zinc-500 text-right relative z-10">{order.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
