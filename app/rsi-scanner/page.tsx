'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Header from '../components/Header';
import { useAuth } from '@/contexts/AuthContext';
import type { RsiScanItem, RsiScanResponse } from '../api/rsi-scanner/route';

const ChartModal = dynamic(() => import('./ChartModal'), { ssr: false });

/* ── 유틸 ─────────────────────────────────────────────────────────────── */
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

function formatRemaining(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}시간 ${m}분`;
}

function RsiBadge({ rsi }: { rsi: number }) {
  const color =
    rsi <= 25 ? 'text-blue-400' :
    rsi <= 35 ? 'text-cyan-400' :
    'text-yellow-400';
  const bg =
    rsi <= 25 ? 'bg-blue-500/10 border-blue-500/20' :
    rsi <= 35 ? 'bg-cyan-500/10 border-cyan-500/20' :
    'bg-yellow-500/10 border-yellow-500/20';

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-bold font-mono text-sm ${color} ${bg}`}>
      {rsi.toFixed(1)}
    </div>
  );
}

/* ── 트라이얼 상태 타입 ─────────────────────────────────────────────── */
type TrialStatus =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'no_trial' }
  | { status: 'active'; remainingMs: number; expiresAt: string }
  | { status: 'expired' }
  | { status: 'premium' };

/* ── 접근 제어 게이트 컴포넌트 ─────────────────────────────────────── */
function AccessGate({
  trialStatus,
  onStartTrial,
  starting,
}: {
  trialStatus: TrialStatus;
  onStartTrial: () => void;
  starting: boolean;
}) {
  const { signInWithGoogle } = useAuth();

  if (trialStatus.status === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-400">접근 권한 확인 중...</p>
      </div>
    );
  }

  if (trialStatus.status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-white mb-2">로그인이 필요합니다</h2>
          <p className="text-xs text-zinc-400 mb-1">
            구글 계정으로 로그인하면
          </p>
          <p className="text-sm font-bold text-blue-400 mb-6">
            1일 무료 이용권이 즉시 지급됩니다
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-zinc-100 text-black font-bold rounded-xl text-sm transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Google로 로그인
          </button>
        </div>
      </div>
    );
  }

  if (trialStatus.status === 'no_trial') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-zinc-900 border border-blue-500/30 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold inline-block mb-3">
            첫 방문 혜택
          </div>
          <h2 className="text-base font-bold text-white mb-2">1일 무료 이용권</h2>
          <p className="text-xs text-zinc-400 mb-2">
            RSI+역배열 스캐너를 <strong className="text-white">24시간</strong> 무료로 이용할 수 있습니다.
          </p>
          <p className="text-[10px] text-zinc-600 mb-6">계정당 1회만 사용 가능 · 중복 사용 불가</p>
          <button
            onClick={onStartTrial}
            disabled={starting}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-colors"
          >
            {starting ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                이용권 발급 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                무료 이용권 시작
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  if (trialStatus.status === 'expired') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="bg-zinc-900 border border-yellow-500/20 rounded-2xl p-8 text-center max-w-sm w-full">
          <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-white mb-2">무료 이용권이 만료되었습니다</h2>
          <p className="text-xs text-zinc-400 mb-6">
            1일 무료 이용권을 모두 사용하셨습니다.<br />
            프리미엄으로 업그레이드하면 제한 없이 이용할 수 있습니다.
          </p>
          <Link
            href="/premium"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            프리미엄 업그레이드
          </Link>
        </div>
      </div>
    );
  }

  return null; // active or premium → 스캐너 표시
}

