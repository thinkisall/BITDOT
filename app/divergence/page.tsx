'use client';

import { useState } from 'react';
import Header from '../components/Header';
import type { DivergenceItem, DivergenceResponse } from '../api/divergence/route';

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

function RsiDivBadge({ prev, recent }: { prev: number; recent: number }) {
  const diff = prev - recent;
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[10px] sm:text-xs text-zinc-400">
        {prev.toFixed(1)} → <span className="text-red-400 font-semibold">{recent.toFixed(1)}</span>
      </span>
      <span className="text-[9px] sm:text-[10px] text-red-500 font-bold">▼ {diff.toFixed(1)}pt</span>
    </div>
  );
}

export default function DivergencePage() {
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<DivergenceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/divergence', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DivergenceResponse = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e?.message || '스캔 중 오류가 발생했습니다');
    } finally {
      setIsScanning(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 페이지 헤더 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-red-500/20 bg-gradient-to-br from-zinc-900 via-zinc-900 to-red-950/20 p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-red-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                RSI 하락 다이버전스
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                업비트 전종목
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-1.5">
              하락 다이버전스 스캐너
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              <span className="text-red-400 font-semibold">1시간봉</span>과{' '}
              <span className="text-orange-400 font-semibold">5분봉</span> 양쪽에서 동시에
              하락 다이버전스가 발생한 종목만 표시합니다.
              <br />
              <span className="text-zinc-500">가격 고점 ↑ + RSI 고점 ↓ → 추세 약화 신호</span>
            </p>
          </div>
        </div>

        {/* 조건 설명 카드 */}
        <div className="grid grid-cols-2 gap-3 mb-4 sm:mb-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white">1시간봉 조건</span>
            </div>
            <ul className="text-[10px] sm:text-xs text-zinc-400 space-y-1">
              <li>• 가격: 더 높은 고점 (Higher High)</li>
              <li>• RSI: 더 낮은 고점 (Lower High)</li>
              <li>• RSI 차이 최소 2pt 이상</li>
              <li>• 최근 고점이 20봉 이내</li>
            </ul>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
              <span className="text-xs sm:text-sm font-bold text-white">5분봉 조건</span>
            </div>
            <ul className="text-[10px] sm:text-xs text-zinc-400 space-y-1">
              <li>• 가격: 더 높은 고점 (Higher High)</li>
              <li>• RSI: 더 낮은 고점 (Lower High)</li>
              <li>• RSI 차이 최소 2pt 이상</li>
              <li>• 최근 고점이 30봉(2.5시간) 이내</li>
            </ul>
          </div>
        </div>

        {/* 스캔 버튼 */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm sm:text-base font-bold text-white">스캔 설정</div>
              <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                업비트 KRW 전종목 분석 · 소요 약 60~120초
              </div>
            </div>
            <div className="text-right">
              {result && (
                <div className="text-[10px] sm:text-xs text-zinc-500">
                  {formatTime(result.scannedAt)} 기준
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
            <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-base sm:text-xl font-bold text-white">전종목</div>
              <div className="text-[9px] sm:text-[11px] text-zinc-400">업비트 KRW</div>
            </div>
            <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-base sm:text-xl font-bold text-red-400">1H</div>
              <div className="text-[9px] sm:text-[11px] text-zinc-400">1시간봉 RSI</div>
            </div>
            <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
              <div className="text-base sm:text-xl font-bold text-orange-400">5M</div>
              <div className="text-[9px] sm:text-[11px] text-zinc-400">5분봉 RSI</div>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full bg-red-500 hover:bg-red-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-2.5 sm:py-3 px-4 rounded-lg transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
          >
            {isScanning ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                스캔 중... (업비트 전종목 × 2개 시간대)
              </>
            ) : (
              '하락 다이버전스 스캔 시작'
            )}
          </button>

          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-xs sm:text-sm text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* 결과 */}
        {result && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
            <div className="p-3 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">스캔 결과</h2>
                <p className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                  {result.scannedCount}종목 중{' '}
                  <span className="text-red-400 font-bold">{result.matchedCount}종목</span> 발견
                </p>
              </div>
              {result.matchedCount > 0 && (
                <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                  {result.matchedCount}개 매칭
                </span>
              )}
            </div>

            {result.matchedCount === 0 ? (
              <div className="p-8 sm:p-12 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500">현재 조건에 맞는 종목이 없습니다</p>
                <p className="text-xs text-zinc-600 mt-1">
                  1시간봉과 5분봉 동시 하락 다이버전스는 드문 현상입니다
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/80">
                      <th className="text-left text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">종목</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">현재가</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden sm:table-cell">거래대금</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">
                        <span className="text-red-400">1H</span> RSI
                      </th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden md:table-cell">
                        <span className="text-orange-400">5M</span> RSI
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr
                        key={item.market}
                        className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors"
                      >
                        {/* 종목 */}
                        <td className="p-2 sm:p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[9px] sm:text-xs font-bold text-red-400">
                                {item.symbol.slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="text-[11px] sm:text-sm font-semibold text-white">
                                {item.symbol}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                                  1H다이버
                                </span>
                                <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">
                                  5M다이버
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 현재가 */}
                        <td className="text-right p-2 sm:p-4">
                          <div className="text-[11px] sm:text-sm font-medium text-white">
                            ₩{formatPrice(item.currentPrice)}
                          </div>
                        </td>

                        {/* 거래대금 */}
                        <td className="text-right p-2 sm:p-4 hidden sm:table-cell">
                          <div className="text-xs text-zinc-400">
                            ₩{formatVolume(item.volume)}
                          </div>
                        </td>

                        {/* 1H RSI 다이버전스 */}
                        <td className="text-right p-2 sm:p-4">
                          <RsiDivBadge prev={item.h1PrevRsi} recent={item.h1RecentRsi} />
                        </td>

                        {/* 5M RSI 다이버전스 */}
                        <td className="text-right p-2 sm:p-4 hidden md:table-cell">
                          <RsiDivBadge prev={item.m5PrevRsi} recent={item.m5RecentRsi} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 주의사항 */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-2 text-[10px] sm:text-xs text-zinc-400">
            <span className="text-yellow-500 text-sm flex-shrink-0">⚠️</span>
            <div>
              <p className="font-medium text-zinc-300 mb-1">투자 주의사항</p>
              <ul className="text-zinc-500 space-y-0.5">
                <li>• 하락 다이버전스는 추세 약화 신호이나 반드시 하락을 보장하지 않습니다</li>
                <li>• 단독 지표로 매매 결정하지 마시고 다른 지표와 함께 참고하세요</li>
                <li>• 이 정보는 투자 권유가 아닌 참고용 분석 데이터입니다</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
