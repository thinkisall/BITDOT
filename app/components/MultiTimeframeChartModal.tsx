'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart } from 'lightweight-charts';

interface TimeframeBoxInfo {
  hasBox: boolean;
  top?: number;
  bottom?: number;
  position?: 'breakout' | 'top' | 'middle' | 'bottom' | 'below';
  positionPercent?: number;
}

interface MultiTimeframeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  exchange: 'upbit' | 'bithumb';
  timeframes: {
    '30m': TimeframeBoxInfo;
    '1h': TimeframeBoxInfo;
    '4h': TimeframeBoxInfo;
    '1d': TimeframeBoxInfo;
  };
}

type TimeframeKey = '30m' | '1h' | '4h' | '1d';

const TIMEFRAME_LABELS = {
  '30m': '30분봉',
  '1h': '1시간봉',
  '4h': '4시간봉',
  '1d': '일봉',
};

const getPositionLabel = (position?: string) => {
  switch (position) {
    case 'breakout': return '돌파 완료';
    case 'top': return '상단 구간';
    case 'middle': return '중단 구간';
    case 'bottom': return '하단 구간';
    case 'below': return '하단 이탈';
    default: return '-';
  }
};

const getPositionColor = (position?: string) => {
  switch (position) {
    case 'breakout': return 'text-red-400';
    case 'top': return 'text-orange-400';
    case 'middle': return 'text-yellow-400';
    case 'bottom': return 'text-green-400';
    case 'below': return 'text-blue-400';
    default: return 'text-zinc-500';
  }
};

export default function MultiTimeframeChartModal({
  isOpen,
  onClose,
  symbol,
  exchange,
  timeframes,
}: MultiTimeframeChartModalProps) {
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>('1h');
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const isCreatingChart = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    // 기존 차트 정리
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    if (chartContainerRef.current) {
      chartContainerRef.current.innerHTML = '';
    }

    let resizeObserver: ResizeObserver | null = null;

    const fetchAndDisplayChart = async () => {
      if (isCreatingChart.current) return;
      isCreatingChart.current = true;

      try {
        // API에서 해당 시간대 캔들 데이터 가져오기
        const response = await fetch(
          `/api/chart?symbol=${symbol}&exchange=${exchange}&timeframe=${activeTimeframe}`
        );
        const data = await response.json();

        if (!data.candles || data.candles.length === 0) {
          console.error('No candle data received');
          return;
        }

        if (!chartContainerRef.current) return;

        // 차트 생성
        const chart = createChart(chartContainerRef.current, {
          width: chartContainerRef.current.clientWidth,
          height: 450,
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

        candlestickSeries.setData(data.candles);

        // 이동평균선 (있는 경우)
        if (data.sma50) {
          const sma50Series = chart.addLineSeries({
            color: '#ef4444',
            lineWidth: 2,
            title: 'MA50',
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sma50Series.setData(data.sma50);
        }

        // 박스권이 있는 경우 표시
        const boxInfo = timeframes[activeTimeframe];
        if (boxInfo.hasBox && boxInfo.top && boxInfo.bottom) {
          // 박스 상단 라인
          const topLineSeries = chart.addLineSeries({
            color: '#3b82f6',
            lineWidth: 3,
            lineStyle: 2, // dashed
            title: '박스 상단',
          });
          topLineSeries.setData(
            data.candles.map((c: any) => ({ time: c.time, value: boxInfo.top }))
          );

          // 박스 하단 라인
          const bottomLineSeries = chart.addLineSeries({
            color: '#f97316',
            lineWidth: 3,
            lineStyle: 2, // dashed
            title: '박스 하단',
          });
          bottomLineSeries.setData(
            data.candles.map((c: any) => ({ time: c.time, value: boxInfo.bottom }))
          );
        }

        chart.timeScale().fitContent();

        // ResizeObserver
        if (chartContainerRef.current) {
          resizeObserver = new ResizeObserver((entries) => {
            if (!chartRef.current || !chartContainerRef.current) return;
            const { width } = entries[0].contentRect;
            chartRef.current.applyOptions({ width });
          });
          resizeObserver.observe(chartContainerRef.current);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
      } finally {
        isCreatingChart.current = false;
      }
    };

    fetchAndDisplayChart();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [isOpen, activeTimeframe, symbol, exchange]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-base sm:text-xl font-bold text-white mb-1">
              {symbol} 멀티 타임프레임 분석
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              {exchange === 'upbit' ? '업비트' : '빗썸'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors text-xl sm:text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Timeframe Tabs */}
        <div className="flex gap-1 sm:gap-2 p-3 sm:p-4 border-b border-zinc-800 overflow-x-auto">
          {(Object.keys(TIMEFRAME_LABELS) as TimeframeKey[]).map((tf) => {
            const boxInfo = timeframes[tf];
            const isActive = activeTimeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                className={`
                  flex-1 min-w-[70px] sm:min-w-[100px] px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium text-xs sm:text-sm transition-all
                  ${isActive
                    ? 'bg-yellow-500 text-black'
                    : boxInfo.hasBox
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                  <span>{TIMEFRAME_LABELS[tf]}</span>
                  <span className="text-[10px] sm:text-xs">
                    {boxInfo.hasBox ? '✓ 박스권' : '−'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chart Container */}
        <div className="flex-1 p-3 sm:p-6 overflow-auto">
          <div ref={chartContainerRef} className="w-full" />

          {/* Box Info */}
          {timeframes[activeTimeframe].hasBox && (
            <div className="mt-4 p-3 sm:p-4 bg-zinc-800/50 rounded-lg">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">박스 상단</div>
                  <div className="text-sm sm:text-lg font-bold text-blue-400">
                    ₩{timeframes[activeTimeframe].top?.toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">박스 하단</div>
                  <div className="text-sm sm:text-lg font-bold text-orange-400">
                    ₩{timeframes[activeTimeframe].bottom?.toFixed(0)}
                  </div>
                </div>
                {timeframes[activeTimeframe].position && (
                  <div className="col-span-2 sm:col-span-1">
                    <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">가격 위치</div>
                    <div className={`text-sm sm:text-lg font-bold ${getPositionColor(timeframes[activeTimeframe].position)}`}>
                      {getPositionLabel(timeframes[activeTimeframe].position)}
                      {timeframes[activeTimeframe].positionPercent !== undefined && (
                        <span className="text-xs sm:text-sm ml-1.5 text-zinc-400">
                          ({timeframes[activeTimeframe].positionPercent}%)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!timeframes[activeTimeframe].hasBox && (
            <div className="mt-4 p-3 sm:p-4 bg-zinc-800/50 rounded-lg text-center">
              <p className="text-xs sm:text-sm text-zinc-400">
                이 시간대에서는 박스권이 감지되지 않았습니다
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
