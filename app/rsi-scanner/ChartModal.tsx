'use client';

import { useEffect, useRef, useState } from 'react';
import type { RsiScanItem } from '../api/rsi-scanner/route';

interface Props {
  item: RsiScanItem;
  onClose: () => void;
}

type Timeframe = '1h' | '5m';

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function getRsiColor(rsi: number): string {
  if (rsi <= 25) return 'text-blue-400';
  if (rsi <= 35) return 'text-cyan-400';
  return 'text-yellow-400';
}

export default function ChartModal({ item, onClose }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ESC 키로 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let destroyed = false;

    async function initChart() {
      if (!chartContainerRef.current) return;
      setLoading(true);
      setError(null);

      try {
        const { createChart, ColorType, CrosshairMode } = await import('lightweight-charts');

        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
        }
        if (destroyed) return;

        const res = await fetch(
          `/api/chart?symbol=${item.symbol}&exchange=${item.exchange}&timeframe=${timeframe}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (destroyed) return;

        const container = chartContainerRef.current;
        if (!container) return;

        const chart = createChart(container, {
          width: container.clientWidth,
          height: 400,
          layout: {
            background: { type: ColorType.Solid, color: '#0f0f11' },
            textColor: '#a1a1aa',
          },
          grid: {
            vertLines: { color: '#27272a' },
            horzLines: { color: '#27272a' },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: '#3f3f46' },
          timeScale: {
            borderColor: '#3f3f46',
            timeVisible: true,
            secondsVisible: false,
          },
        });
        chartRef.current = chart;

        // 캔들스틱
        const candleSeries = chart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
        candleSeries.setData(data.candles);

        if (timeframe === '1h') {
          // 1시간봉: MA50만 표시
          if (data.sma50?.length) {
            const ma50Series = chart.addLineSeries({
              color: '#facc15',
              lineWidth: 2,
              title: 'MA50',
              priceLineVisible: false,
              lastValueVisible: true,
            });
            ma50Series.setData(data.sma50);
          }
        } else {
          // 5분봉: MA50(노란), MA110(주황), MA180(빨강) - 역배열 확인용
          if (data.sma50?.length) {
            const ma50Series = chart.addLineSeries({
              color: '#facc15',
              lineWidth: 2,
              title: 'MA50',
              priceLineVisible: false,
              lastValueVisible: true,
            });
            ma50Series.setData(data.sma50);
          }
          if (data.sma110?.length) {
            const ma110Series = chart.addLineSeries({
              color: '#f97316',
              lineWidth: 1,
              title: 'MA110',
              priceLineVisible: false,
              lastValueVisible: true,
            });
            ma110Series.setData(data.sma110);
          }
          if (data.sma180?.length) {
            const ma180Series = chart.addLineSeries({
              color: '#ef4444',
              lineWidth: 1,
              title: 'MA180',
              priceLineVisible: false,
              lastValueVisible: true,
            });
            ma180Series.setData(data.sma180);
          }
        }

        // 거래량
        const volumeSeries = chart.addHistogramSeries({
          priceFormat: { type: 'volume' },
          priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
          scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeries.setData(data.volumes);

        chart.timeScale().fitContent();

        const ro = new ResizeObserver(() => {
          if (container && chartRef.current) {
            chartRef.current.applyOptions({ width: container.clientWidth });
          }
        });
        ro.observe(container);

        setLoading(false);
        return () => ro.disconnect();
      } catch (e: any) {
        if (!destroyed) {
          setError(e?.message || '차트 로드 실패');
          setLoading(false);
        }
      }
    }

    initChart();
    return () => {
      destroyed = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [item.symbol, item.exchange, timeframe]);

  const rsiColor = getRsiColor(item.rsi14_1h);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-3xl bg-zinc-950 border border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center">
              <span className="text-xs font-bold text-blue-400">{item.symbol.slice(0, 2)}</span>
            </div>
            <div>
              <div className="text-sm font-bold text-white">{item.symbol} / KRW</div>
              <div className="text-xs text-zinc-400 font-mono">₩{formatPrice(item.currentPrice)}</div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-5 text-xs">
            <div className="text-right">
              <div className="text-zinc-500 mb-0.5">1H RSI14</div>
              <div className={`${rsiColor} font-bold text-base`}>{item.rsi14_1h.toFixed(1)}</div>
            </div>
            <div className="text-right">
              <div className="text-zinc-500 mb-0.5">5M 이동평균</div>
              <div className="text-[10px] space-y-0.5">
                <div><span className="text-yellow-400">MA50</span> &gt; <span className="text-orange-400">MA110</span> &gt; <span className="text-red-400">MA180</span> <span className="text-zinc-500">역배열</span></div>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors ml-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 타임프레임 탭 */}
        <div className="flex gap-1 px-4 pt-3">
          {(['5m', '1h'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                timeframe === tf
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {tf === '1h' ? '1시간봉 (RSI)' : '5분봉 (역배열)'}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-zinc-500">
            {timeframe === '1h' ? (
              <span className="flex items-center gap-1">
                <span className="inline-block w-5 h-0.5 bg-yellow-400" /> MA50
              </span>
            ) : (
              <>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5 bg-yellow-400" /> MA50
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5 bg-orange-400" /> MA110
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5 bg-red-400" /> MA180
                </span>
              </>
            )}
          </div>
        </div>

        {/* 차트 영역 */}
        <div className="p-4">
          {loading && (
            <div className="h-[400px] flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <p className="text-xs text-zinc-400">차트 불러오는 중...</p>
              </div>
            </div>
          )}
          {error && (
            <div className="h-[400px] flex items-center justify-center">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
          <div
            ref={chartContainerRef}
            className={loading || error ? 'hidden' : 'w-full'}
          />
        </div>

        {/* 하단 정보 (모바일) */}
        <div className="sm:hidden flex items-center gap-4 px-4 pb-4 text-xs">
          <div>
            <span className="text-zinc-500">RSI14 </span>
            <span className={`${rsiColor} font-bold`}>{item.rsi14_1h.toFixed(1)}</span>
          </div>
          <div className="text-zinc-500">
            <span className="text-yellow-400">MA50</span>
            {' < '}
            <span className="text-orange-400">MA110</span>
            {' < '}
            <span className="text-red-400">MA180</span>
          </div>
        </div>
      </div>
    </div>
  );
}
