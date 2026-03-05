'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Loader2 } from 'lucide-react';

interface Pick {
  rank: number;
  symbol: string;
  reason: string | null;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉', '4위', '5위'];
const RANK_COLORS = [
  { border: 'border-yellow-500/30', bg: 'bg-yellow-500/8', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { border: 'border-zinc-500/30',   bg: 'bg-zinc-500/5',   badge: 'bg-zinc-500/20  text-zinc-300  border-zinc-500/30'   },
  { border: 'border-orange-500/30', bg: 'bg-orange-500/8', badge: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { border: 'border-cyan-500/30',   bg: 'bg-cyan-500/5',   badge: 'bg-cyan-500/20   text-cyan-300   border-cyan-500/30'   },
  { border: 'border-purple-500/30', bg: 'bg-purple-500/5', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
];

export default function DailyPicks() {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/daily-picks')
      .then((r) => r.json())
      .then(({ picks }) => setPicks(picks || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && picks.length === 0) return null;

  return (
    <div className="mb-4 sm:mb-6 rounded-xl border border-yellow-500/20 bg-zinc-900 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-zinc-800 bg-linear-to-r from-yellow-500/5 to-transparent">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-bold text-white">오늘의 픽</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 font-semibold">
            관리자 선정
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
          <TrendingUp className="w-3 h-3" />
          매일 업데이트
        </div>
      </div>

      {/* 픽 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-zinc-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          불러오는 중...
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/60">
          {picks.map((pick, i) => {
            const colors = RANK_COLORS[i] || RANK_COLORS[4];
            return (
              <div
                key={pick.rank}
                className={`flex items-center gap-3 px-4 sm:px-5 py-3 ${colors.bg} transition-colors hover:brightness-110`}
              >
                {/* 순위 */}
                <div className="w-8 text-center shrink-0">
                  <span className="text-base sm:text-lg leading-none">
                    {i < 3 ? RANK_MEDALS[i] : (
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${colors.badge}`}>
                        {RANK_MEDALS[i]}
                      </span>
                    )}
                  </span>
                </div>

                {/* 심볼 */}
                <div className={`shrink-0 px-2.5 py-1 rounded-lg border text-sm font-bold ${colors.badge}`}>
                  {pick.symbol}
                </div>

                {/* 이유 */}
                <div className="flex-1 min-w-0">
                  {pick.reason ? (
                    <p className="text-xs text-zinc-400 truncate">{pick.reason}</p>
                  ) : (
                    <p className="text-xs text-zinc-600">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
