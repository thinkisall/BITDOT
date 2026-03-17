'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Header from '../components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { useBinanceAlpha } from '@/contexts/BinanceAlphaContext';

// lightweight-charts를 포함한 모달을 lazy load — 초기 번들에서 제외
const MultiTimeframeChartModal = dynamic(
  () => import('../components/MultiTimeframeChartModal'),
  { ssr: false }
);

interface TimeframeBoxInfo {
  hasBox: boolean;
  top?: number;
  bottom?: number;
  score?: number;
  type?: string;
  position?: 'breakout' | 'top' | 'middle' | 'bottom' | 'below';
  positionPercent?: number;
}

interface VolumeSpike {
  time: number;
  timeAgo: string;
  volume: number;
  avgVolume: number;
  ratio: number;
}

interface MultiTimeframeResult {
  symbol: string;
  exchange: 'upbit' | 'bithumb';
  volume: number;
  currentPrice: number;
  changeRate: number;          // 24h 상승률 (%)
  timeframes: {
    '5m': TimeframeBoxInfo;
    '30m': TimeframeBoxInfo;
    '1h': TimeframeBoxInfo;
    '4h': TimeframeBoxInfo;
    '1d': TimeframeBoxInfo;
  };
  boxCount: number;
  allTimeframes: boolean;
  above1hMA50?: boolean;
  above5mMA50?: boolean;
  // MA 현재값 (5m)
  ma50_5m?: number;
  // MA 현재값 (1h)
  ma50_1h?: number;
  ma110_1h?: number;
  ma180_1h?: number;
  vwma110_1h?: number;
  // MA 현재값 (1d)
  ma110?: number;
  vwma110?: number;
  ma180?: number;
  // MA 라이딩 플래그 — 5분봉
  riding5mMA50?: boolean;
  // MA 라이딩 플래그 — 1시간봉
  riding1hMA50?: boolean;
  riding1hMA110?: boolean;
  riding1hMA180?: boolean;
  riding1hVWMA110?: boolean;
  // MA 라이딩 플래그 — 일봉
  ridingMA110?: boolean;
  ridingVWMA110?: boolean;
  ridingMA180?: boolean;
  // 기존 호환
  cloudStatus5m?: 'above' | 'near';
  cloudStatus30m?: 'above' | 'near';
  cloudStatus?: 'above' | 'near';
  cloudStatus4h?: 'above' | 'near';
  volumeSpike?: VolumeSpike;
  isTriggered?: boolean;
  pullbackSignal?: 'TREND_110' | 'SUPPORT_50' | 'SUPPORT_180';
  swingRecovery?: {
    slopeOld: number;
    slopeRecent: number;
    ma50Current: number;
  };
}

interface AnalysisResponse {
  results: MultiTimeframeResult[];
  totalAnalyzed: number;
  foundCount: number;
  cached?: boolean;
  stale?: boolean;
  cacheAge?: number; // 초 단위
  lastUpdated?: number;
  analyzing?: boolean; // 현재 분석 중인지 여부
  message?: string; // 메시지 (캐시 없을 때)
}

