'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import { getHomeServerUrl } from '@/lib/home-server';
import MaSqueezeChartModal from './components/MaSqueezeChartModal';

interface SqueezeItem {
  symbol: string;
  exchange: string;
  currentPrice: number;
  ma50: number;
  ma110: number;
  ma180: number;
  spreadPct: number;
  vol24h: number;
  changeRate: number;
  priceAboveMa50Pct: number;
}

interface ScanResult {
  items: SqueezeItem[];
  scannedCount: number;
  matchedCount: number;
  scannedAt: string;
  threshold: number;
  isAnalyzing?: boolean;
  fromCache?: boolean;
  countByExchange?: { upbit: number; bithumb: number; bybit: number };
}

type TabType = 'all' | 'upbit' | 'bithumb' | 'bybit';

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  return price.toFixed(6);
}

function formatVolume(vol: number, exchange: string): string {
  if (exchange === 'bybit') {
    if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
    if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
    return vol.toFixed(0);
  }
  if (vol >= 100_000_000) return (vol / 100_000_000).toFixed(1) + '억';
  if (vol >= 10_000) return (vol / 10_000).toFixed(0) + '만';
  return vol.toFixed(0);
}

export default function MaSqueezePage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<SqueezeItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getHomeServerUrl('/api/ma-squeeze'));
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

  const filteredItems = result?.items.filter(
    (item) => activeTab === 'all' || item.exchange === activeTab
  ) ?? [];

  const counts = result?.countByExchange ?? { upbit: 0, bithumb: 0, bybit: 0 };

  const tabs: { key: TabType; label: string; color: string; activeColor: string }[] = [
    { key: 'all',     label: `전체 ${result?.matchedCount ?? 0}`,  color: 'text-zinc-500', activeColor: 'bg-zinc-700 text-white' },
    { key: 'upbit',   label: `업비트 ${counts.upbit}`,             color: 'text-zinc-500', activeColor: 'bg-purple-500/20 text-purple-400 border border-purple-500/40' },
    { key: 'bithumb', label: `빗썸 ${counts.bithumb}`,             color: 'text-zinc-500', activeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/40' },
    { key: 'bybit',   label: `Bybit ${counts.bybit}`,              color: 'text-zinc-500', activeColor: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">

        {/* 헤더 */}
        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  5분봉
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  MA 수렴
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                MA 스퀴즈 스캐너
              </h1>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                5분봉 현재가가 <span className="text-cyan-400">MA50 위</span>에 있으면서,{' '}
                <span className="text-purple-400">MA50·MA110·MA180이 3% 이내로 수렴</span>된 종목 탐지
                — 업비트·빗썸·Bybit 각 300개 스캔
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  스캔 중...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  새로고침
                </>
              )}
            </button>
          </div>

          {/* 스캔 결과 요약 */}
          {result && (
            <div className="mt-3 pt-3 border-t border-zinc-800 flex flex-wrap gap-4 text-xs text-zinc-500">
              <span>스캔: <span className="text-zinc-300">{result.scannedCount.toLocaleString()}개</span></span>
              <span>조건 충족: <span className="text-cyan-400 font-bold">{result.matchedCount}개</span></span>
              <span>수렴 기준: <span className="text-zinc-300">{result.threshold}% 이내</span></span>
              {lastFetched && (
                <span>갱신: <span className="text-zinc-300">{lastFetched.toLocaleTimeString('ko-KR')}</span></span>
              )}
              {result.fromCache && <span className="text-yellow-500/70">캐시</span>}
            </div>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading && !result && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-8 h-8 animate-spin text-cyan-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-zinc-400">전종목 스캔 중... 잠시만 기다려주세요</p>
          </div>
        )}

        {/* 탭 */}
        {result && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
            <div className="grid grid-cols-[1fr_90px_80px_80px_80px_60px_60px_65px] gap-0 bg-zinc-900 px-3 py-2 text-[10px] sm:text-xs text-zinc-500 font-medium border-b border-zinc-800">
              <span>종목</span>
              <span className="text-right">현재가</span>
              <span className="text-right text-cyan-400">MA50</span>
              <span className="text-right text-purple-400">MA110</span>
              <span className="text-right text-orange-400">MA180</span>
              <span className="text-right">수렴도</span>
              <span className="text-right">MA위</span>
              <span className="text-right">등락률</span>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {filteredItems.map((item, idx) => (
                <div
                  key={`${item.exchange}-${item.symbol}`}
                  className="grid grid-cols-[1fr_90px_80px_80px_80px_60px_60px_65px] gap-0 px-3 py-2.5 hover:bg-zinc-900/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-zinc-600 w-5 shrink-0">{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.symbol}</div>
                      <div className={`text-[10px] font-medium ${
                        item.exchange === 'upbit' ? 'text-purple-400' :
                        item.exchange === 'bybit' ? 'text-yellow-400' : 'text-blue-400'
                      }`}>
                        {item.exchange === 'upbit' ? '업비트' : item.exchange === 'bybit' ? 'Bybit' : '빗썸'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right self-center">
                    <div className="text-xs font-medium text-white">{formatPrice(item.currentPrice)}</div>
                  </div>

                  <div className="text-right self-center">
                    <div className="text-xs text-cyan-400">{formatPrice(item.ma50)}</div>
                  </div>

                  <div className="text-right self-center">
                    <div className="text-xs text-purple-400">{formatPrice(item.ma110)}</div>
                  </div>

                  <div className="text-right self-center">
                    <div className="text-xs text-orange-400">{formatPrice(item.ma180)}</div>
                  </div>

                  <div className="text-right self-center">
                    <span className={`text-xs font-bold ${
                      item.spreadPct < 1 ? 'text-green-400' :
                      item.spreadPct < 2 ? 'text-yellow-400' : 'text-zinc-300'
                    }`}>
                      {item.spreadPct}%
                    </span>
                  </div>

                  <div className="text-right self-center">
                    <span className="text-xs text-green-400">+{item.priceAboveMa50Pct}%</span>
                  </div>

                  <div className="text-right self-center">
                    <span className={`text-xs font-bold ${
                      item.changeRate > 5 ? 'text-red-400' :
                      item.changeRate > 0 ? 'text-rose-300' :
                      item.changeRate < -5 ? 'text-blue-400' : 'text-sky-300'
                    }`}>
                      {item.changeRate > 0 ? '+' : ''}{item.changeRate.toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 결과 없음 */}
        {result && filteredItems.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500">
            <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">조건을 충족하는 종목이 없습니다.</p>
            <p className="text-xs text-zinc-600">MA 수렴 기준({result.threshold}%)을 높이거나 나중에 다시 시도해보세요.</p>
          </div>
        )}

        {/* 차트 모달 */}
        {selectedItem && (
          <MaSqueezeChartModal
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            symbol={selectedItem.symbol}
            exchange={selectedItem.exchange}
            ma50={selectedItem.ma50}
            ma110={selectedItem.ma110}
            ma180={selectedItem.ma180}
            currentPrice={selectedItem.currentPrice}
            spreadPct={selectedItem.spreadPct}
          />
        )}

        {/* 범례 */}
        <div className="mt-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            <span className="text-cyan-400">MA50</span> ·{' '}
            <span className="text-purple-400">MA110</span> ·{' '}
            <span className="text-orange-400">MA180</span> — 5분봉 이동평균선 ·{' '}
            <span className="text-white">수렴도</span>: 세 선의 최대-최소 / 평균 비율 (낮을수록 수렴) ·{' '}
            <span className="text-white">MA위</span>: 현재가가 MA50 대비 얼마나 위에 있는지 ·{' '}
            업비트·빗썸·Bybit 거래량 기준 각 300종목 · 5분마다 자동 갱신
          </p>
        </div>

      </main>
    </div>
  );
}