/* ── 메인 ─────────────────────────────────────────────────────────────── */
export default function RsiScannerPage() {
  const { user, isPremium, loading: authLoading } = useAuth();

  const [trialStatus, setTrialStatus] = useState<TrialStatus>({ status: 'loading' });
  const [trialStarting, setTrialStarting] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<RsiScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<RsiScanItem | null>(null);

  /* 트라이얼 상태 로드 */
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setTrialStatus({ status: 'unauthenticated' });
      return;
    }

    if (isPremium) {
      setTrialStatus({ status: 'premium' });
      return;
    }

    fetch(`/api/scanner-trial?uid=${user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'active') {
          setTrialStatus({ status: 'active', remainingMs: data.remainingMs, expiresAt: data.expiresAt });
          setRemainingMs(data.remainingMs);
        } else if (data.status === 'expired') {
          setTrialStatus({ status: 'expired' });
        } else {
          setTrialStatus({ status: 'no_trial' });
        }
      })
      .catch(() => setTrialStatus({ status: 'no_trial' }));
  }, [user, isPremium, authLoading]);

  /* 남은 시간 카운트다운 */
  useEffect(() => {
    if (remainingMs === null) return;
    const interval = setInterval(() => {
      setRemainingMs((prev) => {
        if (prev === null || prev <= 1000) {
          clearInterval(interval);
          setTrialStatus({ status: 'expired' });
          return null;
        }
        return prev - 1000;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingMs]);

  /* 트라이얼 시작 */
  const handleStartTrial = async () => {
    if (!user) return;
    setTrialStarting(true);
    try {
      const res = await fetch('/api/scanner-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid }),
      });
      const data = await res.json();
      if (res.ok) {
        setTrialStatus({ status: 'active', remainingMs: data.remainingMs, expiresAt: data.expiresAt });
        setRemainingMs(data.remainingMs);
      } else {
        if (data.status === 'active') {
          setTrialStatus({ status: 'active', remainingMs: data.remainingMs ?? 0, expiresAt: data.expiresAt });
          setRemainingMs(data.remainingMs ?? 0);
        } else {
          setTrialStatus({ status: 'expired' });
        }
      }
    } catch {
      // 오류 시 다시 확인
    } finally {
      setTrialStarting(false);
    }
  };

  /* 스캔 */
  const handleScan = async () => {
    setIsScanning(true);
    setScanError(null);
    setResult(null);
    try {
      const res = await fetch('/api/rsi-scanner', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setScanError(e?.message || '스캔 중 오류가 발생했습니다');
    } finally {
      setIsScanning(false);
    }
  };

  const canAccess = trialStatus.status === 'active' || trialStatus.status === 'premium';
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* 페이지 헤더 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-blue-500/20 bg-linear-to-br from-zinc-900 via-zinc-900 to-blue-950/20 p-4 sm:p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                1H RSI ≈ 30
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                5M 역배열
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                업비트 · 빗썸 전종목
              </span>
              {trialStatus.status === 'active' && remainingMs !== null && (
                <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                  무료 이용 {formatRemaining(remainingMs)} 남음
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-1.5">
              RSI + 역배열 스캐너
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              <span className="text-blue-400 font-semibold">1시간봉 RSI14가 30 근처(20~40)</span>이면서{' '}
              <span className="text-red-400 font-semibold">5분봉 MA50 &lt; MA110 &lt; MA180 역배열</span> 종목을 표시합니다.
              <br />
              <span className="text-zinc-500">과매도권 진입 + 단기 하락 추세 필터 — 바닥 탐색용 참고 지표</span>
            </p>
          </div>
        </div>

        {/* 접근 게이트 */}
        {!canAccess ? (
          <AccessGate
            trialStatus={trialStatus}
            onStartTrial={handleStartTrial}
            starting={trialStarting}
          />
        ) : (
          <>
            {/* 조건 설명 카드 */}
            <div className="grid grid-cols-2 gap-3 mb-4 sm:mb-6">
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-white">1시간봉 조건</span>
                </div>
                <ul className="text-[10px] sm:text-xs text-zinc-400 space-y-1">
                  <li>• RSI14 ∈ [20, 40] (30 근처)</li>
                  <li>• 과매도권 또는 과매도 직전 구간</li>
                  <li>• Wilder's EMA 방식 계산</li>
                </ul>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-white">5분봉 조건</span>
                </div>
                <ul className="text-[10px] sm:text-xs text-zinc-400 space-y-1">
                  <li>• <span className="text-yellow-400">MA50</span> &lt; <span className="text-orange-400">MA110</span> &lt; <span className="text-red-400">MA180</span></li>
                  <li>• 역배열 = 단기 하락 추세 진행 중</li>
                  <li>• 최근 200봉 기준 계산</li>
                </ul>
              </div>
            </div>

            {/* 스캔 버튼 */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm sm:text-base font-bold text-white">스캔 설정</div>
                  <div className="text-[10px] sm:text-xs text-zinc-500 mt-0.5">
                    업비트 · 빗썸 KRW 전종목 분석 · 소요 약 60~120초
                  </div>
                </div>
                {result && (
                  <div className="text-[10px] sm:text-xs text-zinc-500">
                    {formatTime(result.scannedAt)} 기준
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-base sm:text-xl font-bold text-white">전종목</div>
                  <div className="text-[9px] sm:text-[11px] text-zinc-400">업비트 · 빗썸</div>
                </div>
                <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-base sm:text-xl font-bold text-blue-400">RSI</div>
                  <div className="text-[9px] sm:text-[11px] text-zinc-400">1H RSI14 ≈ 30</div>
                </div>
                <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
                  <div className="text-base sm:text-xl font-bold text-red-400">역배열</div>
                  <div className="text-[9px] sm:text-[11px] text-zinc-400">5M MA50↓110↓180</div>
                </div>
              </div>

              <button
                onClick={handleScan}
                disabled={isScanning}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold py-2.5 sm:py-3 px-4 rounded-lg transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
              >
                {isScanning ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    스캔 중... (1H RSI ≈ 30 + 5M 역배열)
                  </>
                ) : (
                  'RSI + 역배열 스캔 시작'
                )}
              </button>

              {scanError && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-400">{scanError}</p>
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
                      <span className="text-blue-400 font-bold">{result.matchedCount}종목</span> 발견
                    </p>
                  </div>
                  {result.matchedCount > 0 && (
                    <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
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
                    <p className="text-xs text-zinc-600 mt-1">시장 상황에 따라 매칭 종목이 없을 수 있습니다</p>
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
                            <span className="text-blue-400">1H</span> RSI14
                          </th>
                          <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden md:table-cell">
                            <span className="text-red-400">5M</span> 역배열
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.items.map((item) => (
                          <tr
                            key={item.market}
                            onClick={() => setSelectedItem(item)}
                            className="border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors cursor-pointer"
                          >
                            <td className="p-2 sm:p-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                                  <span className="text-[9px] sm:text-xs font-bold text-blue-400">
                                    {item.symbol.slice(0, 2)}
                                  </span>
                                </div>
                                <div>
                                  <div className="text-[11px] sm:text-sm font-semibold text-white">{item.symbol}</div>
                                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                    <span className={`text-[8px] sm:text-[9px] px-1 py-0.5 rounded border font-bold ${
                                      item.exchange === 'upbit'
                                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                                        : 'bg-orange-500/15 text-orange-400 border-orange-500/20'
                                    }`}>
                                      {item.exchange === 'upbit' ? '업비트' : '빗썸'}
                                    </span>
                                    <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">RSI≈30</span>
                                    <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">역배열</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="text-right p-2 sm:p-4">
                              <div className="text-[11px] sm:text-sm font-medium text-white">₩{formatPrice(item.currentPrice)}</div>
                            </td>
                            <td className="text-right p-2 sm:p-4 hidden sm:table-cell">
                              <div className="text-xs text-zinc-400">₩{formatVolume(item.volume)}</div>
                            </td>
                            <td className="text-right p-2 sm:p-4">
                              <RsiBadge rsi={item.rsi14_1h} />
                            </td>
                            <td className="text-right p-2 sm:p-4 hidden md:table-cell">
                              <div className="text-[10px] space-y-0.5 text-right">
                                <div><span className="text-zinc-500">MA50 </span><span className="text-yellow-400 font-mono text-[9px]">{item.ma50_5m.toFixed(item.ma50_5m >= 100 ? 0 : 4)}</span></div>
                                <div><span className="text-zinc-500">MA110 </span><span className="text-orange-400 font-mono text-[9px]">{item.ma110_5m.toFixed(item.ma110_5m >= 100 ? 0 : 4)}</span></div>
                                <div><span className="text-zinc-500">MA180 </span><span className="text-red-400 font-mono text-[9px]">{item.ma180_5m.toFixed(item.ma180_5m >= 100 ? 0 : 4)}</span></div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 차트 모달 */}
            {selectedItem && (
              <ChartModal item={selectedItem} onClose={() => setSelectedItem(null)} />
            )}
          </>
        )}

        {/* 주의사항 */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-2 text-[10px] sm:text-xs text-zinc-400">
            <span className="text-yellow-500 text-sm shrink-0">⚠️</span>
            <div>
              <p className="font-medium text-zinc-300 mb-1">투자 주의사항</p>
              <ul className="text-zinc-500 space-y-0.5">
                <li>• RSI 과매도와 역배열이 동시에 나타나도 추가 하락이 발생할 수 있습니다</li>
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
