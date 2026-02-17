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
    '5m': TimeframeBoxInfo;
    '30m': TimeframeBoxInfo;
    '1h': TimeframeBoxInfo;
    '4h': TimeframeBoxInfo;
    '1d': TimeframeBoxInfo;
  };
}

type TimeframeKey = '5m' | '30m' | '1h' | '4h' | '1d';

const TIMEFRAME_LABELS = {
  '5m': '5분봉',
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
  // 탭별 API 응답 캐시 — 같은 종목에서 탭 전환 시 재fetch 방지
  const dataCache = useRef<Partial<Record<TimeframeKey, any>>>({});

  // symbol/exchange가 바뀌면 캐시 초기화
  useEffect(() => {
    dataCache.current = {};
  }, [symbol, exchange]);

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

        // 캐시 HIT → 로딩 스피너 없이 즉시 차트 렌더링
        let data = dataCache.current[activeTimeframe];
        if (!data) {
          setIsLoading(true);

          // 429 대비 재시도 로직 (최대 3회, 지수 백오프)
          const MAX_RETRIES = 3;
          let lastError: Error | null = null;

          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (attempt > 0) {
              const delay = attempt * 2000; // 2초, 4초
              setError(`요청이 너무 많습니다. ${delay / 1000}초 후 재시도합니다... (${attempt}/${MAX_RETRIES - 1})`);
              await new Promise((res) => setTimeout(res, delay));
              setError(null);
            }

            const response = await fetch(
              `/api/chart?symbol=${symbol}&exchange=${exchange}&timeframe=${activeTimeframe}`
            );
            data = await response.json();

            if (response.status === 429) {
              lastError = new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요. (429)');
              continue; // 재시도
            }

            if (!response.ok || data.error) {
              const errorMsg = data.error || '차트 데이터를 불러오는데 실패했습니다.';
              throw new Error(errorMsg);
            }

            lastError = null;
            break; // 성공
          }

          if (lastError) throw lastError;

          // 성공 시 캐시에 저장
          dataCache.current[activeTimeframe] = data;
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

        // 현재가와 MA값 저장 (매수 시그널 판단용)
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

        // 일목구름 — 선행스팬 A, B + 구름 채우기
        if (data.ichimokuA && data.ichimokuB) {
          // 선행스팬 A (녹색 계열)
          const spanASeries = chart.addLineSeries({
            color: 'rgba(34, 197, 94, 0.8)',
            lineWidth: 1,
            title: '선행A',
            priceLineVisible: false,
            lastValueVisible: false,
          });
          spanASeries.setData(data.ichimokuA);

          // 선행스팬 B (빨간 계열)
          const spanBSeries = chart.addLineSeries({
            color: 'rgba(239, 68, 68, 0.8)',
            lineWidth: 1,
            title: '선행B',
            priceLineVisible: false,
            lastValueVisible: false,
          });
          spanBSeries.setData(data.ichimokuB);

          // 구름 채우기 커스텀 프리미티브
          const spanAMap = new Map<number, number>(
            data.ichimokuA.map((p: any) => [p.time, p.value])
          );
          const spanBMap = new Map<number, number>(
            data.ichimokuB.map((p: any) => [p.time, p.value])
          );
          const sharedTimes = data.ichimokuA
            .map((p: any) => p.time)
            .filter((t: number) => spanBMap.has(t))
            .sort((a: number, b: number) => a - b);

          const cloudPrimitive = {
            attached({ chart: c, series: s }: any) {
              (cloudPrimitive as any)._c = c;
              (cloudPrimitive as any)._s = s;
            },
            updateAllViews() {},
            paneViews() {
              return [{
                renderer: () => ({
                  draw(target: any) {
                    const c = (cloudPrimitive as any)._c;
                    const s = (cloudPrimitive as any)._s;
                    if (!c || !s || sharedTimes.length < 2) return;

                    target.useBitmapCoordinateSpace((scope: any) => {
                      const ctx: CanvasRenderingContext2D = scope.context;
                      const ts = c.timeScale();
                      const hpr = scope.horizontalPixelRatio;
                      const vpr = scope.verticalPixelRatio;

                      const coords = sharedTimes
                        .map((t: number) => {
                          const x  = ts.timeToCoordinate(t as any);
                          const yA = s.priceToCoordinate(spanAMap.get(t)!);
                          const yB = s.priceToCoordinate(spanBMap.get(t)!);
                          if (x === null || yA === null || yB === null) return null;
                          return { x: x * hpr, yA: yA * vpr, yB: yB * vpr };
                        })
                        .filter(Boolean) as { x: number; yA: number; yB: number }[];

                      if (coords.length < 2) return;

                      ctx.save();
                      // 세그먼트별 색상 채우기
                      for (let i = 0; i < coords.length - 1; i++) {
                        const c0 = coords[i];
                        const c1 = coords[i + 1];
                        // 화면좌표에서 yA < yB 이면 SpanA 가격이 더 높음 (상승구름)
                        const bullish = c0.yA < c0.yB;
                        ctx.beginPath();
                        ctx.moveTo(c0.x, c0.yA);
                        ctx.lineTo(c1.x, c1.yA);
                        ctx.lineTo(c1.x, c1.yB);
                        ctx.lineTo(c0.x, c0.yB);
                        ctx.closePath();
                        ctx.fillStyle = bullish
                          ? 'rgba(34, 197, 94, 0.12)'   // 상승구름 — 녹색
                          : 'rgba(239, 68, 68, 0.12)';  // 하락구름 — 빨간색
                        ctx.fill();
                      }
                      ctx.restore();
                    });
                  },
                }),
              }];
            },
          };

          spanASeries.attachPrimitive(cloudPrimitive);
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
        className="bg-zinc-900 rounded-2xl border border-zinc-700/60 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-500/30 flex items-center justify-center">
              <span className="text-amber-400 text-xs font-bold">{symbol.slice(0, 2)}</span>
            </div>
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-white tracking-tight">
                {symbol}
                <span className="ml-2 text-xs font-normal text-zinc-500 tracking-normal">멀티 타임프레임</span>
              </h2>
              <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                {exchange === 'upbit' ? '업비트 (Upbit)' : '빗썸 (Bithumb)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-all text-base"
          >
            ✕
          </button>
        </div>

        {/* Timeframe Tabs */}
        <div className="px-3 sm:px-5 pt-3 sm:pt-4 pb-0 border-b border-zinc-800/60 bg-black/20">
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide">
            {(Object.keys(TIMEFRAME_LABELS) as TimeframeKey[]).map((tf) => {
              const boxInfo = timeframes[tf];
              const isActive = activeTimeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => setActiveTimeframe(tf)}
                  className={`
                    relative flex-none sm:flex-1 min-w-18 sm:min-w-0
                    px-3 sm:px-4 pt-2.5 pb-3.5 rounded-t-xl
                    font-medium transition-all duration-200 text-center
                    border-t border-l border-r
                    ${isActive
                      ? 'bg-zinc-900 border-zinc-700/80 text-white'
                      : boxInfo.hasBox
                      ? 'bg-transparent border-transparent text-zinc-300 hover:bg-zinc-800/40 hover:border-zinc-700/30'
                      : 'bg-transparent border-transparent text-zinc-600 hover:text-zinc-500'
                    }
                  `}
                >
                  {/* 활성 탭 하단 앰버 라인 */}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-amber-400 rounded-full" />
                  )}
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
                      {TIMEFRAME_LABELS[tf]}
                    </span>
                    {boxInfo.hasBox ? (
                      <span className={`inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full
                        ${isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        }`}
                      >
                        <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0" />
                        박스권
                      </span>
                    ) : (
                      <span className="text-[9px] text-zinc-700 px-1.5 py-0.5">미감지</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
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
