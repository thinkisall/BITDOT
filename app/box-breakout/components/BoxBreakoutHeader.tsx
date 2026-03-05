import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Target,
  Activity,
  Star,
  Lock,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatLastUpdated } from "@/shared/utils";

interface BoxBreakoutHeaderProps {
  isPremium: boolean;
  lastUpdated: number;
  loading: boolean;
  isAnalyzing: boolean;
  progress: { current: number; total: number };
  totalSignals: number;
  lockedSignals: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function BoxBreakoutHeader({
  isPremium,
  lastUpdated,
  loading,
  isAnalyzing,
  progress,
  totalSignals,
  lockedSignals,
  isRefreshing,
  onRefresh,
}: BoxBreakoutHeaderProps) {
  const router = useRouter();
  const showProgressBar = isAnalyzing && progress.total > 0;

  return (
    <div className="space-y-4">
      {/* 타이틀 + 액션 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-500/15 ring-1 ring-orange-500/30">
            <Target className="h-5 w-5 text-orange-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl">
              돌파 타점 분석
            </h1>
            <p className="text-xs text-muted-foreground">
              박스권 + 거래량 기반 실시간 돌파 분석
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/guide")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <BookOpen className="h-3.5 w-3.5" />
            타점가이드
          </button>

          {!isPremium && (
            <button
              onClick={() => router.push("/premium")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-200 transition-colors hover:bg-orange-500/20"
            >
              <Star className="h-3.5 w-3.5" />
              프리미엄
            </button>
          )}

          <button
            onClick={onRefresh}
            disabled={loading || isRefreshing}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card/80 transition-colors hover:bg-secondary/50",
              (loading || isRefreshing) && "opacity-50 cursor-not-allowed"
            )}
            aria-label="새로고침"
          >
            <RefreshCw
              className={cn(
                "h-4 w-4 text-muted-foreground",
                (loading || isRefreshing) && "animate-spin text-primary"
              )}
            />
          </button>
        </div>
      </div>

      {/* 상태 바 */}
      <div className="flex flex-wrap items-center gap-2">
        {lastUpdated > 0 && !loading ? (
          <span className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-300 ring-1 ring-blue-500/20">
            {formatLastUpdated(lastUpdated)}
          </span>
        ) : (
          <span className="rounded-lg bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            업데이트 대기
          </span>
        )}

        {totalSignals > 0 && (
          <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-300 ring-1 ring-emerald-500/20">
            <Target className="mr-1 inline h-3 w-3" />
            {totalSignals}개 신호
          </span>
        )}

        {!isPremium && lockedSignals > 0 && (
          <span className="rounded-lg bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-300 ring-1 ring-orange-500/20">
            <Lock className="mr-1 inline h-3 w-3" />
            상위 {lockedSignals}개 프리미엄
          </span>
        )}

        {showProgressBar && (
          <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-500/20 animate-pulse">
            <Activity className="mr-1 inline h-3 w-3" />
            분석 중 {progress.current}/{progress.total}
          </span>
        )}
      </div>

      {/* 프로그레스 바 */}
      {showProgressBar && (
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, (progress.current / progress.total) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            전체 종목을 순차 분석 중입니다...
          </p>
        </div>
      )}
    </div>
  );
}
