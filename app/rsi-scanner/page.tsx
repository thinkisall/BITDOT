'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import Header from '../components/Header';
import { getHomeServerUrl } from '@/lib/home-server';
import { useAuth } from '@/contexts/AuthContext';
import type { MaTrendScanItem, MaTrendScanResponse } from '../api/rsi-scanner/route';

/* ── 유틸 ─────────────────────────────────────────────────────────────── */
function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

function formatVolume(v: number): string {
  if (v >= 1_000_000_000_000) return `${(v / 1_000_000_000_000).toFixed(1)}조`;
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(0)}억`;
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`;
  return v.toLocaleString('ko-KR');
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatMa(v: number): string {
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/* ── 정배열 강도 계산 ─────────────────────────────────────────────────── */
function maStrength(item: MaTrendScanItem): number {
  return ((item.ma50_1h - item.ma180_1h) / item.ma180_1h) * 100;
}

/* ── 구름 위 여유율 ───────────────────────────────────────────────────── */
function cloudMargin(item: MaTrendScanItem): number {
  return ((item.currentPrice - item.cloudTop_4h) / item.cloudTop_4h) * 100;
}

/* ── 종목 카드 ────────────────────────────────────────────────────────── */
function SignalCard({ item }: { item: MaTrendScanItem }) {
  const strength = maStrength(item);
  const margin = cloudMargin(item);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4 hover:border-emerald-500/40 transition-colors">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-emerald-400">
              {item.symbol.slice(0, 2)}
            </span>
          </div>
          <div>
            <div className="text-sm font-bold text-white">{item.symbol}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border ${
                item.exchange === 'upbit'
                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                  : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
              }`}>
                {item.exchange === 'upbit' ? '업비트' : '빗썸'}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold text-white">₩{formatPrice(item.currentPrice)}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">₩{formatVolume(item.volume)}</div>
        </div>
      </div>

      {/* 정배열 강도 바 */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-zinc-500">1H 정배열 강도</span>
          <span className="text-emerald-400 font-bold">+{strength.toFixed(2)}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-linear-to-r from-emerald-500 to-cyan-400 rounded-full"
            style={{ width: `${Math.min(strength * 5, 100)}%` }}
          />
        </div>
      </div>

      {/* MA 테이블 */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {/* 1시간봉 */}
        <div className="rounded-lg bg-zinc-800/60 p-2">
          <div className="text-[9px] text-zinc-500 font-medium mb-1.5">1시간봉 MA</div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-emerald-400 font-bold">MA50</span>
              <span className="text-[9px] font-mono text-zinc-300">{formatMa(item.ma50_1h)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-cyan-400 font-bold">MA110</span>
              <span className="text-[9px] font-mono text-zinc-300">{formatMa(item.ma110_1h)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-blue-400 font-bold">MA180</span>
              <span className="text-[9px] font-mono text-zinc-300">{formatMa(item.ma180_1h)}</span>
            </div>
          </div>
        </div>
        {/* 4시간봉 */}
        <div className="rounded-lg bg-zinc-800/60 p-2">
          <div className="text-[9px] text-zinc-500 font-medium mb-1.5">4시간봉 MA</div>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-emerald-400 font-bold">MA50</span>
              <span className="text-[9px] font-mono text-zinc-300">{formatMa(item.ma50_4h)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-cyan-400 font-bold">MA110</span>
              <span className="text-[9px] font-mono text-zinc-300">{formatMa(item.ma110_4h)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-blue-400 font-bold">MA180</span>
              <span className="text-[9px] font-mono text-zinc-300">{formatMa(item.ma180_4h)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 일목구름 정보 */}
      <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/20 p-2 flex items-center justify-between">
        <div className="text-[9px] text-zinc-400">
          4H 구름 상단 <span className="text-zinc-300 font-mono">{formatMa(item.cloudTop_4h)}</span>
        </div>
        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
          +{margin.toFixed(1)}% 위
        </span>
      </div>
    </div>
  );
}

/* ── 메인 ─────────────────────────────────────────────────────────────── */
export default function MaTrendScannerPage() {
  const { user, isPremium, loading: authLoading } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<MaTrendScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(getHomeServerUrl('/api/ma-trend'), { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setError(e?.message || '스캔 중 오류가 발생했습니다');
    } finally {
      setIsScanning(false);
    }
  }, []);

  // 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  // 비로그인 또는 비프리미엄
  if (!user || !isPremium) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {/* 페이지 헤더 (잠금 상태) */}
          <div className="mb-4 sm:mb-6 rounded-xl border border-emerald-500/20 bg-linear-to-br from-zinc-900 via-zinc-900 to-emerald-950/20 p-4 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">1H 정배열</span>
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">4H 정배열</span>
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">4H 일목구름 위</span>
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">🔒 프리미엄 전용</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-white mb-1.5">MA 정배열 + 일목구름 스캐너</h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                1H·4H 정배열 + 4H 일목구름 위 조건을 동시에 충족하는 종목을 탐색합니다.
              </p>
            </div>
          </div>

          {/* 잠금 안내 */}
          <div className="rounded-2xl border border-yellow-500/20 bg-zinc-900 p-8 sm:p-12 flex flex-col items-center text-center">
            <div className="p-4 rounded-full bg-yellow-500/10 border border-yellow-500/20 mb-4">
              <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white mb-2">프리미엄 전용 페이지</h2>
            <p className="text-xs sm:text-sm text-zinc-400 mb-1 leading-relaxed">
              MA 정배열 + 일목구름 스캐너는 프리미엄 구독자만 이용할 수 있습니다.
            </p>
            <p className="text-[10px] sm:text-xs text-zinc-500 mb-6">
              {!user ? '로그인 후 프리미엄을 구독하면 이용 가능합니다.' : '프리미엄을 구독하면 이용 가능합니다.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              {!user && (
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-zinc-600 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-semibold transition-colors"
                >
                  로그인
                </Link>
              )}
              <Link
                href="/premium"
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                프리미엄 구독하기
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* 페이지 헤더 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-emerald-500/20 bg-linear-to-br from-zinc-900 via-zinc-900 to-emerald-950/20 p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                1H 정배열
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                4H 정배열
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                4H 일목구름 위
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 border border-zinc-600">
                업비트 · 빗썸 전종목
              </span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-1.5">
              MA 정배열 + 일목구름 스캐너
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              <span className="text-emerald-400 font-semibold">1시간봉 MA50 &gt; MA110 &gt; MA180</span>{' '}
              정배열이면서{' '}
              <span className="text-cyan-400 font-semibold">4시간봉 MA50 &gt; MA110 &gt; MA180</span>{' '}
              정배열이고{' '}
              <span className="text-blue-400 font-semibold">4시간봉 일목구름 위</span>에 있는 종목을 찾습니다.
            </p>
          </div>
        </div>

        {/* 조건 카드 3개 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold text-white">1시간봉</span>
            </div>
            <div className="space-y-1 text-[9px] sm:text-[10px]">
              <div><span className="text-emerald-400 font-bold">MA50</span> <span className="text-zinc-500">&gt;</span> <span className="text-cyan-400 font-bold">MA110</span> <span className="text-zinc-500">&gt;</span> <span className="text-blue-400 font-bold">MA180</span></div>
              <div className="text-zinc-500">단기·중기·장기 정배열</div>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold text-white">4시간봉</span>
            </div>
            <div className="space-y-1 text-[9px] sm:text-[10px]">
              <div><span className="text-emerald-400 font-bold">MA50</span> <span className="text-zinc-500">&gt;</span> <span className="text-cyan-400 font-bold">MA110</span> <span className="text-zinc-500">&gt;</span> <span className="text-blue-400 font-bold">MA180</span></div>
              <div className="text-zinc-500">중기 추세도 정배열</div>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <span className="text-[10px] sm:text-xs font-bold text-white">일목구름</span>
            </div>
            <div className="space-y-1 text-[9px] sm:text-[10px]">
              <div className="text-zinc-300">현재가 <span className="text-zinc-500">&gt;</span> <span className="text-blue-400 font-bold">구름 상단</span></div>
              <div className="text-zinc-500">4H 구름 돌파 확인</div>
            </div>
          </div>
        </div>

        {/* 스캔 버튼 */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
          >
            {isScanning ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                스캔 중... (1~2분 소요)
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {result ? '다시 스캔' : '스캔 시작'}
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* 결과 */}
        {result && (
          <>
            {/* 요약 바 */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="text-sm text-zinc-400">
                <span className="text-zinc-500">{result.scannedCount}종목 스캔 →</span>{' '}
                <span className="text-emerald-400 font-bold">{result.matchedCount}종목</span> 조건 충족
              </div>
              <div className="text-[10px] text-zinc-600">{formatTime(result.scannedAt)} 기준</div>
            </div>

            {result.matchedCount === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500">현재 조건에 맞는 종목이 없습니다</p>
                <p className="text-xs text-zinc-600 mt-1">1H + 4H 정배열 + 4H 구름 위 조건은 강세장에서만 충족됩니다</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.items.map((item) => (
                  <SignalCard key={item.market} item={item} />
                ))}
              </div>
            )}
          </>
        )}

        {/* 주의사항 */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-2 text-[10px] sm:text-xs text-zinc-400">
            <span className="text-yellow-500 shrink-0">⚠️</span>
            <div>
              <p className="font-medium text-zinc-300 mb-1">투자 주의사항</p>
              <ul className="text-zinc-500 space-y-0.5">
                <li>• 정배열은 상승 추세의 확인 지표이며 고점 근처일 수 있습니다</li>
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
