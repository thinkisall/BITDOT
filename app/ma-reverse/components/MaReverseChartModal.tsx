'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';
import { getHomeServerUrl } from '@/lib/home-server';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  exchange: string;
  ma50: number;
  ma110: number;
  ma180: number;
  currentPrice: number;
  reversePct: number;
}

const TIMEFRAMES = ['5m', '15m', '30m', '1h', '4h'] as const;
type TF = typeof TIMEFRAMES[number];

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  return price.toFixed(6);
}

export default function MaReverseChartModal({
  isOpen, onClose, symbol, exchange, ma50, ma110, ma180, currentPrice, reversePct,
}: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<TF>('5m');
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !chartContainerRef.current) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
    }

    setLoadingChart(true);
    setChartError(null);

    const controller = new AbortController();

    const fetchAndDraw = async () => {
      try {
        const url = getHomeServerUrl(
          `/api/chart?symbol=${symbol}&exchange=${exchange}&timeframe=${timeframe}`
        );
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`서버 오류 ${res.status}`);
        const data = await res.json();

        if (cancelled) return;

        if (!data.candles || data.candles.length === 0) {
          setChartError('캔들 데이터가 없습니다.');
          return;
        }

        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: 400,
          layout: { background: { color: '#18181b' }, textColor: '#a1a1aa' },
          grid: {
            vertLines: { color: '#27272a' },
            horzLines: { color: '#27272a' },
          },
          rightPriceScale: { borderColor: '#27272a' },
          timeScale: { borderColor: '#27272a', timeVisible: true },
          crosshair: { mode: 1 },
        });
        chartRef.current = chart;

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#22c55e', downColor: '#ef4444',
          borderUpColor: '#22c55e', borderDownColor: '#ef4444',
          wickUpColor: '#22c55e', wickDownColor: '#ef4444',
        });
        candleSeries.setData(data.candles);

        if (data.sma50?.length) {
          const s = chart.addLineSeries({
            color: '#22d3ee', lineWidth: 2, title: 'MA50',
            priceLineVisible: false, lastValueVisible: false,
          });
          s.setData(data.sma50);
        }

        if (data.sma110?.length) {
          const s = chart.addLineSeries({
            color: '#a78bfa', lineWidth: 2, title: 'MA110',
            priceLineVisible: false, lastValueVisible: false,
          });
          s.setData(data.sma110);
        }

        if (data.sma180?.length) {
          const s = chart.addLineSeries({
            color: '#fb923c', lineWidth: 2, title: 'MA180',
            priceLineVisible: false, lastValueVisible: false,
          });
          s.setData(data.sma180);
        }

        chart.timeScale().fitContent();

        resizeObserver = new ResizeObserver((entries) => {
          if (!entries[0] || !chartRef.current) return;
          chartRef.current.applyOptions({ width: entries[0].contentRect.width });
        });
        resizeObserver.observe(chartContainerRef.current);

      } catch (e: any) {
        if (cancelled) return;
        setChartError(e.message || '차트 로드 실패');
      } finally {
        if (!cancelled) setLoadingChart(false);
      }
    };

    fetchAndDraw();

    return () => {
      cancelled = true;
      controller.abort();
      if (resizeObserver) resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isOpen, symbol, exchange, timeframe]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!isOpen) return null;

  const exchangeLabel = exchange === 'bithumb' ? '빗썸' : 'Bybit';
  const exchangeColor = exchange === 'bithumb' ? 'bg-blue-500/15 text-blue-400' : 'bg-yellow-500/15 text-yellow-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-xl border border-zinc-800 w-[96vw] max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">{symbol}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${exchangeColor}`}>
                {exchangeLabel}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-red-500/15 text-red-400">
                역배열
              </span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              현재가 <span className="text-white">{formatPrice(currentPrice)}</span>
              <span className="mx-1.5 text-zinc-700">·</span>
              역배열 강도 <span className="text-red-400">{reversePct}%</span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 타임프레임 */}
        <div className="flex gap-1 px-4 py-2 border-b border-zinc-800 shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                timeframe === tf
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* 차트 영역 */}
        <div className="flex-1 px-4 py-3 min-h-0 relative">
          <div ref={chartContainerRef} className="w-full" style={{ minHeight: 400 }} />

          {loadingChart && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-zinc-400 bg-zinc-900/80">
              <svg className="w-5 h-5 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="text-sm">차트 로딩 중...</span>
            </div>
          )}

          {chartError && !loadingChart && (
            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm bg-zinc-900/80">
              {chartError}
            </div>
          )}
        </div>

        {/* MA 범례 */}
        <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-cyan-400 rounded" />
              <span className="text-zinc-500">MA50</span>
              <span className="text-cyan-400 font-medium">{formatPrice(ma50)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-purple-400 rounded" />
              <span className="text-zinc-500">MA110</span>
              <span className="text-purple-400 font-medium">{formatPrice(ma110)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 bg-orange-400 rounded" />
              <span className="text-zinc-500">MA180</span>
              <span className="text-orange-400 font-medium">{formatPrice(ma180)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
