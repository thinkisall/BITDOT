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
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<{ currentPrice: number; ma50: number } | null>(null);
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
        setError(null);
        setIsLoading(true);

        // API에서 해당 시간대 캔들 데이터 가져오기
        const response = await fetch(
          `/api/chart?symbol=${symbol}&exchange=${exchange}&timeframe=${activeTimeframe}`
        );

        const data = await response.json();

        if (!response.ok || data.error) {
          const errorMsg = data.error || '차트 데이터를 불러오는데 실패했습니다.';
          console.error('Chart API error:', errorMsg, { symbol, exchange, timeframe: activeTimeframe });
          throw new Error(errorMsg);
        }

        if (!data.candles || data.candles.length === 0) {
          setError('차트 데이터가 없습니다. 잠시 후 다시 시도해주세요.');
          setIsLoading(false);
          isCreatingChart.current = false;
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

        // 현재가와 MA50 값 저장 (매수 시그널 판단용)
        const currentPrice = data.candles[data.candles.length - 1]?.close;
        const ma50Value = data.sma50?.[data.sma50.length - 1]?.value;
        if (currentPrice && ma50Value) {
          setChartData({ currentPrice, ma50: ma50Value });
        } else {
          setChartData(null);
        }

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

        if (data.sma110) {
          const sma110Series = chart.addLineSeries({
            color: '#eab308',
            lineWidth: 2,
            title: 'MA110',
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sma110Series.setData(data.sma110);
        }

        if (data.sma180) {
          const sma180Series = chart.addLineSeries({
            color: '#f97316',
            lineWidth: 2,
            title: 'MA180',
            priceLineVisible: false,
            lastValueVisible: false,
          });
          sma180Series.setData(data.sma180);
        }

        // Bollinger Bands
        if (data.bollingerBands) {
          // Upper Band
          const bbUpperSeries = chart.addLineSeries({
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: 'BB Upper',
            priceLineVisible: false,
            lastValueVisible: false,
          });
          bbUpperSeries.setData(
            data.bollingerBands.map((bb: any) => ({ time: bb.time, value: bb.upper }))
          );

          // Lower Band
          const bbLowerSeries = chart.addLineSeries({
            color: '#8b5cf6',
            lineWidth: 1,
            lineStyle: 2, // dashed
            title: 'BB Lower',
            priceLineVisible: false,
            lastValueVisible: false,
          });
          bbLowerSeries.setData(
            data.bollingerBands.map((bb: any) => ({ time: bb.time, value: bb.lower }))
          );
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
      } catch (error: any) {
        console.error('Error fetching chart data:', error);
        setError(error?.message || '차트를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
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
        <div className="flex gap-1 sm:gap-2 p-3 sm:p-4 border-b border-zinc-800 overflow-x-auto scrollbar-hide">
          {(Object.keys(TIMEFRAME_LABELS) as TimeframeKey[]).map((tf) => {
            const boxInfo = timeframes[tf];
            const isActive = activeTimeframe === tf;
            return (
              <button
                key={tf}
                onClick={() => setActiveTimeframe(tf)}
                className={`
                  flex-none w-[90px] sm:w-auto sm:flex-1 sm:min-w-[110px] px-2 sm:px-4 py-2 sm:py-3 rounded-lg font-medium text-xs sm:text-sm transition-all
                  ${isActive
                    ? 'bg-yellow-500 text-black'
                    : boxInfo.hasBox
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }
                `}
              >
                <div className="flex flex-col items-center gap-0.5 sm:gap-1">
                  <span className="whitespace-nowrap">{TIMEFRAME_LABELS[tf]}</span>
                  <span className="text-[10px] sm:text-xs whitespace-nowrap">
                    {boxInfo.hasBox ? '✓ 박스권' : '−'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chart Container */}
        <div className="flex-1 p-3 sm:p-6 overflow-auto">
          {/* 매수 시그널 - 1시간봉 50선 근처 (차트 위) */}
          {activeTimeframe === '1h' && chartData && (() => {
            const diff = Math.abs(chartData.currentPrice - chartData.ma50);
            const diffPercent = (diff / chartData.ma50) * 100;
            const isNearMA50 = diffPercent <= 1; // ±1% 이내

            if (isNearMA50) {
              return (
                <div className="mb-4 p-3 sm:p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg sm:text-xl">✓</span>
                    <h3 className="text-sm sm:text-base font-bold text-green-500">매수 가능 구간</h3>
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-300 space-y-1">
                    <p>현재가가 50일 이동평균선 근처에 위치해 있습니다.</p>
                    <div className="flex items-center gap-3 sm:gap-4 mt-2 text-[10px] sm:text-xs flex-wrap">
                      <div>
                        <span className="text-zinc-500">현재가:</span>
                        <span className="text-white font-medium ml-1">₩{chartData.currentPrice.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">MA50:</span>
                        <span className="text-red-400 font-medium ml-1">₩{chartData.ma50.toFixed(0)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">차이:</span>
                        <span className="text-yellow-400 font-medium ml-1">{diffPercent.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* 차트 컨테이너 (항상 렌더링) */}
          <div className="relative">
            <div ref={chartContainerRef} className="w-full" />

            {/* 로딩 오버레이 */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-lg">
                <div className="text-zinc-400 text-sm">차트 로딩 중...</div>
              </div>
            )}

            {/* 에러 오버레이 */}
            {error && !isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-lg">
                <div className="text-center">
                  <div className="text-red-500 text-sm mb-2">⚠️ {error}</div>
                  <button
                    onClick={() => {
                      setError(null);
                      setActiveTimeframe(activeTimeframe); // 재시도
                    }}
                    className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            )}
          </div>

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
