'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/app/components/Header';
import { Trophy, Save, Loader2, ChevronDown, ArrowLeft } from 'lucide-react';

const ADMIN_EMAILS = ['thinkisall@gmail.com', 'bitdamoabom@gmail.com'];

interface Pick {
  rank: number;
  symbol: string;
  reason: string;
}

const RANK_COLORS = [
  'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  'text-zinc-300 border-zinc-500/40 bg-zinc-500/10',
  'text-orange-400 border-orange-500/40 bg-orange-500/10',
  'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  'text-purple-400 border-purple-500/40 bg-purple-500/10',
];
const RANK_LABELS = ['1위', '2위', '3위', '4위', '5위'];

async function fetchBithumbCoins(): Promise<string[]> {
  const res = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW');
  const json = await res.json();
  if (json.status !== '0000') return [];
  return Object.keys(json.data).filter((s) => s !== 'date').sort();
}

export default function AdminPicksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [picks, setPicks] = useState<Pick[]>([
    { rank: 1, symbol: '', reason: '' },
    { rank: 2, symbol: '', reason: '' },
    { rank: 3, symbol: '', reason: '' },
    { rank: 4, symbol: '', reason: '' },
    { rank: 5, symbol: '', reason: '' },
  ]);
  const [allCoins, setAllCoins] = useState<string[]>([]);
  const [coinsLoading, setCoinsLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<{ index: number; list: string[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isAdmin = ADMIN_EMAILS.includes(user?.email || '');

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    fetchBithumbCoins()
      .then(setAllCoins)
      .finally(() => setCoinsLoading(false));
  }, []);

  // 기존 저장된 픽 불러오기
  useEffect(() => {
    fetch('/api/daily-picks')
      .then((r) => r.json())
      .then(({ picks: saved }) => {
        if (!saved || saved.length === 0) return;
        setPicks((prev) =>
          prev.map((p) => {
            const found = saved.find((s: any) => s.rank === p.rank);
            return found ? { rank: p.rank, symbol: found.symbol, reason: found.reason || '' } : p;
          })
        );
      })
      .catch(() => {});
  }, []);

  if (loading || !user || !isAdmin) return null;

  const updatePick = (index: number, field: 'symbol' | 'reason', value: string) => {
    setPicks((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)));
  };

  const handleSymbolInput = (index: number, value: string) => {
    const upper = value.toUpperCase();
    updatePick(index, 'symbol', upper);
    const filtered = upper
      ? allCoins.filter((c) => c.includes(upper)).slice(0, 40)
      : allCoins.slice(0, 40);
    setSuggestions({ index, list: filtered });
  };

  const selectCoin = (index: number, coin: string) => {
    updatePick(index, 'symbol', coin);
    setSuggestions(null);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/daily-picks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email || '',
        },
        body: JSON.stringify({ picks }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '저장 실패');
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-2xl">
        <button
          onClick={() => router.push('/admin')}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          관리자 페이지로
        </button>

        <div className="flex items-center gap-2 mb-6">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h1 className="text-lg sm:text-xl font-bold text-white">오늘의 픽 설정</h1>
        </div>

        <div className="space-y-3">
          {picks.map((pick, i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-sm font-bold px-2.5 py-1 rounded-lg border ${RANK_COLORS[i]}`}>
                  {RANK_LABELS[i]}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 종목 입력 */}
                <div className="relative">
                  <label className="block text-xs text-zinc-400 mb-1">종목 심볼</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={pick.symbol}
                      onChange={(e) => handleSymbolInput(i, e.target.value)}
                      onFocus={() => handleSymbolInput(i, pick.symbol)}
                      onBlur={() => setTimeout(() => setSuggestions(null), 150)}
                      placeholder="예: BTC"
                      className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500/50"
                    />
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />

                    {suggestions?.index === i && suggestions.list.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                        {coinsLoading ? (
                          <div className="flex items-center justify-center py-4 gap-2 text-zinc-400 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            불러오는 중...
                          </div>
                        ) : (
                          <div className="p-2 flex flex-wrap gap-1">
                            {suggestions.list.map((coin) => (
                              <button
                                key={coin}
                                type="button"
                                onMouseDown={() => selectCoin(i, coin)}
                                className="px-2 py-1 text-xs font-semibold rounded-lg bg-zinc-700/60 hover:bg-yellow-500/20 hover:text-yellow-300 text-zinc-300 transition-colors"
                              >
                                {coin}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 한 줄 이유 */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">한 줄 이유 (선택)</label>
                  <input
                    type="text"
                    value={pick.reason}
                    onChange={(e) => updatePick(i, 'reason', e.target.value)}
                    placeholder="예: 박스권 상단 돌파 임박"
                    maxLength={60}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500/50"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors disabled:opacity-50"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 저장 중...</>
            ) : saved ? (
              '저장 완료!'
            ) : (
              <><Save className="w-4 h-4" /> 저장하기</>
            )}
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-600 text-center">
          저장하면 메인 페이지 "오늘의 픽" 섹션에 즉시 반영됩니다
        </p>
      </main>
    </div>
  );
}
