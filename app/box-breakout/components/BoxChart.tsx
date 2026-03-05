"use client";

import { useEffect, useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { BoxBreakoutSignal } from "@/shared/types";

interface Candle {
  time: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

const W = 660;
const H = 380;
const PAD = { t: 14, r: 58, b: 24, l: 8 };

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getDate().toString().padStart(2, "0")}`;
}

const TF_LABEL: Record<string, string> = {
  "1m": "1분봉",
  "5m": "5분봉",
  "15m": "15분봉",
  "30m": "30분봉",
  "1h": "1시간봉",
  "4h": "4시간봉",
  "1d": "일봉",
};

interface BoxChartProps {
  signal: BoxBreakoutSignal;
  timeframe: string;
}

export function BoxChart({ signal, timeframe }: BoxChartProps) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchCandles = async () => {
      setLoading(true);
      setError(false);
      try {
        const symbol = signal.symbol;
        const res = await fetch(
          `/api/bithumb/kline?symbol=${symbol}&interval=${timeframe}&limit=100`
        );
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setCandles(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCandles();
    return () => { cancelled = true; };
  }, [signal.symbol, timeframe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 rounded-xl bg-white/5 border border-white/10">
        <Loader2 className="h-4 w-4 animate-spin text-slate-400 mr-2" />
        <span className="text-xs text-slate-400">차트 로딩 중...</span>
      </div>
    );
  }

  if (error || candles.length < 10) {
    return (
      <div className="flex items-center justify-center h-20 rounded-xl bg-white/5 border border-white/10">
        <span className="text-xs text-slate-500">차트 데이터를 불러올 수 없습니다</span>
      </div>
    );
  }

  const cw = W - PAD.l - PAD.r;
  const ch = H - PAD.t - PAD.b;

  // Price range including box lines
  const allPrices = candles.flatMap((c) => [c.high, c.low]);
  allPrices.push(signal.resistance, signal.support);
  if (signal.targetPrice) allPrices.push(signal.targetPrice);
  if (signal.stopLoss) allPrices.push(signal.stopLoss);

  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const margin = (rawMax - rawMin) * 0.05;
  const minP = rawMin - margin;
  const maxP = rawMax + margin;
  const pRange = maxP - minP || 1;

  const yOf = (p: number) => PAD.t + ch * (1 - (p - minP) / pRange);
  const xOf = (i: number) => PAD.l + (i + 0.5) * (cw / candles.length);
  const barW = Math.max(cw / candles.length * 0.65, 1);

  // X-axis labels
  const xLabels: { x: number; label: string }[] = [];
  const step = Math.max(Math.floor(candles.length / 6), 1);
  for (let i = 0; i < candles.length; i += step) {
    xLabels.push({ x: xOf(i), label: formatTime(candles[i].time) });
  }

  const clipId = `box-clip-${signal.symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  const boxTopY = yOf(signal.resistance);
  const boxBotY = yOf(signal.support);
  const targetY = signal.targetPrice ? yOf(signal.targetPrice) : null;
  const stopY = signal.stopLoss ? yOf(signal.stopLoss) : null;

  return (
    <div className="rounded-xl bg-secondary/40 border border-border/60 p-2 md:p-3 overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-muted-foreground font-medium">
          {signal.symbol.replace("KRW", "")} · {TF_LABEL[timeframe] || timeframe} · {candles.length}캔들
        </span>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-2 bg-cyan-500/20 border border-cyan-500/40 rounded-sm" />
            박스권
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-emerald-400 rounded" />
            현재가
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minHeight: 220 }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={PAD.l} y={PAD.t} width={cw} height={ch} />
          </clipPath>
        </defs>

        {/* Background */}
        <rect x={PAD.l} y={PAD.t} width={cw} height={ch} fill="rgba(255,255,255,0.015)" rx={3} />

        {/* Grid */}
        {[0.2, 0.4, 0.6, 0.8].map((r) => (
          <line
            key={r}
            x1={PAD.l} y1={PAD.t + ch * r} x2={W - PAD.r} y2={PAD.t + ch * r}
            stroke="rgba(255,255,255,0.04)"
          />
        ))}

        {/* Box zone fill */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x={PAD.l} y={boxTopY} width={cw}
            height={Math.max(boxBotY - boxTopY, 0)}
            fill="rgba(34, 211, 238, 0.06)"
          />
          {/* Resistance line */}
          <line
            x1={PAD.l} y1={boxTopY} x2={W - PAD.r} y2={boxTopY}
            stroke="#ef4444" strokeWidth={1} strokeDasharray="5 3" opacity={0.8}
          />
          {/* Support line */}
          <line
            x1={PAD.l} y1={boxBotY} x2={W - PAD.r} y2={boxBotY}
            stroke="#22c55e" strokeWidth={1} strokeDasharray="5 3" opacity={0.8}
          />
        </g>

        {/* Target price line */}
        {targetY !== null && (
          <g clipPath={`url(#${clipId})`}>
            <line
              x1={PAD.l} y1={targetY} x2={W - PAD.r} y2={targetY}
              stroke="#22d3ee" strokeWidth={0.8} strokeDasharray="3 4" opacity={0.5}
            />
          </g>
        )}

        {/* Stop loss line */}
        {stopY !== null && (
          <g clipPath={`url(#${clipId})`}>
            <line
              x1={PAD.l} y1={stopY} x2={W - PAD.r} y2={stopY}
              stroke="#f87171" strokeWidth={0.8} strokeDasharray="3 4" opacity={0.5}
            />
          </g>
        )}

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const x = xOf(i);
          const isUp = c.close >= c.open;
          const color = isUp ? "#22c55e" : "#ef4444";
          const bodyTop = yOf(Math.max(c.open, c.close));
          const bodyBot = yOf(Math.min(c.open, c.close));
          const bodyH = Math.max(bodyBot - bodyTop, 0.5);

          return (
            <g key={i}>
              <line
                x1={x} y1={yOf(c.high)} x2={x} y2={yOf(c.low)}
                stroke={color} strokeWidth={0.7} opacity={0.6}
              />
              <rect
                x={x - barW / 2} y={bodyTop} width={barW} height={bodyH}
                fill={isUp ? "transparent" : color} stroke={color} strokeWidth={0.7}
              />
            </g>
          );
        })}

        {/* Current price line + label */}
        <line
          x1={PAD.l} y1={yOf(signal.currentPrice)} x2={W - PAD.r} y2={yOf(signal.currentPrice)}
          stroke="#10b981" strokeWidth={1.5} opacity={0.9}
        />
        <rect
          x={W - PAD.r + 1} y={yOf(signal.currentPrice) - 7} width={54} height={14} rx={3}
          fill="#10b981"
        />
        <text
          x={W - PAD.r + 4} y={yOf(signal.currentPrice)}
          fill="white" fontSize="7.5" dominantBaseline="middle" fontWeight="700"
        >
          {formatPrice(signal.currentPrice)}
        </text>

        {/* Resistance label */}
        <rect
          x={W - PAD.r + 1} y={boxTopY - 6} width={54} height={12} rx={2}
          fill="rgba(239,68,68,0.2)"
        />
        <text
          x={W - PAD.r + 4} y={boxTopY}
          fill="#ef4444" fontSize="7" dominantBaseline="middle" fontWeight="600"
        >
          {formatPrice(signal.resistance)}
        </text>

        {/* Support label */}
        {Math.abs(boxBotY - yOf(signal.currentPrice)) > 16 && (
          <>
            <rect
              x={W - PAD.r + 1} y={boxBotY - 6} width={54} height={12} rx={2}
              fill="rgba(34,197,94,0.2)"
            />
            <text
              x={W - PAD.r + 4} y={boxBotY}
              fill="#22c55e" fontSize="7" dominantBaseline="middle" fontWeight="600"
            >
              {formatPrice(signal.support)}
            </text>
          </>
        )}

        {/* Target label */}
        {targetY !== null && Math.abs(targetY - yOf(signal.currentPrice)) > 16 && Math.abs(targetY - boxTopY) > 16 && (
          <>
            <rect
              x={W - PAD.r + 1} y={targetY - 6} width={54} height={12} rx={2}
              fill="rgba(34,211,238,0.15)"
            />
            <text
              x={W - PAD.r + 4} y={targetY}
              fill="#22d3ee" fontSize="7" dominantBaseline="middle" fontWeight="600"
            >
              {formatPrice(signal.targetPrice)}
            </text>
          </>
        )}

        {/* Breakout badge */}
        {signal.isBreakout && (
          <>
            <rect
              x={W - PAD.r - 42} y={PAD.t + 4} width={40} height={16} rx={4}
              fill="rgba(16,185,129,0.25)" stroke="rgba(16,185,129,0.5)" strokeWidth={0.8}
            />
            <text
              x={W - PAD.r - 22} y={PAD.t + 12}
              fill="#34d399" fontSize="8.5" fontWeight="700" textAnchor="middle" dominantBaseline="middle"
            >
              돌파
            </text>
          </>
        )}

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 4} fill="rgba(255,255,255,0.3)" fontSize="8" textAnchor="middle">
            {l.label}
          </text>
        ))}

        {/* Y-axis prices */}
        <text x={PAD.l + 2} y={PAD.t + 10} fill="rgba(255,255,255,0.25)" fontSize="8">
          {formatPrice(maxP)}
        </text>
        <text x={PAD.l + 2} y={H - PAD.b - 2} fill="rgba(255,255,255,0.25)" fontSize="8">
          {formatPrice(minP)}
        </text>
      </svg>
    </div>
  );
}