export default function AnalysisPage() {
  const { user, isPremium } = useAuth();
  const { isAlpha: isBinanceAlpha } = useBinanceAlpha(); // Context에서 가져오기 (중복 fetch 제거)
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<MultiTimeframeResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);

  // 항상 상대 경로 사용 (Vercel에서는 rewrite로 터널 프록시, 로컬에서는 Next.js API 직접)
  const ANALYSIS_URL = '/api/multi-timeframe';

  // 페이지 마운트 시 자동으로 데이터 가져오기
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(ANALYSIS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data: AnalysisResponse = await response.json();
          setResults(data);
        }
      } catch (e) {
        console.error('Failed to fetch initial data:', e);
      }
    };

    fetchData();
  }, [ANALYSIS_URL]);

  // 자동 갱신: 탭 활성 시 10초, 백그라운드 시 60초 (Visibility API)
  useEffect(() => {
    const shouldAutoRefresh = results && (
      results.totalAnalyzed === 0 ||
      results.analyzing ||
      results.stale
    );

    if (!shouldAutoRefresh) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const doFetch = async () => {
      try {
        const response = await fetch(ANALYSIS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const data: AnalysisResponse = await response.json();
          setResults(data);
        }
      } catch (e) {
        console.error('Auto-refresh failed:', e);
      }
    };

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      const ms = document.visibilityState === 'visible' ? 10_000 : 60_000;
      intervalId = setInterval(doFetch, ms);
    };

    startInterval();
    document.addEventListener('visibilitychange', startInterval);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', startInterval);
    };
  }, [results?.totalAnalyzed, results?.analyzing, results?.stale, ANALYSIS_URL]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const response = await fetch(ANALYSIS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: AnalysisResponse = await response.json();
      setResults(data);
    } catch (e: any) {
      setError(e?.message || '분석 중 오류가 발생했습니다');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatNumber = (num: number, decimals = 0) => {
    return num.toFixed(decimals);
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(2)}B`;
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  };

  const formatCacheAge = (seconds: number) => {
    if (seconds < 60) return `${seconds}초 전`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    return `${hours}시간 ${minutes % 60}분 전`;
  };

  const getTimeframeColor = (tf: TimeframeBoxInfo) => {
    if (!tf.hasBox) return 'bg-zinc-800 text-zinc-500';
    return 'bg-green-500/20 text-green-400 border border-green-500/30';
  };

  const getTimeframeIcon = (tf: TimeframeBoxInfo) => {
    if (!tf.hasBox) return '✗';
    return '✓';
  };

  const getPositionLabel = (position?: string) => {
    switch (position) {
      case 'breakout': return '돌파';
      case 'top': return '상단';
      case 'middle': return '중단';
      case 'bottom': return '하단';
      case 'below': return '이탈';
      default: return '-';
    }
  };

  const getPositionColor = (position?: string) => {
    switch (position) {
      case 'breakout': return 'text-red-400 bg-red-500/20';
      case 'top': return 'text-orange-400 bg-orange-500/20';
      case 'middle': return 'text-yellow-400 bg-yellow-500/20';
      case 'bottom': return 'text-green-400 bg-green-500/20';
      case 'below': return 'text-blue-400 bg-blue-500/20';
      default: return 'text-zinc-500 bg-zinc-800';
    }
  };


  // 검색 필터링
  const filteredResults = results?.results.filter(result =>
    result.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // ─ 섹션 필터 (상승률 top 100 기준 MA 라이딩) ──────────────────────────────
  // 공통 정렬: 상승률 높은 순
  const byChangeRate = (arr: typeof filteredResults) =>
    [...arr].sort((a, b) => (b.changeRate ?? 0) - (a.changeRate ?? 0));

  // 5분봉 MA50 라이딩: 현재가가 5m MA50 바로 위(0~5%)이고 MA50 기울기 양수
  const section5mMA50 = byChangeRate(filteredResults.filter(r => r.riding5mMA50));

  // MA110 라이딩: 현재가가 일봉 MA110 바로 위(0~5%)이고 MA110 기울기 양수
  const sectionMA110 = byChangeRate(filteredResults.filter(r => r.ridingMA110));

  // VWMA110 라이딩: 현재가가 일봉 VWMA110 바로 위(0~5%)이고 VWMA110 기울기 양수
  const sectionVWMA110 = byChangeRate(filteredResults.filter(r => r.ridingVWMA110));

  // MA180 라이딩: 현재가가 일봉 MA180 바로 위(0~5%)이고 MA180 기울기 양수
  const sectionMA180 = byChangeRate(filteredResults.filter(r => r.ridingMA180));

  // ─ 박스권 상단/돌파 섹션 ──────────────────────────────────────────────────
  const TF_ORDER = ['1d', '4h', '1h', '30m', '5m'] as const;
  const isBoxAlert = (r: MultiTimeframeResult, tf: '1h' | '4h') => {
    const p = r.timeframes?.[tf]?.position;
    return p === 'top' || p === 'breakout';
  };
  const sectionBox4h = byChangeRate(filteredResults.filter(r => isBoxAlert(r, '4h')));
  const sectionBox1h = byChangeRate(filteredResults.filter(r => isBoxAlert(r, '1h')));

  // ─ 1시간봉 MA 라이딩 섹션 ──────────────────────────────────────────────────
  const section1hMA50    = byChangeRate(filteredResults.filter(r => r.riding1hMA50));
  const section1hMA110   = byChangeRate(filteredResults.filter(r => r.riding1hMA110));
  const section1hMA180   = byChangeRate(filteredResults.filter(r => r.riding1hMA180));
  const section1hVWMA110 = byChangeRate(filteredResults.filter(r => r.riding1hVWMA110));

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header Section */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">
            멀티 타임프레임 분석
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            30분봉, 1시간봉, 4시간봉, 일봉에서 박스권을 동시에 확인합니다
          </p>
        </div>

        {/* 데이터 로딩 안내 */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="flex items-start gap-2">
            <span className="text-yellow-500 text-base sm:text-lg mt-0.5">⚠️</span>
            <div className="flex-1">
              <p className="text-xs sm:text-sm text-yellow-500 font-medium mb-1">
                데이터 로딩 안내
              </p>
              <p className="text-[10px] sm:text-xs text-zinc-300">
                처음 접속하거나 캐시가 없는 경우, 데이터 분석에 <strong className="text-yellow-500">약 3분 정도</strong> 소요됩니다.
                잠시만 기다려주시면 자동으로 결과가 표시됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* Analysis Settings Card */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">분석 설정</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-zinc-800/50 rounded-lg p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 sm:mb-1">대상</div>
              <div className="text-base sm:text-xl font-bold text-white">전체</div>
              <div className="text-[9px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">종목</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 sm:mb-1">시간대</div>
              <div className="text-base sm:text-xl font-bold text-white">4</div>
              <div className="text-[9px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">개</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 sm:mb-1">30분</div>
              <div className="text-base sm:text-xl font-bold text-yellow-500">✓</div>
              <div className="text-[9px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">분석</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 sm:mb-1">기타</div>
              <div className="text-base sm:text-xl font-bold text-yellow-500">✓</div>
              <div className="text-[9px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">1h/4h/1d</div>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-black font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
          >
            {isAnalyzing
              ? '분석 중...'
              : results
                ? '최신 데이터 불러오기'
                : '멀티 타임프레임 분석 시작'
            }
          </button>

          {error && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-xs sm:text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div ref={resultsRef} className="space-y-4">

            {/* Stats + Cache Status */}
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs sm:text-sm">
                  <span className="text-zinc-400">전체 <span className="text-white font-medium">{results.totalAnalyzed}</span></span>
                  <span className="text-zinc-400">발견 <span className="text-green-500 font-bold">{results.foundCount}</span></span>
                  <span className="text-zinc-400">업비트 <span className="text-purple-400 font-medium">{results.results.filter(r => r.exchange === 'upbit').length}</span></span>
                  <span className="text-zinc-400">빗썸 <span className="text-blue-400 font-medium">{results.results.filter(r => r.exchange === 'bithumb').length}</span></span>
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-zinc-400">
                  {results.totalAnalyzed === 0 ? (
                    <><div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />{results.message || '분석 준비 중...'}</>
                  ) : results.analyzing ? (
                    <><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />백그라운드 분석 중...</>
                  ) : (
                    <><div className="w-2 h-2 rounded-full bg-green-500" />최신 데이터</>
                  )}
                  {results.cacheAge !== undefined && results.totalAnalyzed > 0 && (
                    <><span className="text-zinc-600">•</span>{formatCacheAge(results.cacheAge)}</>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="종목 검색... (예: BTC, ETH)"
                  className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-2 pl-9 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 2x2 Section Grid */}
            {results.totalAnalyzed > 0 && (() => {
              // 공통 코인 행 컴포넌트
              // 박스권 상단/돌파 마커: 각 타임프레임에서 top/breakout인 경우 배지 표시
              const BOX_TF_LABELS: Record<string, string> = {
                '5m': '5분', '30m': '30분', '1h': '1H', '4h': '4H', '1d': '일',
              };
              const getBoxAlertBadges = (result: MultiTimeframeResult) => {
                if (!result.timeframes) return [];
                return (['5m', '30m', '1h', '4h', '1d'] as const)
                  .filter(tf => {
                    const box = result.timeframes?.[tf];
                    return box?.hasBox && (box.position === 'top' || box.position === 'breakout');
                  })
                  .map(tf => ({
                    tf,
                    label: BOX_TF_LABELS[tf],
                    isBreakout: result.timeframes?.[tf]?.position === 'breakout',
                  }));
              };

              const CoinRow = ({ result, maValue, maLabel }: {
                result: MultiTimeframeResult;
                maValue?: number;
                maLabel?: string;
              }) => {
                const cr = result.changeRate ?? 0;
                const distPct = maValue && maValue > 0
                  ? ((result.currentPrice - maValue) / maValue * 100).toFixed(1)
                  : null;
                const boxBadges = getBoxAlertBadges(result);
                return (
                  <div
                    onClick={() => setSelectedCoin(result)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 border-b border-zinc-800/60 hover:bg-zinc-800/40 active:bg-zinc-800/70 cursor-pointer transition-colors last:border-b-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-yellow-500">{result.symbol.slice(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-bold text-white truncate">{result.symbol}</span>
                        {isBinanceAlpha(result.symbol) && (
                          <span className="text-[7px] px-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold shrink-0 leading-tight">A</span>
                        )}
                      </div>
                      <div className="text-[9px] text-zinc-500">{result.exchange === 'upbit' ? '업비트' : '빗썸'}</div>
                    </div>
                    {/* 박스권 상단/돌파 마커 */}
                    {boxBadges.length > 0 && (
                      <div className="hidden sm:flex items-center gap-0.5 shrink-0">
                        {boxBadges.map(({ tf, label, isBreakout }) => (
                          <span
                            key={tf}
                            title={isBreakout ? `${label} 박스권 돌파` : `${label} 박스권 상단`}
                            className={`text-[8px] font-bold px-1 py-0.5 rounded leading-none border ${
                              isBreakout
                                ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                            }`}
                          >
                            {label}{isBreakout ? '↑' : '▲'}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* MA까지 거리 */}
                    {distPct !== null && (
                      <div className="hidden sm:block text-[9px] text-zinc-500 shrink-0">
                        {maLabel} +{distPct}%
                      </div>
                    )}
                    {/* 상승률 */}
                    <div className={`text-[10px] font-bold shrink-0 ${cr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {cr >= 0 ? '+' : ''}{cr.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono shrink-0">
                      ₩{formatNumber(result.currentPrice)}
                    </div>
                  </div>
                );
              };

              // 섹션 카드 헬퍼
              const SectionCard = ({
                title, desc, accent, icon, items, maKey, maLabel, empty,
              }: {
                title: string; desc: string; accent: string; icon: string;
                items: MultiTimeframeResult[];
                maKey?: keyof MultiTimeframeResult;
                maLabel?: string;
                empty?: string;
              }) => (
                <div className="bg-zinc-900 rounded-lg border border-zinc-800 flex flex-col">
                  <div className={`px-2 py-2 sm:p-3 border-b border-zinc-800 ${accent} rounded-t-lg`}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm shrink-0">{icon}</span>
                      <h3 className="text-xs sm:text-sm font-bold text-white flex-1 min-w-0 truncate">{title}</h3>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-bold shrink-0">{items.length}</span>
                    </div>
                    <p className="text-[9px] sm:text-[10px] text-zinc-500 mt-0.5 truncate">{desc}</p>
                  </div>
                  <div className="overflow-y-auto" style={{ maxHeight: '280px' }}>
                    {items.length > 0 ? (
                      items.map(r => (
                        <CoinRow
                          key={`${r.exchange}-${r.symbol}`}
                          result={r}
                          maValue={maKey ? (r[maKey] as number | undefined) : undefined}
                          maLabel={maLabel}
                        />
                      ))
                    ) : (
                      <div className="p-4 text-center text-[10px] text-zinc-500">{empty || '해당 종목 없음'}</div>
                    )}
                  </div>
                </div>
              );

              // 박스권 상단 섹션 전용 row — 해당 타임프레임 위치 배지 표시
              const BoxTopRow = ({ result, tf }: { result: MultiTimeframeResult; tf: '1h' | '4h' }) => {
                const cr = result.changeRate ?? 0;
                const box = result.timeframes?.[tf];
                const isBreakout = box?.position === 'breakout';
                const pct = box?.positionPercent;
                const activeTfs = [tf];
                return (
                  <div
                    onClick={() => setSelectedCoin(result)}
                    className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 border-b border-zinc-800/60 hover:bg-zinc-800/40 active:bg-zinc-800/70 cursor-pointer transition-colors last:border-b-0"
                  >
                    <div className="w-6 h-6 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-bold text-yellow-500">{result.symbol.slice(0, 2)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-xs font-bold text-white truncate">{result.symbol}</span>
                        {isBinanceAlpha(result.symbol) && (
                          <span className="text-[7px] px-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold shrink-0 leading-tight">A</span>
                        )}
                      </div>
                      <div className="text-[9px] text-zinc-500">{result.exchange === 'upbit' ? '업비트' : '빗썸'}</div>
                    </div>
                    {/* 박스 위치 배지 */}
                    <span
                      title={`${BOX_TF_LABELS[tf]} ${isBreakout ? '돌파' : `상단 ${pct != null ? pct.toFixed(0) + '%' : ''}`}`}
                      className={`text-[8px] font-bold px-1 py-0.5 rounded leading-none border shrink-0 ${
                        isBreakout
                          ? 'bg-red-500/20 text-red-400 border-red-500/40'
                          : 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                      }`}
                    >
                      {isBreakout ? '돌파↑' : `상단 ${pct != null ? pct.toFixed(0) + '%' : '▲'}`}
                    </span>
                    <div className={`text-[10px] font-bold shrink-0 ${cr >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {cr >= 0 ? '+' : ''}{cr.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono shrink-0">
                      ₩{formatNumber(result.currentPrice)}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-6">
                  {/* 박스권 상단/돌파 섹션 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">박스권</span>
                      <span className="text-[10px] text-zinc-500">상단(▲) · 돌파(↑)</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {/* 4시간봉 */}
                      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
                        <div className="px-3 py-2 border-b border-zinc-800 border-b-orange-500/30 rounded-t-lg flex items-center gap-2">
                          <span className="text-sm">🎯</span>
                          <h3 className="text-xs sm:text-sm font-bold text-white flex-1">4시간봉 박스권 상단 / 돌파</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-bold">{sectionBox4h.length}</span>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
                          {sectionBox4h.length > 0 ? (
                            sectionBox4h.map(r => <BoxTopRow key={`${r.exchange}-${r.symbol}`} result={r} tf="4h" />)
                          ) : (
                            <div className="p-4 text-center text-[10px] text-zinc-500">해당 종목 없음</div>
                          )}
                        </div>
                      </div>
                      {/* 1시간봉 */}
                      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
                        <div className="px-3 py-2 border-b border-zinc-800 border-b-yellow-500/30 rounded-t-lg flex items-center gap-2">
                          <span className="text-sm">⏱</span>
                          <h3 className="text-xs sm:text-sm font-bold text-white flex-1">1시간봉 박스권 상단 / 돌파</h3>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-bold">{sectionBox1h.length}</span>
                        </div>
                        <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
                          {sectionBox1h.length > 0 ? (
                            sectionBox1h.map(r => <BoxTopRow key={`${r.exchange}-${r.symbol}`} result={r} tf="1h" />)
                          ) : (
                            <div className="p-4 text-center text-[10px] text-zinc-500">해당 종목 없음</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 일봉 MA 라이딩 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">일봉</span>
                      <span className="text-[10px] text-zinc-500">MA110 · VWMA110 · MA180 라이딩</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <SectionCard
                        title="MA110 라이딩"
                        desc="현재가 일봉 MA110 위 0~5% · 기울기 ↑"
                        icon="📈"
                        accent="border-b-blue-500/30"
                        items={sectionMA110}
                        maKey="ma110"
                        maLabel="MA110"
                        empty="조건 충족 종목 없음"
                      />
                      <SectionCard
                        title="VWMA110 라이딩"
                        desc="현재가 일봉 VWMA110 위 0~5% · 기울기 ↑"
                        icon="🔮"
                        accent="border-b-purple-500/30"
                        items={sectionVWMA110}
                        maKey="vwma110"
                        maLabel="VWMA110"
                        empty="조건 충족 종목 없음"
                      />
                      <SectionCard
                        title="MA180 라이딩"
                        desc="현재가 일봉 MA180 위 0~5% · 기울기 ↑"
                        icon="💎"
                        accent="border-b-green-500/30"
                        items={sectionMA180}
                        maKey="ma180"
                        maLabel="MA180"
                        empty="조건 충족 종목 없음"
                      />
                      <SectionCard
                        title="5분봉 MA50 라이딩"
                        desc="현재가 5m MA50 위 0~5% · 기울기 ↑"
                        icon="⚡"
                        accent="border-b-orange-500/30"
                        items={section5mMA50}
                        maKey="ma50_5m"
                        maLabel="MA50"
                        empty="조건 충족 종목 없음"
                      />
                    </div>
                  </div>

                  {/* 1시간봉 MA 라이딩 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">1시간봉</span>
                      <span className="text-[10px] text-zinc-500">MA50 · MA110 · MA180 · VWMA110 라이딩</span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <SectionCard
                        title="1h MA50 라이딩"
                        desc="현재가 1h MA50 위 0~5% · 기울기 ↑"
                        icon="⚡"
                        accent="border-b-orange-400/30"
                        items={section1hMA50}
                        maKey="ma50_1h"
                        maLabel="1h MA50"
                        empty="조건 충족 종목 없음"
                      />
                      <SectionCard
                        title="1h MA110 라이딩"
                        desc="현재가 1h MA110 위 0~5% · 기울기 ↑"
                        icon="📈"
                        accent="border-b-blue-400/30"
                        items={section1hMA110}
                        maKey="ma110_1h"
                        maLabel="1h MA110"
                        empty="조건 충족 종목 없음"
                      />
                      <SectionCard
                        title="1h MA180 라이딩"
                        desc="현재가 1h MA180 위 0~5% · 기울기 ↑"
                        icon="💎"
                        accent="border-b-green-400/30"
                        items={section1hMA180}
                        maKey="ma180_1h"
                        maLabel="1h MA180"
                        empty="조건 충족 종목 없음"
                      />
                      <SectionCard
                        title="1h VWMA110 라이딩"
                        desc="현재가 1h VWMA110 위 0~5% · 기울기 ↑"
                        icon="🔮"
                        accent="border-b-purple-400/30"
                        items={section1hVWMA110}
                        maKey="vwma110_1h"
                        maLabel="1h VWMA110"
                        empty="조건 충족 종목 없음"
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Premium Info Section */}
        {user && (
          <div className={`mt-4 sm:mt-6 p-4 sm:p-6 rounded-lg border ${
            isPremium
              ? 'bg-yellow-500/5 border-yellow-500/30'
              : 'bg-zinc-900 border-zinc-800'
          }`}>
            {isPremium ? (
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-yellow-500 mb-1">
                    프리미엄 회원
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400">
                    모든 페이지의 상위 종목 데이터를 제한 없이 확인하실 수 있습니다
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    프리미엄으로 업그레이드하세요
                  </h3>
                </div>
                <ul className="space-y-2 mb-4 text-xs sm:text-sm text-zinc-400">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">✓</span>
                    <span>1-2페이지의 상위 종목 데이터 무제한 열람</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">✓</span>
                    <span>돌파 확률이 높은 최상위 종목 우선 확인</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">✓</span>
                    <span>실시간 백그라운드 분석 결과 즉시 확인</span>
                  </li>
                </ul>
                <Link
                  href="/premium"
                  className="inline-block w-full sm:w-auto px-6 py-2.5 sm:py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors text-sm sm:text-base text-center"
                >
                  프리미엄 가입하기
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-zinc-400">
            <span className="text-zinc-500 text-sm">💡</span>
            <div className="space-y-2 sm:space-y-3">
              <div>
                <p className="mb-1.5 sm:mb-2 font-medium text-zinc-300">MA 라이딩 분석:</p>
                <ul className="space-y-0.5 sm:space-y-1 text-zinc-500">
                  <li>• 24h 상승률 상위 100종목을 대상으로 분석</li>
                  <li>• <span className="text-orange-400">MA 라이딩</span>: 현재가가 MA 바로 위(0~5%)에 있고 MA 기울기가 양수인 종목</li>
                  <li>• <span className="text-zinc-300">일봉</span>: MA110 · VWMA110 · MA180 · 5분봉 MA50 라이딩</li>
                  <li>• <span className="text-cyan-400">1시간봉</span>: MA50 · MA110 · MA180 · VWMA110 라이딩</li>
                  <li>• <span className="text-zinc-400">VWMA110</span>: 거래량 가중 이동평균 — 거래량이 많은 시점에 더 큰 가중치</li>
                  <li>• 각 섹션의 MA 거리(+X%)는 현재가가 해당 MA보다 얼마나 위에 있는지 표시</li>
                  <li>• 1h MA180은 약 7.5일치 1시간봉 데이터 필요 — 신규 상장 종목은 미표시될 수 있음</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Chart Modal */}
      {selectedCoin && (
        <MultiTimeframeChartModal
          isOpen={!!selectedCoin}
          onClose={() => setSelectedCoin(null)}
          symbol={selectedCoin.symbol}
          exchange={selectedCoin.exchange}
          timeframes={selectedCoin.timeframes}
        />
      )}
    </div>
  );
}
