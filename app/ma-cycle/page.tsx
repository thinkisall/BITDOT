'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import { getHomeServerUrl } from '@/lib/home-server';

interface BuyPointItem {
  symbol: string;
  exchange: string;
  currentPrice: number;
  ma50: number;
  ma110: number;
  ma180: number;
  priceDiffPct: number;  // 가격과 MA50 이격률 (-0.5% ~ +1.5%)
  slopeRatio: number;    // 기울기 비율 (낮을수록 수평)
  isAboveCloud: boolean; // 일봉 구름 위 여부
  vol24h: number;
  changeRate: number;
}

interface ScanResult {
  items: BuyPointItem[];
  scannedCount: number;
  matchedCount: number;
  scannedAt: string;
  isAnalyzing?: boolean;
  fromCache?: boolean;
  countByExchange?: { upbit: number; bithumb: number; bybit: number };
}

type TabType = 'all' | 'upbit' | 'bithumb' | 'bybit';

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1)    return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  return price.toFixed(6);
}

function formatVolume(vol: number, exchange: string): string {
  if (exchange === 'bybit') {
    if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
    if (vol >= 1_000)     return (vol / 1_000).toFixed(1) + 'K';
    return vol.toFixed(0);
  }
  if (vol >= 100_000_000) return (vol / 100_000_000).toFixed(1) + '억';
  if (vol >= 10_000)      return (vol / 10_000).toFixed(0) + '만';
  return vol.toFixed(0);
}

const EXCHANGE_STYLE: Record<string, { label: string; color: string }> = {
  upbit:   { label: '업비트', color: 'text-emerald-400' },
  bithumb: { label: '빗썸',   color: 'text-blue-400'   },
  bybit:   { label: 'Bybit',  color: 'text-yellow-400' },
};

// 전략 단계 시각화
const STRATEGY_STEPS = [
  { label: '일봉 구름위', color: 'bg-emerald-500' },
  { label: '역배열',      color: 'bg-red-500'     },
  { label: 'MA50 수평화', color: 'bg-cyan-500'    },
  { label: '돌파 신호',   color: 'bg-yellow-400', active: true },
];

