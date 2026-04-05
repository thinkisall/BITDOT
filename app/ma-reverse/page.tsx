'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import { getHomeServerUrl } from '@/lib/home-server';
import MaReverseChartModal from './components/MaReverseChartModal';

interface ReverseItem {
  symbol: string;
  exchange: string;
  currentPrice: number;
  ma50: number;
  ma110: number;
  ma180: number;
  reversePct: number;
  priceAboveMa50Pct: number;
  vol24h: number;
}

interface ScanResult {
  items: ReverseItem[];
  scannedCount: number;
  matchedCount: number;
  scannedAt: string;
  isAnalyzing?: boolean;
  fromCache?: boolean;
}

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  return price.toFixed(6);
}

function formatVolume(vol: number, exchange: string): string {
  if (exchange === 'bybit') {
    // USDT 기준
    if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
    if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
    return vol.toFixed(0);
  }
  // 빗썸 KRW 기준
  if (vol >= 1_000_000_000) return (vol / 100_000_000).toFixed(1) + '억';
  if (vol >= 100_000_000) return (vol / 100_000_000).toFixed(1) + '억';
  if (vol >= 10_000) return (vol / 10_000).toFixed(0) + '만';
  return vol.toFixed(0);
}

type FilterExchange = 'all' | 'bithumb' | 'bybit';

