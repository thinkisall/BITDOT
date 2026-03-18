"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { SiteHeader } from "@/components/site-header";
import { usePagination } from "@/shared/hooks";
import { BoxBreakoutSignal } from "@/shared/types";
import {
  addTradingFavorite,
  removeTradingFavorite,
  isTradingFavorite,
  getTradingFavorites,
} from "@/lib/trading-favorites";
import { useBoxBreakoutData } from "./hooks/useBoxBreakoutData";
import { BoxBreakoutHeader } from "./components/BoxBreakoutHeader";
import { BoxBreakoutFilters } from "./components/BoxBreakoutFilters";
import { SignalList } from "./components/SignalList";
import { BTCStrengthPanel } from "./components/BTCStrengthPanel";
import { CoupangAdModal, hasCoupangVisitedToday } from "@/components/CoupangAdModal";

const ITEMS_PER_PAGE = 10;

export default function BoxBreakoutPage() {
  const router = useRouter();
  const { isPremium, user, loading: authLoading } = useAuth();
  const [showCoupangModal, setShowCoupangModal] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<
    "all" | "breakout" | "top" | "middle" | "bottom"
  >("all");

  const {
    signals,
    loading,
    isRefreshing,
    isAnalyzing,
    progress,
    lastUpdated,
    timeframe,
    setTimeframe,
    exchange,
    setExchange,
    setSignals,
    fetchData,
    handleRefresh,
    isAlphaToken,
  } = useBoxBreakoutData();

  // 쿠팡 광고 모달 체크
  useEffect(() => {
    if (!authLoading && !hasCoupangVisitedToday()) {
      setShowCoupangModal(true);
    }
  }, [authLoading]);

  // 프리미엄 체크 제거 - 일반 사용자도 접근 가능 (1~10위는 블러 처리)

  // 데이터 자동 갱신 + 타임프레임 변경 시 새로고침
  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 120000);

    return () => clearInterval(interval);
  }, [fetchData, timeframe]);

  // 즐겨찾기 로드
  useEffect(() => {
    const loadFavorites = () => {
      if (user) {
        const favs = getTradingFavorites();
        setFavorites(new Set(favs.map((f) => f.symbol)));
      } else {
        setFavorites(new Set());
      }
    };

    loadFavorites();

    const handleFavoritesChanged = () => {
      loadFavorites();
    };

    window.addEventListener(
      "trading-favorites-changed",
      handleFavoritesChanged
    );

    return () => {
      window.removeEventListener(
        "trading-favorites-changed",
        handleFavoritesChanged
      );
    };
  }, [user]);

  const handleToggleFavorite = useCallback(
    (signal: BoxBreakoutSignal) => {
      if (!user) {
        alert("로그인이 필요합니다.");
        router.push("/auth/login");
        return;
      }

      const isFav = isTradingFavorite(signal.symbol);

      if (isFav) {
        removeTradingFavorite(signal.symbol);
        setFavorites((prev) => {
          const next = new Set(prev);
          next.delete(signal.symbol);
          return next;
        });
      } else {
        addTradingFavorite({
          symbol: signal.symbol,
          source: "breakout",
          entryPrice: signal.buyPrice,
          stopLoss: signal.stopLoss,
          addedAt: Date.now(),
        });
        setFavorites((prev) => new Set(prev).add(signal.symbol));
      }
    },
    [user, router]
  );

  // 검색 및 포지션 필터링 적용
  const filteredSignals = useMemo(() => {
    let filtered = signals;

    // 검색 필터
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((signal) =>
        signal.symbol.toLowerCase().includes(term)
      );
    }

    // 포지션 필터
    if (positionFilter !== "all") {
      filtered = filtered.filter((signal) => {
        if (positionFilter === "breakout") return signal.isBreakout;
        if (positionFilter === "top")
          return !signal.isBreakout && signal.positionInBox >= 80;
        if (positionFilter === "middle")
          return (
            !signal.isBreakout &&
            signal.positionInBox >= 50 &&
            signal.positionInBox < 80
          );
        if (positionFilter === "bottom")
          return !signal.isBreakout && signal.positionInBox < 50;
        return true;
      });
    }

    return filtered;
  }, [signals, searchTerm, positionFilter]);

  // 정렬 함수 (안정적인 참조 유지) - 스코어 높은 순
  const sortByScoreThenVolume = useCallback(
    (a: BoxBreakoutSignal, b: BoxBreakoutSignal) => {
      // 1순위: 총 스코어 (높을수록 우선)
      const aScore = a.scoreDetails?.totalScore || 0;
      const bScore = b.scoreDetails?.totalScore || 0;
      if (aScore !== bScore) return bScore - aScore;

      // 2순위: 일목균형표 구름 위 개수 (많을수록 우선)
      const aIchimoku = a.ichimokuAboveCloudCount || 0;
      const bIchimoku = b.ichimokuAboveCloudCount || 0;
      if (aIchimoku !== bIchimoku) return bIchimoku - aIchimoku;

      // 3순위: 거래량
      return (b.quoteVolume || 0) - (a.quoteVolume || 0);
    },
    []
  );

  // 정렬 (돌파완료 > 상단 > 중단 > 하단)
  const sortedSignals = useMemo(() => {
    // 한 번의 순회로 4개 그룹 분류 (O(n) 최적화)
    const breakout: BoxBreakoutSignal[] = [];
    const top: BoxBreakoutSignal[] = [];
    const middle: BoxBreakoutSignal[] = [];
    const bottom: BoxBreakoutSignal[] = [];

    for (const s of filteredSignals) {
      if (s.isBreakout) {
        breakout.push(s);
      } else if (s.positionInBox >= 80) {
        top.push(s);
      } else if (s.positionInBox >= 50) {
        middle.push(s);
      } else {
        bottom.push(s);
      }
    }

    // 각 그룹 정렬 후 합치기 (스코어 높은 순)
    breakout.sort(sortByScoreThenVolume);
    top.sort(sortByScoreThenVolume);
    middle.sort(sortByScoreThenVolume);
    bottom.sort(sortByScoreThenVolume);

    return [...breakout, ...top, ...middle, ...bottom];
  }, [filteredSignals, sortByScoreThenVolume]);

  const {
    currentPage,
    totalPages,
    paginatedItems: paginatedSignals,
    goToPage,
  } = usePagination({
    items: sortedSignals,
    itemsPerPage: ITEMS_PER_PAGE,
    initialPage: 1,
  });

  const handlePageChange = useCallback(
    (page: number) => {
      goToPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [goToPage]
  );

  const headerStats = useMemo(() => {
    const total = sortedSignals.length;
    const locked = !isPremium ? Math.min(20, total) : 0;
    return { total, locked };
  }, [sortedSignals.length, isPremium]);

  // 인증 상태 확인 중
  if (authLoading) {
    return (
      <div className="min-h-dvh bg-background text-foreground font-sans">
        <SiteHeader />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground font-sans selection:bg-primary/20">
      <SiteHeader />

      <main className="relative mx-auto w-full max-w-screen-2xl px-3 md:px-6 py-6">
        <BoxBreakoutHeader
          isPremium={!!isPremium}
          lastUpdated={lastUpdated}
          loading={loading}
          isAnalyzing={isAnalyzing}
          progress={progress}
          totalSignals={headerStats.total}
          lockedSignals={headerStats.locked}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
        />

        {/* 거래소 탭 */}
        <div className="flex gap-1 mb-4 p-1 bg-secondary/40 rounded-lg border border-border/60 w-fit">
          {([
            { key: 'bithumb', label: '빗썸 KRW',   activeClass: 'bg-orange-500 text-white' },
            { key: 'bybit',   label: 'Bybit USDT', activeClass: 'bg-yellow-400 text-black' },
          ] as const).map(({ key, label, activeClass }) => (
            <button
              key={key}
              onClick={() => { setExchange(key); setSignals([]); }}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                exchange === key ? `${activeClass} shadow` : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <BoxBreakoutFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          positionFilter={positionFilter}
          onPositionFilterChange={setPositionFilter}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          resultCount={sortedSignals.length}
        />

        {/* BTC 상대강도 분석 패널 - 시그널이 로드된 후에만 표시 */}
        {signals.length > 0 && (
          <div className="mt-4">
            <BTCStrengthPanel
              boxTimeframe={timeframe}
              signals={signals}
              isLoadingSignals={loading}
              isPremium={!!isPremium}
            />
          </div>
        )}

        {/* Premium Hint */}
        {!isPremium && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-4 py-2.5">
            <Star className="h-4 w-4 text-orange-300 shrink-0" />
            <p className="text-xs text-orange-200/80 flex-1">
              상위 1~20위 종목은 프리미엄 전용입니다
            </p>
            <button
              onClick={() => router.push("/premium")}
              className="shrink-0 rounded-md bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300 hover:bg-orange-500/25 transition-colors"
            >
              구독하기
            </button>
          </div>
        )}

        <div className="mt-4">
          {!isPremium && currentPage <= 2 ? (
            <div className="relative">
              {/* 블러 배경 */}
              <div className="pointer-events-none select-none blur-sm opacity-40">
                <SignalList
                  loading={loading}
                  signals={paginatedSignals}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={sortedSignals.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  isPremium={false}
                  favorites={favorites}
                  isLoggedIn={!!user}
                  searchTerm={searchTerm}
                  onPageChange={handlePageChange}
                  onToggleFavorite={handleToggleFavorite}
                  onRefresh={handleRefresh}
                  onClearSearch={() => setSearchTerm("")}
                  isAlphaToken={isAlphaToken}
                  timeframe={timeframe}
                />
              </div>
              {/* 프리미엄 게이트 오버레이 */}
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="text-center bg-background/90 backdrop-blur-md border border-orange-500/30 rounded-2xl px-8 py-10 shadow-2xl max-w-sm mx-4">
                  <div className="w-14 h-14 rounded-full bg-orange-500/15 flex items-center justify-center mx-auto mb-4">
                    <Star className="w-7 h-7 text-orange-400 fill-orange-400" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">프리미엄 전용</h3>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    상위 1~20위 고득점 종목은<br />프리미엄 구독자만 열람할 수 있습니다
                  </p>
                  <button
                    onClick={() => router.push("/premium")}
                    className="w-full py-3 rounded-xl bg-linear-to-r from-orange-500 to-orange-600 text-white font-bold text-sm hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25"
                  >
                    프리미엄 구독하기
                  </button>
                  {currentPage === 2 && (
                    <button
                      onClick={() => handlePageChange(3)}
                      className="mt-3 w-full py-2.5 rounded-xl border border-border/60 text-sm text-muted-foreground hover:bg-secondary/40 transition-colors"
                    >
                      21위 이후 무료 종목 보기 →
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <SignalList
              loading={loading}
              signals={paginatedSignals}
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={sortedSignals.length}
              itemsPerPage={ITEMS_PER_PAGE}
              isPremium={!!isPremium}
              favorites={favorites}
              isLoggedIn={!!user}
              searchTerm={searchTerm}
              onPageChange={handlePageChange}
              onToggleFavorite={handleToggleFavorite}
              onRefresh={handleRefresh}
              onClearSearch={() => setSearchTerm("")}
              isAlphaToken={isAlphaToken}
              timeframe={timeframe}
            />
          )}
        </div>
      </main>

      {/* 쿠팡 광고 모달 */}
      {showCoupangModal && (
        <CoupangAdModal
          onClose={() => setShowCoupangModal(false)}
          targetPath="/box-breakout"
        />
      )}
    </div>
  );
}
