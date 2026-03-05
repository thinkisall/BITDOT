"use client";

import { X, Star, TrendingUp, BarChart3, Target, Shield, Zap, Activity, Sparkles, ExternalLink, AlertTriangle, CheckCircle2, Award, Crosshair, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BoxBreakoutSignal } from "@/shared/types";
import { useEffect, useState } from "react";
import { BoxChart } from "./BoxChart";

interface SignalDetailModalProps {
  signal: BoxBreakoutSignal;
  isOpen: boolean;
  onClose: () => void;
  isFavorite: boolean;
  isLoggedIn: boolean;
  onToggleFavorite: () => void;
  isAlphaToken: boolean;
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

function useAnimatedValue(targetValue: number, duration: number = 1000, enabled: boolean = true) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(targetValue * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [targetValue, duration, enabled]);

  return value;
}

export function SignalDetailModal({
  signal,
  isOpen,
  onClose,
  isFavorite,
  isLoggedIn,
  onToggleFavorite,
  isAlphaToken,
  timeframe,
}: SignalDetailModalProps) {
  const animatedPosition = useAnimatedValue(signal?.positionInBox ?? 0, 1200, isOpen);

  const riskRewardRatio = signal?.riskPercent && signal.riskPercent > 0
    ? signal.profitPercent / signal.riskPercent
    : 0;

  const getRiskWarnings = () => {
    const warnings: { type: string; message: string }[] = [];
    if (signal.riskPercent > 5) {
      warnings.push({ type: "warning", message: "손절폭 5% 이상. 포지션 축소 권장" });
    }
    if (signal.positionInBox > 95) {
      warnings.push({ type: "caution", message: "저항선 매우 근접. 돌파 확인 후 진입 권장" });
    }
    if (riskRewardRatio < 1.5) {
      warnings.push({ type: "warning", message: "손익비 1:1.5 미만. 신중한 판단 필요" });
    }
    return warnings;
  };

  const riskWarnings = getRiskWarnings();

  const getBithumbLink = () => {
    const symbol = signal.symbol.replace("KRW", "").replace("USDT", "");
    return `https://www.bithumb.com/trade/order/${symbol}_KRW`;
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !signal) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
        <div
          className="relative w-full sm:max-w-lg max-h-[90vh] bg-background rounded-t-2xl sm:rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-3 sm:px-4 py-3 border-b border-border/60 gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-bold text-foreground">
                  {signal.symbol.replace("KRW", "")}
                </h2>
                {signal.signalGrade && (
                  <Badge
                    className={cn(
                      "text-[10px] px-1.5 py-0 font-bold shrink-0",
                      signal.signalGrade === "A"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : signal.signalGrade === "B"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-slate-500/20 text-foreground/80 border-slate-500/30"
                    )}
                  >
                    <Award className="w-2.5 h-2.5 mr-0.5 inline" />
                    {signal.signalGrade}등급
                  </Badge>
                )}
                {signal.isBreakout && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] px-1.5 py-0 shrink-0">
                    돌파
                  </Badge>
                )}
                {isAlphaToken && (
                  <Badge className="bg-purple-500/30 text-purple-200 border-purple-400/30 text-[10px] px-1.5 py-0 shrink-0">
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    Alpha
                  </Badge>
                )}
              </div>
              <p className="text-base sm:text-lg font-mono font-bold text-foreground/90 mt-0.5">
                {formatPrice(signal.currentPrice)}
                <span className="text-[10px] sm:text-xs text-muted-foreground ml-2">
                  Vol {formatVolume(signal.quoteVolume)}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {isLoggedIn && (
                <button
                  onClick={onToggleFavorite}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    isFavorite
                      ? "text-yellow-400 bg-yellow-500/20"
                      : "text-muted-foreground/80 hover:text-muted-foreground"
                  )}
                >
                  <Star className={cn("w-5 h-5", isFavorite && "fill-yellow-400")} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto max-h-[70vh] px-3 sm:px-4 py-3 space-y-2 sm:space-y-3">

            {/* 매매 전략 */}
            <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
              <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-emerald-400" />
                매매 전략
              </span>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-300">매수가</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-200">{formatPrice(signal.buyPrice)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400" />
                    <span className="text-[10px] text-red-300">손절가</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-red-200">{formatPrice(signal.stopLoss)}</span>
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">
                      -{signal.riskPercent.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-cyan-500/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span className="text-[10px] text-cyan-300">목표가</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-cyan-200">{formatPrice(signal.targetPrice)}</span>
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px]">
                      +{signal.profitPercent.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>
              {signal.vwma110_1h && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-violet-500/10 mt-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="text-[10px] text-violet-300">1H VWMA110</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-violet-200">{formatPrice(signal.vwma110_1h)}</span>
                    {signal.currentPrice > signal.vwma110_1h && (
                      <Badge className="bg-violet-500/20 text-violet-300 border-violet-500/30 text-[10px]">
                        매수 타점
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                <span className="text-[10px] text-muted-foreground">손익비</span>
                <span className="text-xs font-mono font-bold text-cyan-200">1 : {riskRewardRatio.toFixed(2)}</span>
              </div>
            </div>

            {/* 박스권 차트 */}
            <BoxChart signal={signal} timeframe={timeframe} />

            {/* 박스권 정보 */}
            <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
              <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                박스권 정보
              </span>
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <span className="text-[10px] text-red-300 block">저항선</span>
                  <span className="text-xs font-mono text-red-200">{formatPrice(signal.resistance)}</span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <span className="text-[10px] text-emerald-300 block">지지선</span>
                  <span className="text-xs font-mono text-emerald-200">{formatPrice(signal.support)}</span>
                </div>
                <div className="p-2 rounded-lg bg-secondary/30">
                  <span className="text-[10px] text-muted-foreground block">박스 높이</span>
                  <span className="text-xs font-mono text-foreground/90">{signal.boxHeight.toFixed(2)}%</span>
                </div>
                <div className="p-2 rounded-lg bg-secondary/30">
                  <span className="text-[10px] text-muted-foreground block">횡보 기간</span>
                  <span className="text-xs font-mono text-foreground/90">{signal.consolidationPeriods}봉</span>
                </div>
              </div>

              {/* 박스 내 위치 시각화 */}
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">박스 내 위치</span>
                  <span className={cn(
                    "text-[10px] font-mono font-bold",
                    signal.positionInBox >= 80 ? "text-orange-300" :
                    signal.positionInBox >= 50 ? "text-amber-300" :
                    "text-blue-300"
                  )}>
                    {animatedPosition.toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-14 rounded-lg overflow-hidden bg-gradient-to-b from-red-500/10 via-transparent to-emerald-500/10">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-400" />
                  <span className="absolute top-1 left-2 text-[9px] text-red-400">저항</span>
                  <div
                    className="absolute left-0 right-0 transition-all duration-1000"
                    style={{ top: `${100 - animatedPosition}%` }}
                  >
                    <div className="h-0.5 bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                    <span className="absolute right-2 -top-4 text-[9px] text-cyan-300 font-bold">현재</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400" />
                  <span className="absolute bottom-1 left-2 text-[9px] text-emerald-400">지지</span>
                </div>
              </div>
            </div>

            {/* 일목구름 */}
            {signal.ichimokuAboveCloudCount !== undefined && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-purple-400" />
                    일목구름
                  </span>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 font-mono text-[10px]">
                    {signal.ichimokuAboveCloudCount}/6
                  </Badge>
                </div>
                <div className="flex gap-1">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 h-6 rounded",
                        i < (signal.ichimokuAboveCloudCount || 0)
                          ? "bg-gradient-to-t from-cyan-600 to-cyan-400"
                          : "bg-secondary/40"
                      )}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-[8px] text-muted-foreground/80 mt-1">
                  <span>5분</span>
                  <span>15분</span>
                  <span>1시간</span>
                  <span>4시간</span>
                  <span>일봉</span>
                  <span>주봉</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {signal.ichimokuAboveCloudCount >= 4
                    ? "다중 타임프레임 구름 위 - 강한 상승"
                    : signal.ichimokuAboveCloudCount >= 2
                    ? "일부 타임프레임 구름 위"
                    : "구름 아래 - 추가 확인 필요"}
                </p>
              </div>
            )}

            {/* 스코어링 */}
            {signal.scoreDetails && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-purple-400" />
                    멀티 컨펌 스코어
                  </span>
                  <Badge className={cn(
                    "font-mono text-[10px]",
                    signal.scoreDetails.passMinScore
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border-red-500/30"
                  )}>
                    {signal.scoreDetails.totalScore}점 {signal.scoreDetails.passMinScore ? "PASS" : "FAIL"}
                  </Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground">RSI ({signal.scoreDetails.rsiValue.toFixed(0)})</span>
                    <span className={cn(
                      "text-xs font-mono font-bold",
                      signal.scoreDetails.rsiScore > 0 ? "text-emerald-300" :
                      signal.scoreDetails.rsiScore < 0 ? "text-red-300" : "text-muted-foreground"
                    )}>
                      {signal.scoreDetails.rsiScore > 0 ? "+" : ""}{signal.scoreDetails.rsiScore}점
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground">일목구름 ({signal.scoreDetails.ichimokuAboveCount}/6)</span>
                    <span className={cn(
                      "text-xs font-mono font-bold",
                      signal.scoreDetails.ichimokuScore > 0 ? "text-emerald-300" : "text-muted-foreground"
                    )}>
                      +{signal.scoreDetails.ichimokuScore}점
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground">BB 수축 {signal.scoreDetails.isBBSqueeze ? "O" : "X"}</span>
                    <span className={cn(
                      "text-xs font-mono font-bold",
                      signal.scoreDetails.bbSqueezeScore > 0 ? "text-emerald-300" : "text-muted-foreground"
                    )}>
                      +{signal.scoreDetails.bbSqueezeScore}점
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground">1H MA50 지지 {signal.scoreDetails.isMA50Support ? "O" : "X"}</span>
                    <span className={cn(
                      "text-xs font-mono font-bold",
                      signal.scoreDetails.ma50SupportScore > 0 ? "text-emerald-300" : "text-muted-foreground"
                    )}>
                      +{signal.scoreDetails.ma50SupportScore}점
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 추세 필터 */}
            {signal.trendFilter && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                    상위 추세 필터
                  </span>
                  <Badge className={cn(
                    "font-mono text-[10px]",
                    signal.trendFilter.passTrendFilter
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/20 text-red-300 border-red-500/30"
                  )}>
                    {signal.trendFilter.passTrendFilter ? "통과" : "미충족"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { label: "일봉 MA50 위", active: signal.trendFilter.dailyAboveMA50 },
                    { label: "일봉 정배열", active: signal.trendFilter.dailyGoldenArrangement },
                    { label: "1H MA50 위", active: signal.trendFilter.hourlyAboveMA50 },
                    { label: "1H MA50 지지", active: signal.trendFilter.hourlyMA50Support },
                  ].map((item) => (
                    <div key={item.label} className={cn(
                      "p-2 rounded-lg text-[10px] flex items-center gap-1",
                      item.active ? "bg-emerald-500/15 text-emerald-300" : "bg-secondary/30 text-muted-foreground"
                    )}>
                      {item.active ? <CheckCircle2 className="w-3 h-3" /> : <span className="w-3 h-3 text-center">-</span>}
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 업비트 상장 현황 */}
            {(signal.isBreakout || signal.positionInBox >= 80) && signal.hasUpbitListing !== undefined && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-400" />
                    업비트 상장 현황
                  </span>
                  {signal.upbitVolumeRatio !== undefined && signal.upbitVolumeRatio !== null && signal.upbitVolumeRatio > 0 ? (
                    <Badge className={cn(
                      "font-mono text-[10px]",
                      signal.upbitVolumeRatio >= 30
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                        : signal.upbitVolumeRatio >= 10
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    )}>
                      {signal.upbitVolumeRatio.toFixed(1)}%
                    </Badge>
                  ) : signal.hasUpbitListing ? (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">상장</Badge>
                  ) : (
                    <Badge className="bg-slate-500/20 text-muted-foreground border-slate-500/30 text-[10px]">미상장</Badge>
                  )}
                </div>
                {signal.upbitVolumeRatio !== undefined && signal.upbitVolumeRatio !== null && signal.upbitVolumeRatio > 0 && (
                  <>
                    <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          signal.upbitVolumeRatio >= 30
                            ? "bg-gradient-to-r from-rose-500 to-red-500"
                            : signal.upbitVolumeRatio >= 10
                            ? "bg-gradient-to-r from-amber-500 to-orange-500"
                            : "bg-gradient-to-r from-emerald-500 to-cyan-500"
                        )}
                        style={{ width: `${Math.min(signal.upbitVolumeRatio, 100)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">
                      {signal.upbitVolumeRatio >= 30
                        ? "업비트 거래 비중 높음 - 김프 주의"
                        : signal.upbitVolumeRatio >= 10
                        ? "업비트 거래 비중 중간"
                        : "글로벌 거래량 분산 양호"}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* BTC 독립성 */}
            {(signal.isBreakout || signal.positionInBox >= 80) && signal.btcDecouplingScore !== undefined && signal.btcDecouplingScore !== null && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
                    BTC 독립성 지수
                  </span>
                  <Badge className={cn(
                    "font-mono text-[10px]",
                    signal.btcDecouplingScore >= 60
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : signal.btcDecouplingScore >= 40
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                  )}>
                    {signal.btcDecouplingScore}/100
                  </Badge>
                </div>
                <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      signal.btcDecouplingScore >= 60
                        ? "bg-gradient-to-r from-emerald-500 to-cyan-500"
                        : signal.btcDecouplingScore >= 40
                        ? "bg-gradient-to-r from-amber-500 to-orange-500"
                        : "bg-gradient-to-r from-rose-500 to-red-500"
                    )}
                    style={{ width: `${signal.btcDecouplingScore}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[10px] text-muted-foreground">
                    {signal.btcDecouplingScore >= 60
                      ? "BTC와 독립적 움직임"
                      : signal.btcDecouplingScore >= 40
                      ? "BTC와 중간 수준 연동"
                      : "BTC와 높은 연동성"}
                  </p>
                  {signal.btcRelativeStatus && (
                    <Badge className={cn(
                      "text-[10px]",
                      signal.btcRelativeStatus === "강한 독립" || signal.btcRelativeStatus === "역행"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : signal.btcRelativeStatus === "약한 독립"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                        : "bg-slate-500/20 text-foreground/80 border-slate-500/30"
                    )}>
                      {signal.btcRelativeStatus}
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* 분할 목표가 */}
            {signal.multipleTargets && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  분할 목표가
                </span>
                <div className="space-y-1.5 mt-2">
                  <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground">1차 목표</span>
                    <span className="text-xs font-mono font-bold text-cyan-200">{formatPrice(signal.multipleTargets.tp1)}</span>
                  </div>
                  {signal.multipleTargets.tp2 && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground">2차 목표 (MA)</span>
                      <span className="text-xs font-mono font-bold text-cyan-200">{formatPrice(signal.multipleTargets.tp2)}</span>
                    </div>
                  )}
                  {signal.multipleTargets.tp3 && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground">3차 목표</span>
                      <span className="text-xs font-mono font-bold text-cyan-200">{formatPrice(signal.multipleTargets.tp3)}</span>
                    </div>
                  )}
                  {signal.multipleTargets.trailingStopBase && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <span className="text-[10px] text-amber-400">트레일링 기준</span>
                      <span className="text-xs font-mono font-bold text-amber-200">{formatPrice(signal.multipleTargets.trailingStopBase)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 손절가 옵션 */}
            {signal.structuralStopLoss && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                  손절가 옵션
                </span>
                <div className="space-y-1.5 mt-2">
                  {signal.structuralStopLoss.maBasedStopLoss && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground">MA50 기반</span>
                      <span className="text-xs font-mono text-red-200">{formatPrice(signal.structuralStopLoss.maBasedStopLoss)}</span>
                    </div>
                  )}
                  {signal.structuralStopLoss.bbLowerStopLoss && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground">볼린저 하단</span>
                      <span className="text-xs font-mono text-red-200">{formatPrice(signal.structuralStopLoss.bbLowerStopLoss)}</span>
                    </div>
                  )}
                  {signal.structuralStopLoss.atrBasedStopLoss && (
                    <div className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground">ATR 기반</span>
                      <span className="text-xs font-mono text-red-200">{formatPrice(signal.structuralStopLoss.atrBasedStopLoss)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-semibold">권장 손절가</span>
                    <span className="text-xs font-mono font-bold text-emerald-200">{formatPrice(signal.structuralStopLoss.recommendedStopLoss)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 돌파 캔들 품질 */}
            {signal.isBreakout && signal.breakoutQuality && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                    돌파 캔들 품질
                  </span>
                  <Badge className={cn(
                    "font-mono text-[10px]",
                    signal.breakoutQuality.isQualityBreakout
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                  )}>
                    {signal.breakoutQuality.isQualityBreakout ? "품질 우수" : "보통"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground block">종가 위치</span>
                    <span className="text-xs font-mono text-foreground/90">{(signal.breakoutQuality.closePosition * 100).toFixed(0)}%</span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground block">몸통 비율</span>
                    <span className="text-xs font-mono text-foreground/90">{(signal.breakoutQuality.bodyRatio * 100).toFixed(0)}%</span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground block">상대 거래량</span>
                    <span className="text-xs font-mono text-foreground/90">{signal.breakoutQuality.relativeVolume.toFixed(1)}x</span>
                  </div>
                  <div className="p-2 rounded-lg bg-secondary/30">
                    <span className="text-[10px] text-muted-foreground block">ATR 돌파폭</span>
                    <span className="text-xs font-mono text-foreground/90">{signal.breakoutQuality.atrBreakoutRatio.toFixed(2)}x</span>
                  </div>
                </div>
              </div>
            )}

            {/* 리테스트 */}
            {signal.retestInfo?.isRetest && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[11px] sm:text-xs font-semibold text-blue-300">리테스트 진입 신호</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  돌파 후 {signal.retestInfo.candlesSinceBreakout}캔들 경과,
                  저항선에서 지지 {signal.retestInfo.supportConfirmed ? "확인" : "미확인"}
                </p>
                {signal.retestInfo.retestPrice && (
                  <p className="text-xs font-mono text-blue-200 mt-1">
                    리테스트가: {formatPrice(signal.retestInfo.retestPrice)}
                  </p>
                )}
              </div>
            )}

            {/* 추가 지표 */}
            {(signal.bollingerBands || signal.atr || (signal.currentRsi !== null && signal.currentRsi !== undefined)) && (
              <div className="rounded-xl bg-secondary/40 border border-border/60 p-2.5 sm:p-3">
                <span className="text-[11px] sm:text-xs font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                  추가 지표
                </span>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {signal.bollingerBands && (
                    <div className="p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground block">BB %B</span>
                      <span className="text-xs font-mono text-foreground/90">
                        {(signal.bollingerBands.percentB * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                  {signal.atr && (
                    <div className="p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground block">ATR</span>
                      <span className="text-xs font-mono text-foreground/90">{formatPrice(signal.atr)}</span>
                    </div>
                  )}
                  {signal.currentRsi !== null && signal.currentRsi !== undefined && (
                    <div className="p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground block">RSI</span>
                      <span className={cn(
                        "text-xs font-mono font-bold",
                        signal.currentRsi >= 70 ? "text-red-300" :
                        signal.currentRsi <= 30 ? "text-emerald-300" : "text-foreground/90"
                      )}>
                        {signal.currentRsi.toFixed(0)}
                      </span>
                    </div>
                  )}
                  {signal.resistanceTouchCount !== undefined && (
                    <div className="p-2 rounded-lg bg-secondary/30">
                      <span className="text-[10px] text-muted-foreground block">저항선 터치</span>
                      <span className="text-xs font-mono text-foreground/90">{signal.resistanceTouchCount}회</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 리스크 경고 */}
            {riskWarnings.length > 0 && (
              <div className="space-y-1.5">
                {riskWarnings.map((warning, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg p-2.5 flex items-center gap-2 text-xs",
                      warning.type === "warning" && "bg-red-500/10 border border-red-500/20",
                      warning.type === "caution" && "bg-amber-500/10 border border-amber-500/20"
                    )}
                  >
                    <AlertTriangle className={cn(
                      "w-3.5 h-3.5 shrink-0",
                      warning.type === "warning" ? "text-red-400" : "text-amber-400"
                    )} />
                    <span className={warning.type === "warning" ? "text-red-200" : "text-amber-200"}>
                      {warning.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-lg bg-secondary/30 p-2.5">
              <p className="text-[10px] text-muted-foreground/80 leading-relaxed text-center">
                투자 권유가 아니며, 투자 결정은 본인 책임입니다
              </p>
            </div>
          </div>

          {/* Fixed Bottom CTA */}
          <div className="shrink-0 bg-background border-t border-border/60 p-3 sm:p-4 pb-safe">
            <div className="flex gap-2">
              <a
                href={getBithumbLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 active:from-orange-600 active:to-orange-700 text-foreground font-bold text-sm transition-all shadow-lg shadow-orange-500/25"
              >
                <ExternalLink className="w-4 h-4" />
                빗썸에서 거래
              </a>
              {isLoggedIn && (
                <button
                  onClick={onToggleFavorite}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-3 px-4 rounded-xl border transition-all",
                    isFavorite
                      ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-300"
                      : "bg-secondary/30 border-border/60 text-foreground/80 active:bg-secondary/40"
                  )}
                >
                  <Star className={cn("w-4 h-4", isFavorite && "fill-yellow-400")} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
