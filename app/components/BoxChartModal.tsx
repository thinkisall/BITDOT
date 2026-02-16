'use client';

import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

interface BoxChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  exchange: 'upbit' | 'bithumb';
  boxData: {
    top: number;
    bottom: number;
    sma50: number;
  };
}

export default function BoxChartModal({ isOpen, onClose, symbol, exchange, boxData }: BoxChartModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const isCreatingChart = useRef(false);

  useEffect(() => {
    if (!isOpen || !chartContainerRef.current) return;

    // 이미 차트 생성 중이면 중단
    if (isCreatingChart.current) return;

    // 기존 차트 정리
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // 컨테이너 비우기 (중복 방지)
    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
    }

    let resizeObserver: ResizeObserver | null = null;

    const fetchAndDisplayChart = async () => {
      isCreatingChart.current = true;
      try {
        // API에서 캔들 데이터 가져오기
        const response = await fetch(`/api/chart?symbol=${symbol}&exchange=${exchange}`);
        const data = await response.json();

        if (!data.candles || data.candles.length === 0) {
          console.error('No candle data received');
          return;
        }

        // 차트 컨테이너가 여전히 존재하는지 확인
        if (!chartContainerRef.current) return;

        // 차트 생성
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current!.clientWidth,
          height: 500,
          layout: {
            background: { color: '#18181b' },
            textColor: '#a1a1aa',
          },
          grid: {
            vertLines: { color: '#27272a' },
            horzLines: { color: '#27272a' },
          },
          rightPriceScale: {
            borderColor: '#27272a',
          },
          timeScale: {
            borderColor: '#27272a',
            timeVisible: true,
          },
        });

        chartRef.current = chart;

        // 캔들스틱 시리즈
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderUpColor: '#22c55e',
          borderDownColor: '#ef4444',
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });

        // 캔들 데이터 설정
        candlestickSeries.setData(data.candles);

        // 50SMA 라인 (빨간색)
        const sma50Series = chart.addLineSeries({
          color: '#ef4444',
          lineWidth: 2,
          title: 'MA50',
        });
        sma50Series.setData(data.sma50);

        // 110SMA 라인 (주황색)
        const sma110Series = chart.addLineSeries({
          color: '#f97316',
          lineWidth: 2,
          title: 'MA110',
        });
        sma110Series.setData(data.sma110);

        // 180SMA 라인 (노란색)
        const sma180Series = chart.addLineSeries({
          color: '#eab308',
          lineWidth: 2,
          title: 'MA180',
        });
        sma180Series.setData(data.sma180);

        // 박스 상단 라인 (두꺼운 선)
        const topLineSeries = chart.addLineSeries({
          color: '#3b82f6',
          lineWidth: 4,
          lineStyle: 2, // dashed
          title: '박스 상단',
        });
        topLineSeries.setData(
          data.candles.map((c: any) => ({ time: c.time, value: boxData.top }))
        );

        // 박스 하단 라인 (두꺼운 선)
        const bottomLineSeries = chart.addLineSeries({
          color: '#a855f7',
          lineWidth: 4,
          lineStyle: 2, // dashed
          title: '박스 하단',
        });
        bottomLineSeries.setData(
          data.candles.map((c: any) => ({ time: c.time, value: boxData.bottom }))
        );

        // 차트 크기 자동 조정
        chart.timeScale().fitContent();

        // ResizeObserver로 리사이즈 처리
        if (chartContainerRef.current) {
          resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || entries[0].target !== chartContainerRef.current) {
              return;
            }
            const newRect = entries[0].contentRect;
            chart.applyOptions({ width: newRect.width });
          });

          resizeObserver.observe(chartContainerRef.current);
        }
      } catch (error) {
        console.error('Chart error:', error);
      } finally {
        isCreatingChart.current = false;
      }
    };

    fetchAndDisplayChart();

    return () => {
      isCreatingChart.current = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isOpen, symbol, exchange, boxData.top, boxData.bottom, boxData.sma50]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              {symbol}
              <span className={`text-xs px-2 py-1 rounded ${
                exchange === 'upbit'
                  ? 'bg-purple-500/10 text-purple-500'
                  : 'bg-blue-500/10 text-blue-500'
              }`}>
                {exchange === 'upbit' ? '업비트' : '빗썸'}
              </span>
            </h2>
            <p className="text-sm text-zinc-400 mt-1">박스권 차트 분석</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chart */}
        <div className="p-4">
          <div ref={chartContainerRef} className="w-full" />
        </div>

        {/* Info */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-zinc-500 mb-1">50SMA (빨)</div>
              <div className="text-red-500 font-medium">₩{boxData.sma50.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">박스 상단</div>
              <div className="text-blue-400 font-medium">₩{boxData.top.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-zinc-500 mb-1">박스 하단</div>
              <div className="text-purple-400 font-medium">₩{boxData.bottom.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
