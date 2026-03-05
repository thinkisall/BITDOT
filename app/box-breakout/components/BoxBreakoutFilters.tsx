import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoxBreakoutFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  positionFilter: "all" | "breakout" | "top" | "middle" | "bottom";
  onPositionFilterChange: (
    value: "all" | "breakout" | "top" | "middle" | "bottom"
  ) => void;
  timeframe: string;
  onTimeframeChange: (value: string) => void;
  resultCount: number;
}

export function BoxBreakoutFilters({
  searchTerm,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  timeframe,
  onTimeframeChange,
  resultCount,
}: BoxBreakoutFiltersProps) {
  const timeframes = [
    { value: "1m", label: "1분" },
    { value: "5m", label: "5분" },
    { value: "15m", label: "15분" },
    { value: "30m", label: "30분" },
    { value: "1h", label: "1시간" },
    { value: "4h", label: "4시간" },
    { value: "1d", label: "일봉" },
  ];

  const positions = [
    { value: "all", label: "전체" },
    { value: "breakout", label: "상승 진행중" },
    { value: "top", label: "상단근접" },
    { value: "middle", label: "중단" },
    { value: "bottom", label: "하단" },
  ];

  const positionColor: Record<string, string> = {
    all: "bg-primary/15 text-primary ring-primary/30",
    breakout: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    top: "bg-orange-500/15 text-orange-300 ring-orange-500/30",
    middle: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    bottom: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/30",
  };

  return (
    <div className="mt-5 space-y-4 rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm md:p-5">
      {/* 타임프레임 */}
      <div>
        <label className="mb-2.5 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
          타임프레임
        </label>
        <div className="flex flex-wrap gap-2">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => onTimeframeChange(tf.value)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-xs font-bold transition-all",
                timeframe === tf.value
                  ? "bg-orange-500/15 text-orange-200 ring-1 ring-orange-500/40"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 검색 + 포지션 필터 */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        {/* 검색 */}
        <div className="flex-1">
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            종목 검색
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="BTC, ETH, SOL..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full rounded-lg border border-border/60 bg-secondary/60 py-2.5 pl-10 pr-9 text-sm font-medium placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 포지션 필터 */}
        <div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground md:hidden">
            포지션
          </label>
          <div className="flex flex-wrap gap-1.5">
            {positions.map((p) => (
              <button
                key={p.value}
                onClick={() => onPositionFilterChange(p.value as any)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-bold transition-all",
                  positionFilter === p.value
                    ? cn("ring-1", positionColor[p.value])
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 필터 결과 */}
      {(searchTerm || positionFilter !== "all") && (
        <div className="rounded-lg bg-primary/5 px-3 py-2 ring-1 ring-primary/15">
          <span className="text-sm font-bold text-primary">
            {resultCount}개
          </span>
          <span className="ml-1 text-xs text-muted-foreground">종목 발견</span>
        </div>
      )}
    </div>
  );
}