export default function MaBuyPointPage() {
  const [result, setResult]           = useState<ScanResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [activeTab, setActiveTab]     = useState<TabType>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getHomeServerUrl('/api/ma-cycle'));
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const data: ScanResult = await res.json();
      setResult(data);
      setLastFetched(new Date());
    } catch (e: any) {
      setError(e.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!result?.isAnalyzing) return;
    const poll = setInterval(fetchData, 10_000);
    return () => clearInterval(poll);
  }, [result?.isAnalyzing, fetchData]);

  const filteredItems = result?.items.filter(
    (item) => activeTab === 'all' || item.exchange === activeTab
  ) ?? [];

  const counts = result?.countByExchange ?? { upbit: 0, bithumb: 0, bybit: 0 };

  const tabs: { key: TabType; label: string; activeColor: string }[] = [
    { key: 'all',     label: `전체 ${result?.matchedCount ?? 0}`, activeColor: 'bg-zinc-700 text-white' },
    { key: 'upbit',   label: `업비트 ${counts.upbit}`,            activeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' },
    { key: 'bithumb', label: `빗썸 ${counts.bithumb}`,            activeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/40' },
    { key: 'bybit',   label: `Bybit ${counts.bybit}`,             activeColor: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">

        {/* 헤더 카드 */}
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">5분봉</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">일봉 구름위</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">MA매수포인트</span>
              </div>
              <h1 className="text-base sm:text-xl font-bold text-white">MA매수포인트 스캐너</h1>
              <p className="text-[11px] sm:text-xs text-zinc-400 mt-1 leading-relaxed">
                일봉 <span className="text-emerald-400">일목구름 위</span> 종목 중,{' '}
                5분봉 <span className="text-red-400">역배열</span>(MA180{'>'}'MA110{'>'}'MA50)에서{' '}
                <span className="text-cyan-400">MA50 ㄴ자 수평화</span> 후{' '}
                <span className="text-yellow-400 font-bold">돌파 신호</span> 포착
              </p>

              {/* 전략 단계 시각화 */}
              <div className="flex items-center gap-1 mt-3 flex-wrap">
                {STRATEGY_STEPS.map((step, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold ${
                      step.active
                        ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 ring-1 ring-yellow-500/30'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${step.color}`} />
                      {step.label}
                    </div>
                    {i < STRATEGY_STEPS.length - 1 && (
                      <svg className="w-3 h-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span className="hidden sm:inline">{loading ? '스캔 중...' : '새로고침'}</span>
            </button>
          </div>

          {result && (
            <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-zinc-500">
              <span>스캔 <span className="text-zinc-300">{result.scannedCount.toLocaleString()}</span></span>
              <span>포착 <span className="text-yellow-400 font-bold">{result.matchedCount}</span></span>
              <span>업비트 <span className="text-emerald-400">{counts.upbit}</span></span>
              <span>빗썸 <span className="text-blue-400">{counts.bithumb}</span></span>
              <span>Bybit <span className="text-yellow-400">{counts.bybit}</span></span>
              {lastFetched && <span>갱신 <span className="text-zinc-300">{lastFetched.toLocaleTimeString('ko-KR')}</span></span>}
              {result.fromCache && <span className="text-yellow-500/70">캐시</span>}
              {result.isAnalyzing && <span className="text-cyan-400 animate-pulse">스캔 중...</span>}
            </div>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 초기 로딩 */}
        {(loading && !result) || result?.isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-8 h-8 animate-spin text-yellow-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-zinc-400">5분봉 + 일봉 전종목 스캔 중...</p>
            <p className="text-xs text-zinc-600">업비트 · 빗썸 · Bybit 전종목 · 일목구름 + MA50 돌파 포착</p>
          </div>
        ) : null}

        {/* 탭 */}
        {result && !result.isAnalyzing && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key ? tab.activeColor : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* 결과 테이블 */}
        {filteredItems.length > 0 && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">

            {/* 모바일 헤더 */}
            <div className="grid grid-cols-[1fr_80px_70px] sm:hidden bg-zinc-900 px-3 py-2 text-[10px] text-zinc-500 font-medium border-b border-zinc-800">
              <span>종목</span>
              <span className="text-right">현재가</span>
              <span className="text-right">이격률</span>
            </div>

            {/* 데스크탑 헤더 */}
            <div className="hidden sm:grid grid-cols-[1fr_95px_80px_80px_80px_70px_60px_70px_70px] bg-zinc-900 px-3 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800">
              <span>종목</span>
              <span className="text-right">현재가</span>
              <span className="text-right text-cyan-400">MA50</span>
              <span className="text-right text-purple-400">MA110</span>
              <span className="text-right text-orange-400">MA180</span>
              <span className="text-right text-yellow-400">이격률</span>
              <span className="text-right text-zinc-400">기울기</span>
              <span className="text-right">거래량</span>
              <span className="text-right">등락률</span>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {filteredItems.map((item, idx) => {
                const exStyle = EXCHANGE_STYLE[item.exchange] ?? { label: item.exchange, color: 'text-zinc-400' };

                // 이격률 색상: 양수(돌파) = 녹색, 근접 = 황색, 살짝 아래 = 주황
                const diffColor =
                  item.priceDiffPct > 0.2  ? 'text-emerald-400' :
                  item.priceDiffPct > -0.1 ? 'text-yellow-400'  : 'text-orange-400';

                // 기울기 비율 색상: 낮을수록 수평 = 좋음
                const slopeColor =
                  item.slopeRatio < 0.2 ? 'text-emerald-400' :
                  item.slopeRatio < 0.4 ? 'text-yellow-400'  : 'text-orange-400';

                const changeColor =
                  item.changeRate > 5  ? 'text-red-400'  :
                  item.changeRate > 0  ? 'text-rose-300' :
                  item.changeRate < -5 ? 'text-blue-400' : 'text-sky-300';

                return (
                  <div
                    key={`${item.exchange}-${item.symbol}`}
                    className="hover:bg-zinc-900/60 active:bg-zinc-800/80 transition-colors"
                  >
                    {/* 모바일 행 */}
                    <div className="grid grid-cols-[1fr_80px_70px] sm:hidden px-3 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-zinc-600 w-4 shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">{item.symbol}</span>
                            {item.isAboveCloud && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">구름위</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] font-medium ${exStyle.color}`}>{exStyle.label}</span>
                            <span className="text-[10px] text-zinc-600">기울기 {Math.round(item.slopeRatio * 100)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right self-center">
                        <div className="text-xs font-medium text-white">{formatPrice(item.currentPrice)}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">MA50 {formatPrice(item.ma50)}</div>
                      </div>
                      <div className="text-right self-center">
                        <span className={`text-sm font-bold ${diffColor}`}>
                          {item.priceDiffPct > 0 ? '+' : ''}{item.priceDiffPct.toFixed(2)}%
                        </span>
                        <div className={`text-[10px] mt-0.5 ${changeColor}`}>
                          {item.changeRate > 0 ? '+' : ''}{item.changeRate.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* 데스크탑 행 */}
                    <div className="hidden sm:grid grid-cols-[1fr_95px_80px_80px_80px_70px_60px_70px_70px] px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-zinc-600 w-5 shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">{item.symbol}</span>
                            {item.isAboveCloud && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">구름위</span>
                            )}
                          </div>
                          <div className={`text-[10px] font-medium ${exStyle.color}`}>{exStyle.label}</div>
                        </div>
                      </div>
                      <div className="text-right self-center text-xs font-medium text-white">{formatPrice(item.currentPrice)}</div>
                      <div className="text-right self-center text-xs text-cyan-400">{formatPrice(item.ma50)}</div>
                      <div className="text-right self-center text-xs text-purple-400">{formatPrice(item.ma110)}</div>
                      <div className="text-right self-center text-xs text-orange-400">{formatPrice(item.ma180)}</div>
                      <div className="text-right self-center">
                        <span className={`text-xs font-bold ${diffColor}`}>
                          {item.priceDiffPct > 0 ? '+' : ''}{item.priceDiffPct.toFixed(2)}%
                        </span>
                      </div>
                      <div className="text-right self-center">
                        <span className={`text-xs ${slopeColor}`}>{Math.round(item.slopeRatio * 100)}%</span>
                      </div>
                      <div className="text-right self-center text-xs text-zinc-400">
                        {formatVolume(item.vol24h, item.exchange)}
                      </div>
                      <div className="text-right self-center">
                        <span className={`text-xs font-bold ${changeColor}`}>
                          {item.changeRate > 0 ? '+' : ''}{item.changeRate.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 결과 없음 */}
        {result && !result.isAnalyzing && filteredItems.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500">
            <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">MA매수포인트를 충족하는 종목이 없습니다.</p>
            <p className="text-xs text-zinc-600">일봉 구름위 + 역배열 + MA50 수평화 + 돌파 신호 동시 충족 종목 없음</p>
          </div>
        )}

        {/* 범례 */}
        <div className="mt-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50 space-y-1.5">
          <p className="text-[10px] text-zinc-500 font-medium">조건 설명</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-600">
            <span><span className="text-emerald-400">구름위</span> — 일봉 일목균형표 선행스팬 A·B 위 (장기 상승 추세)</span>
            <span><span className="text-red-400">역배열</span> — MA180 &gt; MA110 &gt; MA50 (5분봉 눌림 구간)</span>
            <span><span className="text-cyan-400">수평화</span> — MA50 기울기가 55% 이상 감소 (ㄴ자 형태)</span>
            <span><span className="text-yellow-400">이격률</span> — 가격과 MA50 차이: −0.5% ~ +1.5% (돌파 직전·직후)</span>
            <span><span className="text-zinc-400">기울기</span> — 현재 기울기 / 이전 기울기 × 100 (낮을수록 수평)</span>
          </div>
          <p className="text-[10px] text-zinc-600">5분봉 + 일봉 · 업비트 · 빗썸 · Bybit 전종목 · 5분마다 자동 갱신</p>
        </div>

      </main>
    </div>
  );
}
