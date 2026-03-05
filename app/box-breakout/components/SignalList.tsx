"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  RefreshCw,
  X,
  ChevronRight,
  Award,
  Star,
  Flame,
  ShoppingCart,
  Zap,
  Eye,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination";
import { BoxBreakoutSignal } from "@/shared/types";
import { getHomeServerUrl } from "@/lib/home-server";

const MultiTimeframeChartModal = dynamic(
  () => import("@/app/components/MultiTimeframeChartModal"),
  { ssr: false }
);

interface Skeleton {
  className?: string;
}

function Skeleton({ className }: Skeleton) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-secondary/60",
        className
      )}
    />
  );
}

interface SignalListProps {
  loading: boolean;
  signals: BoxBreakoutSignal[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  isPremium: boolean;
  favorites: Set<string>;
  isLoggedIn: boolean;
  searchTerm: string;
  onPageChange: (page: number) => void;
  onToggleFavorite: (signal: BoxBreakoutSignal) => void;
  onRefresh: () => void;
  onClearSearch: () => void;
  isAlphaToken: (symbol: string) => boolean;
  timeframe: string;
}

function formatPrice(price: number): string {
  if (price >= 1000) {
    return `₩${price.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`;
  } else if (price >= 1) {
    return `₩${price.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}`;
  } else {
    return `₩${price.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`;
  }
}

function formatVolume(volume: number): string {
  if (volume >= 100_000_000) {
    return `${(volume / 100_000_000).toFixed(1)}억`;
  } else if (volume >= 10_000) {
    return `${(volume / 10_000).toFixed(0)}만`;
  }
  return volume.toLocaleString("ko-KR");
}

export function SignalList({
  loading,
  signals,
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  isPremium,
  favorites,
  isLoggedIn,
  searchTerm,
  onPageChange,
  onToggleFavorite,
  onRefresh,
  onClearSearch,
  isAlphaToken,
  timeframe,
}: SignalListProps) {
  const router = useRouter();
  const [selectedSignal, setSelectedSignal] = useState<BoxBreakoutSignal | null>(null);
  const [modalTimeframes, setModalTimeframes] = useState<any>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const handleCardClick = useCallback(async (signal: BoxBreakoutSignal, index: number) => {
    const isLocked = index < 20 && !isPremium;
    if (isLocked) {
      router.push("/premium");
      return;
    }

    const sym = signal.symbol.replace("KRW", "");

    // 즉시 모달 열고 로딩 표시 (현재 타임프레임 데이터로 기본값 설정)
    const fallback = buildFallbackTimeframes(signal);
    setModalTimeframes(fallback);
    setSelectedSignal(signal);
    setModalLoading(true);

    try {
      const res = await fetch(getHomeServerUrl(`/api/box-breakout/symbol/${sym}`));
      if (res.ok) {
        const data = await res.json();
        if (data.timeframes) setModalTimeframes(data.timeframes);
      }
    } catch {}
    setModalLoading(false);
  }, [isPremium, router, timeframe]);

  const buildFallbackTimeframes = (signal: BoxBreakoutSignal) => {
    let position: 'breakout' | 'top' | 'middle' | 'bottom' | 'below';
    if (signal.isBreakout) position = 'breakout';
    else if (signal.positionInBox >= 80) position = 'top';
    else if (signal.positionInBox >= 50) position = 'middle';
    else if (signal.positionInBox >= 20) position = 'bottom';
    else position = 'below';

    const active = {
      hasBox: true,
      top: signal.resistance,
      bottom: signal.support,
      position,
      positionPercent: signal.positionInBox,
    };
    const empty = { hasBox: false } as const;
    return {
      '5m': timeframe === '5m' ? active : empty,
      '30m': timeframe === '30m' ? active : empty,
      '1h': timeframe === '1h' ? active : empty,
      '4h': timeframe === '4h' ? active : empty,
      '1d': timeframe === '1d' ? active : empty,
    };
  };

  // 페이지 번호 생성 함수
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push("ellipsis");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(6)
          .fill(null)
          .map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
        <CardContent className="p-10 text-center">
          <div className="p-3 rounded-full bg-muted-foreground/10 w-fit mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-bold mb-2">
            {searchTerm ? "검색 결과가 없습니다" : "돌파 신호가 없습니다"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm
              ? `'${searchTerm}'에 해당하는 종목이 없습니다. 다른 검색어를 시도해보세요.`
              : "현재 조건을 만족하는 신호가 없습니다. 잠시 후 다시 확인해주세요."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            {searchTerm && (
              <button
                onClick={onClearSearch}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors text-primary font-semibold text-sm"
              >
                <X className="w-4 h-4" />
                검색 초기화
              </button>
            )}
            <button
              onClick={onRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-card/60 hover:bg-secondary/50 transition-colors text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {signals.map((signal, i) => {
          const index = (currentPage - 1) * itemsPerPage + i;
          const isLocked = index < 20 && !isPremium;
          const isFavorite = favorites.has(signal.symbol);
          const isAlpha = isAlphaToken(signal.symbol);

          // 상태별 스타일
          const statusStyle = signal.isBreakout
            ? "border-emerald-500/50 bg-emerald-500/5"
            : signal.positionInBox >= 90
            ? "border-orange-500/50 bg-orange-500/5"
            : signal.positionInBox >= 70
            ? "border-amber-500/40 bg-amber-500/5"
            : "border-border/60 bg-card/60";

          return (
            <Card
              key={signal.symbol}
              className={cn(
                "group relative overflow-hidden backdrop-blur-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer",
                statusStyle,
                isLocked && "blur-sm"
              )}
              onClick={() => handleCardClick(signal, index)}
            >
              {isLocked && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <div className="text-center">
                    <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-semibold text-muted-foreground">프리미엄 전용</p>
                  </div>
                </div>
              )}

              <CardContent className="p-5">
                {/* 상단: 순위 + 등급 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/60 text-xs font-bold font-mono text-muted-foreground">
                      #{index + 1}
                    </span>
                    {signal.signalGrade && (
                      <Badge
                        className={cn(
                          "font-bold text-sm px-2.5 py-1",
                          signal.signalGrade === "A"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : signal.signalGrade === "B"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-secondary/60 text-muted-foreground border-border/60"
                        )}
                      >
                        {signal.signalGrade === "A" && <Award className="w-4 h-4 mr-1 inline" />}
                        {signal.signalGrade}등급
                      </Badge>
                    )}
                  </div>
                  {isFavorite && (
                    <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  )}
                </div>

                {/* 종목명 + 특수 배지 */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-2xl font-bold text-foreground">
                      {signal.symbol.replace("KRW", "")}
                    </h3>
                    {isAlpha && (
                      <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs px-2 py-0.5">
                        Alpha
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {signal.volumeSurge && (
                      <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-xs px-2 py-0.5 animate-pulse">
                        <Flame className="w-3 h-3 mr-1 inline" />
                        거래량 급등
                      </Badge>
                    )}
                    {signal.buySignal5m && (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs px-2 py-0.5">
                        <ShoppingCart className="w-3 h-3 mr-1 inline" />
                        매수가능
                      </Badge>
                    )}
                  </div>
                </div>

                {/* 현재가 + 상태 */}
                <div className="mb-4 pb-4 border-b border-border/40">
                  <div className="flex items-end justify-between mb-2">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">현재가</div>
                      <div className="text-2xl font-bold font-mono text-foreground">
                        {formatPrice(signal.currentPrice)}
                      </div>
                    </div>
                    <div className="text-right">
                      {signal.isBreakout ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold px-3 py-1">
                          <Zap className="w-4 h-4 mr-1 inline" />
                          돌파 완료
                        </Badge>
                      ) : signal.positionInBox >= 90 ? (
                        <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/40 px-3 py-1">
                          저항 근접
                        </Badge>
                      ) : signal.positionInBox >= 70 ? (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 px-3 py-1">
                          상단권
                        </Badge>
                      ) : signal.positionInBox >= 50 ? (
                        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 px-3 py-1">
                          중단권
                        </Badge>
                      ) : (
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 px-3 py-1">
                          하단권
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    박스 내 위치: {signal.positionInBox.toFixed(0)}%
                  </div>
                </div>

                {/* 핵심 지표 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">스코어</div>
                    {signal.scoreDetails ? (
                      <Badge
                        className={cn(
                          "font-mono font-bold",
                          signal.scoreDetails.totalScore >= 3
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : signal.scoreDetails.totalScore >= 2
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-secondary/60 text-muted-foreground border-border/60"
                        )}
                      >
                        {signal.scoreDetails.totalScore}점
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">거래량</div>
                    <div className="text-sm font-mono font-semibold text-foreground">
                      {formatVolume(signal.quoteVolume)}
                    </div>
                  </div>
                  {signal.ichimokuAboveCloudCount !== undefined && signal.ichimokuAboveCloudCount > 0 && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">일목구름</div>
                      <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-mono text-xs">
                        {signal.ichimokuAboveCloudCount}/6
                      </Badge>
                    </div>
                  )}
                  {(signal.isBreakout || signal.positionInBox >= 80) && signal.btcDecouplingScore !== undefined && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">독립성</div>
                      <Badge
                        className={cn(
                          "font-mono text-xs",
                          signal.btcDecouplingScore >= 60
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : signal.btcDecouplingScore >= 40
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        )}
                      >
                        {signal.btcDecouplingScore}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* 하단: 상세보기 버튼 */}
                <button className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors text-sm font-medium text-foreground group-hover:bg-primary/10 group-hover:text-primary">
                  <Eye className="w-4 h-4" />
                  상세 정보
                  <ChevronRight className="w-4 h-4" />
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  className={cn(
                    "cursor-pointer border-border/60 bg-card/60 hover:bg-secondary/50 text-foreground/80",
                    currentPage === 1 && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>

              {getPageNumbers().map((page, index) => (
                <PaginationItem key={index}>
                  {page === "ellipsis" ? (
                    <PaginationEllipsis className="text-muted-foreground" />
                  ) : (
                    <PaginationLink
                      onClick={() => onPageChange(page)}
                      isActive={currentPage === page}
                      className={cn(
                        "cursor-pointer border-border/60 text-foreground/80",
                        currentPage === page
                          ? "bg-primary/15 border-primary/40 text-primary hover:bg-primary/20"
                          : "bg-card/60 hover:bg-secondary/50"
                      )}
                    >
                      {page}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  className={cn(
                    "cursor-pointer border-border/60 bg-card/60 hover:bg-secondary/50 text-foreground/80",
                    currentPage === totalPages && "pointer-events-none opacity-50"
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Chart Modal */}
      {selectedSignal && modalTimeframes && (
        <MultiTimeframeChartModal
          isOpen={!!selectedSignal}
          onClose={() => { setSelectedSignal(null); setModalTimeframes(null); }}
          symbol={selectedSignal.symbol.replace("KRW", "")}
          exchange={selectedSignal.exchange}
          timeframes={modalTimeframes}
        />
      )}
    </>
  );
}
