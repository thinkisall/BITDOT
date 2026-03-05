"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  Activity,
  Bitcoin,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  Shield,
  AlertTriangle,
  Lock,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BTCRelativeStrengthSummary } from "@/lib/box-breakout/calculators/btc-relative-strength";
import type { BoxBreakoutSignal } from "@/shared/types";

interface BTCStrengthPanelProps {
  boxTimeframe: string;
  signals: BoxBreakoutSignal[];
  isLoadingSignals: boolean;
  isPremium: boolean;
}

type TimeframeOption = "1h" | "1d";

export function BTCStrengthPanel({
  boxTimeframe,
  signals,
  isLoadingSignals,
  isPremium,
}: BTCStrengthPanelProps) {
  const [data, setData] = useState<BTCRelativeStrengthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<TimeframeOption>("1h");
  const [isExpanded, setIsExpanded] = useState(true);

  // 돌파 + 상단 저항 근접 시그널 필터링
  const targetSignals = useMemo(() => {
    return signals.filter((s) => s.isBreakout || s.positionInBox >= 80);
  }, [signals]);

  // 분석할 심볼 목록
  const symbolsToAnalyze = useMemo(() => {
    return targetSignals.map((s) =>
      s.symbol.replace("USDT", "").replace("/KRW", "")
    );
  }, [targetSignals]);

  const fetchData = useCallback(async () => {
    // 분석할 심볼이 없으면 스킵
    if (symbolsToAnalyze.length === 0) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/box-breakout/btc-strength?timeframe=${timeframe}&symbols=${symbolsToAnalyze.join(",")}`
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch");
      }

      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [timeframe, symbolsToAnalyze]);

  // 시그널이 변경되거나 타임프레임이 변경되면 다시 fetch
  useEffect(() => {
    if (!isLoadingSignals && symbolsToAnalyze.length > 0) {
      fetchData();
    }
  }, [fetchData, isLoadingSignals, symbolsToAnalyze.length]);

  // 1분마다 자동 갱신
  useEffect(() => {
    if (symbolsToAnalyze.length === 0) return;

    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData, symbolsToAnalyze.length]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "강한 독립":
        return "text-emerald-400 bg-emerald-500/20 border-emerald-500/40";
      case "약한 독립":
        return "text-blue-400 bg-blue-500/20 border-blue-500/40";
      case "역행":
        return "text-purple-400 bg-purple-500/20 border-purple-500/40";
      case "시장 추종":
      default:
        return "text-orange-400 bg-orange-500/20 border-orange-500/40";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "강한 독립":
        return <Zap className="w-3.5 h-3.5" />;
      case "약한 독립":
        return <Shield className="w-3.5 h-3.5" />;
      case "역행":
        return <TrendingUp className="w-3.5 h-3.5" />;
      case "시장 추종":
      default:
        return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  // 분석할 시그널이 없으면 패널 숨김
  if (targetSignals.length === 0 && !isLoadingSignals) {
    return null;
  }

  return (
    <div className="relative rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl shadow-lg overflow-hidden">
      {/* Premium Lock Overlay */}
      {!isPremium && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="p-3 rounded-full bg-amber-500/20 border border-amber-500/40 mb-3">
            <Lock className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">프리미엄 전용 기능</p>
          <p className="text-xs text-muted-foreground mb-3">BTC 상대강도 분석은 프리미엄 구독자만 이용 가능합니다</p>
          <a
            href="/premium"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
          >
            <Star className="w-4 h-4" />
            프리미엄 구독하기
          </a>
        </div>
      )}

      {/* Header */}
      <div
        className={cn(
          "px-4 py-3 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 border-b border-border/40 cursor-pointer hover:bg-secondary/30 transition-colors",
          !isPremium && "blur-sm pointer-events-none"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/30 to-orange-500/30 border border-amber-500/40">
              <Bitcoin className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">BTC 상대강도 분석</h3>
              <p className="text-xs text-muted-foreground">
                돌파 + 저항 근접 {targetSignals.length}개 코인
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe Selector */}
            <div className="flex rounded-lg border border-border/60 overflow-hidden">
              {(["1h", "1d"] as TimeframeOption[]).map((tf) => (
                <button
                  key={tf}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTimeframe(tf);
                  }}
                  className={cn(
                    "px-3 py-1 text-xs font-medium transition-colors",
                    timeframe === tf
                      ? "bg-primary/20 text-primary"
                      : "bg-transparent text-muted-foreground hover:bg-secondary/50"
                  )}
                >
                  {tf === "1h" ? "1시간" : "1일"}
                </button>
              ))}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchData();
              }}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn("w-4 h-4", loading && "animate-spin")}
              />
            </button>

            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* BTC Status Bar */}
        {data && (
          <div className="mt-2 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">BTC:</span>
              <span className="font-semibold">
                {data.btcCurrentPrice.toLocaleString()}원
              </span>
              <span
                className={cn(
                  "font-bold",
                  data.btcChange >= 0 ? "text-emerald-400" : "text-red-400"
                )}
              >
                {data.btcChange >= 0 ? "+" : ""}
                {data.btcChange.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">평균 독립성:</span>
              <span
                className={cn(
                  "font-bold",
                  data.summary.avgDecouplingScore >= 60
                    ? "text-emerald-400"
                    : data.summary.avgDecouplingScore >= 40
                    ? "text-yellow-400"
                    : "text-red-400"
                )}
              >
                {data.summary.avgDecouplingScore}점
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {isExpanded && (
        <div className={cn("p-4", !isPremium && "blur-sm pointer-events-none")}>
          {loading && !data ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Activity className="w-5 h-5 animate-spin mr-2" />
              <span>BTC 상대강도 분석 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-400 text-sm">{error}</div>
          ) : !data || data.coins.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              분석 결과가 없습니다
            </div>
          ) : (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
                  <div className="text-lg font-bold text-emerald-400">
                    {data.summary.strongIndependent}
                  </div>
                  <div className="text-[10px] text-emerald-300/80">강한 독립</div>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                  <div className="text-lg font-bold text-blue-400">
                    {data.summary.weakIndependent}
                  </div>
                  <div className="text-[10px] text-blue-300/80">약한 독립</div>
                </div>
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 text-center">
                  <div className="text-lg font-bold text-purple-400">
                    {data.summary.contrarian}
                  </div>
                  <div className="text-[10px] text-purple-300/80">역행</div>
                </div>
                <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/30 text-center">
                  <div className="text-lg font-bold text-orange-400">
                    {data.summary.marketFollowing}
                  </div>
                  <div className="text-[10px] text-orange-300/80">시장 추종</div>
                </div>
              </div>

              {/* Coin List - Table Style */}
              <div className="overflow-hidden rounded-lg border border-border/40">
                {/* Table Header */}
                <div className="grid grid-cols-5 gap-2 px-3 py-2 bg-secondary/40 text-xs text-muted-foreground font-medium">
                  <div>코인</div>
                  <div className="text-center">상태</div>
                  <div className="text-right">변화율</div>
                  <div className="text-right">상대강도</div>
                  <div className="text-right">독립성</div>
                </div>
                {/* Table Body */}
                <div className="max-h-[280px] overflow-y-auto divide-y divide-border/30">
                  {data.coins.map((coin) => (
                    <div
                      key={coin.symbol}
                      className="grid grid-cols-5 gap-2 px-3 py-2 hover:bg-secondary/30 transition-colors items-center text-sm"
                    >
                      <div className="font-semibold">{coin.symbol}</div>
                      <div className="flex justify-center">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border",
                            getStatusColor(coin.status)
                          )}
                        >
                          {getStatusIcon(coin.status)}
                          {coin.status}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "text-right font-bold",
                          coin.coinChange >= 0 ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {coin.coinChange >= 0 ? "+" : ""}
                        {coin.coinChange.toFixed(2)}%
                      </div>
                      <div
                        className={cn(
                          "text-right font-bold",
                          coin.relativeStrength >= 0 ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {coin.relativeStrength >= 0 ? "+" : ""}
                        {coin.relativeStrength.toFixed(2)}%
                      </div>
                      <div
                        className={cn(
                          "text-right font-bold",
                          coin.decouplingScore >= 60
                            ? "text-emerald-400"
                            : coin.decouplingScore >= 40
                            ? "text-yellow-400"
                            : "text-red-400"
                        )}
                      >
                        {coin.decouplingScore}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