export default function MaReversePage() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<ReverseItem | null>(null);
  const [filterExchange, setFilterExchange] = useState<FilterExchange>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getHomeServerUrl('/api/ma-reverse'));
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

  const filteredItems = result?.items.filter((item) => {
    if (filterExchange === 'all') return true;
    return item.exchange === filterExchange;
  }) ?? [];

  const bithumbCount = result?.items.filter((i) => i.exchange === 'bithumb').length ?? 0;
  const bybitCount = result?.items.filter((i) => i.exchange === 'bybit').length ?? 0;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">

        {/* 헤더 */}
        <div className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  5분봉
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  역배열
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  MA50 위
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-white">
                MA 역배열 스캐너
              </h1>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                5분봉 <span className="text-red-400">MA50 &lt; MA110 &lt; MA180 역배열</span> 상태에서{' '}
                <span className="text-green-400">현재가가 MA50 위</span>에 있는 종목 탐지 —{' '}
                <span className="text-blue-400">빗썸</span> · <span className="text-yellow-400">Bybit</span> 전종목 스캔
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
              <span>조건 충족: <span className="text-red-400 font-bold">{result.matchedCount}개</span></span>
              <span className="text-blue-400">빗썸 {bithumbCount}개</span>
              <span className="text-yellow-400">Bybit {bybitCount}개</span>
              {lastFetched && (
                <span>갱신: <span className="text-zinc-300">{lastFetched.toLocaleTimeString('ko-KR')}</span></span>
              )}
              {result.fromCache && (
                <span className="text-yellow-500/70">캐시</span>
              )}
            </div>
          )}
        </div>

        {/* 거래소 필터 */}
        {result && (
          <div className="mb-4 flex gap-2">
            {(['all', 'bithumb', 'bybit'] as FilterExchange[]).map((ex) => {
              const labels: Record<FilterExchange, string> = {
                all: `전체 ${result.matchedCount}`,
                bithumb: `빗썸 ${bithumbCount}`,
                bybit: `Bybit ${bybitCount}`,
              };
              const colors: Record<FilterExchange, string> = {
                all: filterExchange === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300',
                bithumb: filterExchange === 'bithumb' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'text-zinc-500 hover:text-zinc-300',
                bybit: filterExchange === 'bybit' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' : 'text-zinc-500 hover:text-zinc-300',
              };
              return (
                <button
                  key={ex}
                  onClick={() => setFilterExchange(ex)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${colors[ex]}`}
                >
                  {labels[ex]}
                </button>
              );
            })}
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {loading && !result && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-8 h-8 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-zinc-400">전종목 스캔 중... 잠시만 기다려주세요</p>
          </div>
        )}

        {/* 결과 테이블 */}
        {filteredItems.length > 0 && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            {/* 테이블 헤더 */}
            <div className="grid grid-cols-[1fr_90px_80px_80px_80px_70px_60px_70px] gap-0 bg-zinc-900 px-3 py-2 text-[10px] sm:text-xs text-zinc-500 font-medium border-b border-zinc-800">
              <span>종목</span>
              <span className="text-right">현재가</span>
              <span className="text-right text-cyan-400">MA50</span>
              <span className="text-right text-purple-400">MA110</span>
              <span className="text-right text-orange-400">MA180</span>
              <span className="text-right">역배열</span>
              <span className="text-right">MA위</span>
              <span className="text-right">거래량</span>
            </div>

            <div className="divide-y divide-zinc-800/60">
              {filteredItems.map((item, idx) => (
                <div
                  key={`${item.exchange}-${item.symbol}`}
                  className="grid grid-cols-[1fr_90px_80px_80px_80px_70px_60px_70px] gap-0 px-3 py-2.5 hover:bg-zinc-900/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedItem(item)}
                >
                  {/* 종목명 */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-zinc-600 w-5 shrink-0">{idx + 1}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.symbol}</div>
                      <span className={`text-[10px] font-medium ${
                        item.exchange === 'bithumb' ? 'text-blue-400' : 'text-yellow-400'
                      }`}>
                        {item.exchange === 'bithumb' ? '빗썸' : 'Bybit'}
                      </span>
                    </div>
                  </div>

                  {/* 현재가 */}
                  <div className="text-right self-center">
                    <div className="text-xs font-medium text-white">{formatPrice(item.currentPrice)}</div>
                  </div>

                  {/* MA50 */}
                  <div className="text-right self-center">
                    <div className="text-xs text-cyan-400">{formatPrice(item.ma50)}</div>
                  </div>

                  {/* MA110 */}
                  <div className="text-right self-center">
                    <div className="text-xs text-purple-400">{formatPrice(item.ma110)}</div>
                  </div>

                  {/* MA180 */}
                  <div className="text-right self-center">
                    <div className="text-xs text-orange-400">{formatPrice(item.ma180)}</div>
                  </div>

                  {/* 역배열 강도 */}
                  <div className="text-right self-center">
                    <span className={`text-xs font-bold ${
                      item.reversePct > 10 ? 'text-red-400' :
                      item.reversePct > 5 ? 'text-orange-400' : 'text-yellow-400'
                    }`}>
                      {item.reversePct}%
                    </span>
                  </div>

                  {/* MA50 위 */}
                  <div className="text-right self-center">
                    <span className="text-xs text-green-400">+{item.priceAboveMa50Pct}%</span>
                  </div>

                  {/* 거래량 */}
                  <div className="text-right self-center">
                    <span className="text-xs text-zinc-300">{formatVolume(item.vol24h, item.exchange)}</span>
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
            <p className="text-xs text-zinc-600">5분 후 자동으로 갱신됩니다.</p>
          </div>
        )}

        {/* 차트 모달 */}
        {selectedItem && (
          <MaReverseChartModal
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            symbol={selectedItem.symbol}
            exchange={selectedItem.exchange}
            ma50={selectedItem.ma50}
            ma110={selectedItem.ma110}
            ma180={selectedItem.ma180}
            currentPrice={selectedItem.currentPrice}
            reversePct={selectedItem.reversePct}
          />
        )}

        {/* 범례 */}
        <div className="mt-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            <span className="text-red-400">역배열</span>: MA50 &lt; MA110 &lt; MA180 순서로 단기 이평이 장기 이평 아래에 위치 ·{' '}
            <span className="text-green-400">MA위</span>: 현재가가 MA50 대비 얼마나 위에 있는지 ·{' '}
            <span className="text-orange-400">역배열 강도</span>: (MA180 − MA50) / MA50 비율 — 클수록 역배열이 심함 ·{' '}
            빗썸(KRW) · Bybit(USDT) 거래량 기준 상위 300종목 · 5분마다 자동 갱신
          </p>
        </div>

      </main>
    </div>
  );
}
