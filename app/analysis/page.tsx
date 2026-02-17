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
  timeframes: {
    '5m': TimeframeBoxInfo;
    '30m': TimeframeBoxInfo;
    '1h': TimeframeBoxInfo;
    '4h': TimeframeBoxInfo;
    '1d': TimeframeBoxInfo;
  };
  boxCount: number;
  allTimeframes: boolean;
  volumeSpike?: VolumeSpike;
  watchlist?: {
    isUptrend: boolean;
    slope: number;
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
  const [currentPage, setCurrentPage] = useState(1);
  const resultsRef = useRef<HTMLDivElement>(null);

  const ITEMS_PER_PAGE = 20;
  const PREMIUM_REQUIRED_PAGES = [1, 2]; // 1, 2페이지는 프리미엄 필요

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

  // 검색어 변경 시 페이지 초기화
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageResults = filteredResults.slice(startIndex, endIndex);

  // 페이지 변경 및 스크롤
  const handlePageChange = (page: number) => {
    // 프리미엄 필요한 페이지 체크
    if (PREMIUM_REQUIRED_PAGES.includes(page) && !isPremium) {
      // 프리미엄 아니면 페이지 변경하지 않음 (업그레이드 안내 표시)
      return;
    }

    setCurrentPage(page);
    // 결과 목록 최상단으로 스크롤
    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // 현재 페이지가 프리미엄 필요한지 체크
  const isCurrentPagePremiumRequired = PREMIUM_REQUIRED_PAGES.includes(currentPage);
  const canViewCurrentPage = !isCurrentPagePremiumRequired || isPremium;

  // 페이지 버튼 생성 (최대 5개 표시)
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 5;

    if (totalPages <= maxButtons) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push(-1); // ... 표시용
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push(-1);
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push(-1);
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push(-1);
        pages.push(totalPages);
      }
    }

    return pages;
  };

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
          <div ref={resultsRef} className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="p-3 sm:p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h2 className="text-base sm:text-lg font-bold text-white">분석 결과</h2>
                <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                  <div className="text-xs sm:text-sm">
                    <span className="text-zinc-400">전체: </span>
                    <span className="text-white font-medium">{results.totalAnalyzed}</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="text-zinc-400">발견: </span>
                    <span className="text-green-500 font-bold">{results.foundCount}</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="text-zinc-400">업비트: </span>
                    <span className="text-purple-400 font-medium">
                      {results.results.filter(r => r.exchange === 'upbit').length}
                    </span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="text-zinc-400">빗썸: </span>
                    <span className="text-blue-400 font-medium">
                      {results.results.filter(r => r.exchange === 'bithumb').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cache Status */}
              <div className="flex items-center gap-2 text-[10px] sm:text-xs flex-wrap">
                <div className="flex items-center gap-1.5">
                  {results.totalAnalyzed === 0 ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span className="text-zinc-400">{results.message || '분석 준비 중...'}</span>
                    </>
                  ) : results.analyzing ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-zinc-400">백그라운드 분석 중...</span>
                    </>
                  ) : results.cached ? (
                    <>
                      <div className={`w-2 h-2 rounded-full ${results.stale ? 'bg-yellow-500' : 'bg-green-500'}`} />
                      <span className="text-zinc-400">
                        {results.stale ? '갱신 중...' : '최신 데이터'}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-zinc-400">분석 완료</span>
                    </>
                  )}
                </div>
                {results.cacheAge !== undefined && results.totalAnalyzed > 0 && (
                  <>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">
                      업데이트: {formatCacheAge(results.cacheAge)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Search Input */}
            {results.foundCount > 0 && (
              <div className="p-3 sm:p-4 border-b border-zinc-800">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="종목 검색... (예: BTC, ETH)"
                    className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 sm:py-3 pl-10 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-zinc-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {searchQuery && (
                  <div className="mt-2 text-xs sm:text-sm text-zinc-400">
                    검색 결과: <span className="text-yellow-500 font-medium">{filteredResults.length}</span>개
                  </div>
                )}
              </div>
            )}

            {results.foundCount > 0 ? (
              filteredResults.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/50">
                        <th className="text-left text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">종목</th>
                        <th className="text-center text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">5분</th>
                        <th className="text-center text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">30분</th>
                        <th className="text-center text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">1시간</th>
                        <th className="text-center text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">4시간</th>
                        <th className="text-center text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">일봉</th>
                        <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden md:table-cell">현재가</th>
                        <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden lg:table-cell">거래대금</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!canViewCurrentPage ? (
                        // 프리미엄 필요 - 잠금 표시
                        <tr>
                          <td colSpan={7} className="p-8 sm:p-12">
                            <div className="text-center">
                              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-yellow-500/10 mb-4">
                                <svg className="w-8 h-8 sm:w-10 sm:h-10 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              </div>
                              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">프리미엄 전용 콘텐츠</h3>
                              <p className="text-sm sm:text-base text-zinc-400 mb-6">
                                1-2페이지의 상위 종목은 프리미엄 회원만 확인할 수 있습니다
                              </p>
                              {user ? (
                                <button className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors">
                                  프리미엄 업그레이드
                                </button>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-sm text-zinc-500">로그인 후 프리미엄 혜택을 확인하세요</p>
                                  <button
                                    onClick={() => {/* 로그인 모달 열기 */}}
                                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-bold rounded-lg transition-colors"
                                  >
                                    로그인하기
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        // 일반 유저 또는 프리미엄 유저 - 데이터 표시
                        currentPageResults.map((result) => (
                      <tr
                        key={`${result.exchange}-${result.symbol}`}
                        onClick={() => setSelectedCoin(result)}
                        className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      >
                        <td className="p-2 sm:p-4">
                          <div className="flex items-center gap-1.5 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
                              <span className="text-[9px] sm:text-xs font-bold text-yellow-500">
                                {result.symbol.slice(0, 2)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] sm:text-sm font-medium text-white flex items-center gap-1 sm:gap-2 flex-wrap">
                                <span className="truncate">{result.symbol}</span>
                                {isBinanceAlpha(result.symbol) && (
                                  <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 font-bold whitespace-nowrap">
                                    ALPHA
                                  </span>
                                )}
                                {result.volumeSpike && (
                                  <span
                                    className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold whitespace-nowrap"
                                    title={`거래량 ${result.volumeSpike.ratio}배 급증`}
                                  >
                                    🔥 급증
                                  </span>
                                )}
                                {result.watchlist && (
                                  <span
                                    className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold whitespace-nowrap"
                                    title={`1시간봉 MA50 우상향 (기울기 +${result.watchlist.slope}%)`}
                                  >
                                    ★ 관심
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] sm:text-xs text-zinc-400">
                                {result.exchange === 'upbit' ? '업비트' : '빗썸'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Timeframe indicators */}
                        <td className="text-center p-2 sm:p-4">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${getTimeframeColor(result.timeframes['5m'])} text-xs sm:text-sm font-bold`}>
                              {getTimeframeIcon(result.timeframes['5m'])}
                            </div>
                            {result.timeframes['5m'].hasBox && result.timeframes['5m'].position && (
                              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionColor(result.timeframes['5m'].position)}`}>
                                {getPositionLabel(result.timeframes['5m'].position)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center p-2 sm:p-4">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${getTimeframeColor(result.timeframes['30m'])} text-xs sm:text-sm font-bold`}>
                              {getTimeframeIcon(result.timeframes['30m'])}
                            </div>
                            {result.timeframes['30m'].hasBox && result.timeframes['30m'].position && (
                              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionColor(result.timeframes['30m'].position)}`}>
                                {getPositionLabel(result.timeframes['30m'].position)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center p-2 sm:p-4">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${getTimeframeColor(result.timeframes['1h'])} text-xs sm:text-sm font-bold`}>
                              {getTimeframeIcon(result.timeframes['1h'])}
                            </div>
                            {result.timeframes['1h'].hasBox && result.timeframes['1h'].position && (
                              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionColor(result.timeframes['1h'].position)}`}>
                                {getPositionLabel(result.timeframes['1h'].position)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center p-2 sm:p-4">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${getTimeframeColor(result.timeframes['4h'])} text-xs sm:text-sm font-bold`}>
                              {getTimeframeIcon(result.timeframes['4h'])}
                            </div>
                            {result.timeframes['4h'].hasBox && result.timeframes['4h'].position && (
                              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionColor(result.timeframes['4h'].position)}`}>
                                {getPositionLabel(result.timeframes['4h'].position)}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="text-center p-2 sm:p-4">
                          <div className="flex flex-col items-center gap-1">
                            <div className={`inline-flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${getTimeframeColor(result.timeframes['1d'])} text-xs sm:text-sm font-bold`}>
                              {getTimeframeIcon(result.timeframes['1d'])}
                            </div>
                            {result.timeframes['1d'].hasBox && result.timeframes['1d'].position && (
                              <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded font-medium ${getPositionColor(result.timeframes['1d'].position)}`}>
                                {getPositionLabel(result.timeframes['1d'].position)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="text-right p-2 sm:p-4 hidden md:table-cell">
                          <div className="text-xs sm:text-sm text-white font-medium">
                            ₩{formatNumber(result.currentPrice)}
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-4 hidden lg:table-cell">
                          <div className="text-xs sm:text-sm text-zinc-400">
                            ₩{formatVolume(result.volume)}
                          </div>
                        </td>
                      </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="p-4 sm:p-6 border-t border-zinc-800">
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        {/* 이전 버튼 */}
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors text-sm sm:text-base"
                        >
                          ← 이전
                        </button>

                        {/* 페이지 번호 */}
                        <div className="flex items-center gap-1 sm:gap-2 flex-wrap justify-center">
                          {getPageNumbers().map((page, index) => {
                            if (page === -1) {
                              return (
                                <span key={`ellipsis-${index}`} className="px-2 text-zinc-500">
                                  ...
                                </span>
                              );
                            }

                            const isPremiumPage = PREMIUM_REQUIRED_PAGES.includes(page);
                            const isLocked = isPremiumPage && !isPremium;

                            return (
                              <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                disabled={isLocked}
                                className={`
                                  w-8 h-8 sm:w-10 sm:h-10 rounded-lg font-medium text-sm sm:text-base transition-colors relative
                                  ${currentPage === page
                                    ? 'bg-yellow-500 text-black'
                                    : isLocked
                                      ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                  }
                                `}
                                title={isLocked ? '프리미엄 전용' : undefined}
                              >
                                {isLocked ? (
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                ) : (
                                  page
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* 다음 버튼 */}
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 sm:px-4 py-2 rounded-lg bg-zinc-800 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors text-sm sm:text-base"
                        >
                          다음 →
                        </button>
                      </div>

                      {/* 페이지 정보 */}
                      <div className="mt-3 sm:mt-4 text-center text-xs sm:text-sm text-zinc-400">
                        {startIndex + 1}-{Math.min(endIndex, filteredResults.length)} / 총 {filteredResults.length}개
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 sm:p-8 text-center">
                  <div className="text-zinc-500">
                    <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-xs sm:text-sm">"{searchQuery}"에 대한 검색 결과가 없습니다</p>
                    <p className="text-[10px] sm:text-xs mt-1">다른 종목명으로 검색해보세요</p>
                  </div>
                </div>
              )
            ) : (
              <div className="p-6 sm:p-8 text-center">
                <div className="text-zinc-500">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs sm:text-sm">박스권을 형성한 종목이 없습니다</p>
                  <p className="text-[10px] sm:text-xs mt-1">조건을 만족하는 종목이 발견되지 않았습니다</p>
                </div>
              </div>
            )}
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
                <p className="mb-1.5 sm:mb-2 font-medium text-zinc-300">멀티 타임프레임 분석:</p>
                <ul className="space-y-0.5 sm:space-y-1 text-zinc-500">
                  <li>• 업비트 & 빗썸 전체 종목 분석 (중복 제외)</li>
                  <li>• 30분봉, 1시간봉, 4시간봉, 일봉 동시 확인</li>
                  <li>• 여러 시간대에서 동시 박스권 형성 종목 우선 표시</li>
                  <li>• ✓ 표시: 해당 시간대에서 박스권 형성</li>
                  <li>• 서버 시작 시 자동 분석 & 5분마다 백그라운드 갱신</li>
                  <li>• 캐시된 데이터 즉시 표시, 분석 중에도 이전 데이터 확인 가능</li>
                </ul>
              </div>

              <div>
                <p className="mb-1.5 sm:mb-2 font-medium text-zinc-300">관심종목:</p>
                <ul className="space-y-0.5 sm:space-y-1 text-zinc-500">
                  <li>• <span className="text-cyan-400">★ 관심</span>: 1시간봉 MA50이 우상향 추세 (최근 5봉 중 3봉 이상 상승)</li>
                  <li>• 중장기 상승 추세에 있는 종목으로 박스권 돌파 시 추가 상승 가능성 높음</li>
                </ul>
              </div>

<div>
                <p className="mb-1.5 sm:mb-2 font-medium text-zinc-300">가격 위치:</p>
                <ul className="space-y-0.5 sm:space-y-1 text-zinc-500">
                  <li>• <span className="text-red-400">돌파</span>: 박스권 상단 돌파 (3% 이상)</li>
                  <li>• <span className="text-orange-400">상단</span>: 박스권 상단 구간 (66-100%)</li>
                  <li>• <span className="text-yellow-400">중단</span>: 박스권 중간 구간 (33-66%)</li>
                  <li>• <span className="text-green-400">하단</span>: 박스권 하단 구간 (0-33%)</li>
                  <li>• <span className="text-blue-400">이탈</span>: 박스권 하단 이탈 (3% 이상)</li>
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
