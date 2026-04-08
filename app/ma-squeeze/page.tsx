'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { getHomeServerUrl } from '@/lib/home-server';
import MaSqueezeChartModal from './components/MaSqueezeChartModal';
import { useAuth } from '@/contexts/AuthContext';

interface SqueezeItem {
  symbol: string;
  exchange: string;
  currentPrice: number;
  volume: number;
  changeRate: number;
  aboveCloud1d: boolean;
  aboveCloud4h: boolean;
  aboveCloud1h: boolean;
  ma50_1h: number;
  ma110_1h: number;
  ma180_1h: number;
  ma50_4h: number;
  ma110_4h: number;
  ma180_4h: number;
  hasBox: boolean;
  boxTop: number | null;
  boxBottom: number | null;
  boxRange: number | null;
  isBreakout: boolean;
  positionInBox: number | null;
  buyPrice: number | null;
  stopLoss: number | null;
  profitTarget: number | null;
  volumeSurge: boolean;
  score: number;
}

interface ScanResult {
  items: SqueezeItem[];
  scannedCount: number;
  matchedCount: number;
  scannedAt: string;
  isAnalyzing?: boolean;
  fromCache?: boolean;
  countByExchange?: { upbit: number; bithumb: number; bybit: number };
}

type TabType = 'all' | 'upbit' | 'bithumb' | 'bybit';

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (price >= 1) return price.toLocaleString('ko-KR', { maximumFractionDigits: 4 });
  return price.toFixed(6);
}

function formatVolume(vol: number, exchange: string): string {
  if (exchange === 'bybit') {
    if (vol >= 1_000_000) return (vol / 1_000_000).toFixed(1) + 'M';
    if (vol >= 1_000) return (vol / 1_000).toFixed(1) + 'K';
    return vol.toFixed(0);
  }
  if (vol >= 100_000_000) return (vol / 100_000_000).toFixed(1) + '억';
  if (vol >= 10_000) return (vol / 10_000).toFixed(0) + '만';
  return vol.toFixed(0);
}

const EXCHANGE_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  upbit:   { label: '업비트', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  bithumb: { label: '빗썸',   color: 'text-blue-400',   bg: 'bg-blue-500/10'   },
  bybit:   { label: 'Bybit',  color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
};

function CloudBadge({ above, label }: { above: boolean; label: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${above ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
      {label}
    </span>
  );
}

function BoxPositionBar({ positionInBox, isBreakout }: { positionInBox: number; isBreakout: boolean }) {
  const pct = Math.min(100, Math.max(0, positionInBox));
  const barColor = isBreakout
    ? 'bg-red-400'
    : pct >= 80 ? 'bg-amber-400' : pct >= 50 ? 'bg-emerald-400' : 'bg-zinc-500';
  return (
    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function MaSqueezePage() {
  const router = useRouter();
  const { isPremium, user, loading: authLoading } = useAuth();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<SqueezeItem | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getHomeServerUrl('/api/ma-squeeze'));
      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
      const data: ScanResult = await res.json();
      setResult(data);
      setLastFetched(new Date());
    } catch (e: any) {
      setError(e.message || '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, result?.isAnalyzing ? 10_000 : 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData, result?.isAnalyzing]);

  const filteredItems = result?.items.filter(
    (item) => activeTab === 'all' || item.exchange === activeTab
  ) ?? [];

  const counts = result?.countByExchange ?? { upbit: 0, bithumb: 0, bybit: 0 };

  const tabs: { key: TabType; label: string; activeColor: string }[] = [
    { key: 'all',     label: `전체 ${result?.matchedCount ?? 0}`, activeColor: 'bg-zinc-700 text-white' },
    { key: 'upbit',   label: `업비트 ${counts.upbit}`,            activeColor: 'bg-purple-500/20 text-purple-400 border border-purple-500/40' },
    { key: 'bithumb', label: `빗썸 ${counts.bithumb}`,            activeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/40' },
    { key: 'bybit',   label: `Bybit ${counts.bybit}`,             activeColor: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
  ];

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // 비로그인 or 비프리미엄 → 게이트 화면
  if (!user || !isPremium) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-5xl">
          <div className="pointer-events-none select-none blur-sm opacity-30 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-zinc-800 animate-pulse" />
            ))}
          </div>
          <div className="flex items-center justify-center -mt-52">
            <div className="text-center bg-zinc-900/95 backdrop-blur-md border border-emerald-500/30 rounded-2xl px-6 py-8 shadow-2xl w-full max-w-xs mx-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-white mb-2">구름대 위 정배열 스캐너</h3>
              <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
                이 기능은 <span className="text-emerald-400 font-semibold">프리미엄 회원</span>만<br />이용할 수 있습니다.
              </p>
              <button
                onClick={() => router.push('/premium')}
                className="w-full py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-emerald-500 text-white font-bold text-sm hover:from-emerald-500 hover:to-emerald-400 transition-all mb-2.5"
              >
                프리미엄 구독하기
              </button>
              {!user && (
                <button
                  onClick={() => router.push('/auth/login')}
                  className="w-full py-2.5 rounded-xl border border-zinc-700 text-sm text-zinc-400 hover:bg-zinc-800 transition-colors"
                >
                  로그인하기
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">

        {/* 헤더 카드 */}
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">일목구름</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">정배열</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 border border-zinc-600">박스권</span>
              </div>
              <h1 className="text-sm sm:text-xl font-bold text-white">구름대 위 정배열 스캐너</h1>
              <p className="text-[10px] sm:text-xs text-zinc-400 mt-1 leading-relaxed">
                <span className="text-zinc-300">①</span> 일봉·4h 구름 위{' '}
                → <span className="text-zinc-300">②</span> 1h·4h <span className="text-emerald-400">구름 위</span>{' '}
                + <span className="text-cyan-400">MA정배열</span>
                {' '}+ <span className="text-amber-400">박스권 분석</span>
              </p>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
            >
              {loading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span className="hidden sm:inline">{loading ? '스캔 중...' : '새로고침'}</span>
            </button>
          </div>

          {result && (
            <div className="mt-2.5 pt-2.5 border-t border-zinc-800 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-500">
              <span>스캔 <span className="text-zinc-300">{result.scannedCount.toLocaleString()}</span></span>
              <span>충족 <span className="text-emerald-400 font-bold">{result.matchedCount}</span></span>
              {lastFetched && <span>갱신 <span className="text-zinc-300">{lastFetched.toLocaleTimeString('ko-KR')}</span></span>}
              {result.isAnalyzing && <span className="text-yellow-500/70 animate-pulse">스캔 중...</span>}
              {result.fromCache && !result.isAnalyzing && <span className="text-zinc-600">캐시</span>}
            </div>
          )}
        </div>

        {/* 에러 */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-red-400 text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* 초기 로딩 */}
        {loading && !result && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-zinc-400">전종목 스캔 중...</p>
          </div>
        )}

        {/* 탭 */}
        {result && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab.key ? tab.activeColor : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── 모바일: 카드 리스트 ── */}
        {filteredItems.length > 0 && (
          <>
            {/* 모바일 카드 */}
            <div className="sm:hidden space-y-2">
              {filteredItems.map((item, idx) => {
                const exStyle = EXCHANGE_STYLE[item.exchange] ?? { label: item.exchange, color: 'text-zinc-400', bg: 'bg-zinc-800' };
                const changeColor = item.changeRate > 0 ? 'text-red-400' : 'text-blue-400';
                const changeSign = item.changeRate > 0 ? '+' : '';

                return (
                  <div
                    key={`${item.exchange}-${item.symbol}`}
                    onClick={() => setSelectedItem(item)}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 active:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {/* 1행: 순위 + 심볼 + 뱃지 + 등락률 */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] text-zinc-600 shrink-0 w-5 text-center">{idx + 1}</span>
                        <span className="text-base font-bold text-white truncate">{item.symbol}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {item.score >= 6 && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">A</span>
                          )}
                          {item.isBreakout && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">돌파</span>
                          )}
                          {item.volumeSurge && (
                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">V</span>
                          )}
                        </div>
                      </div>
                      <span className={`text-base font-bold shrink-0 ${changeColor}`}>
                        {changeSign}{item.changeRate.toFixed(2)}%
                      </span>
                    </div>

                    {/* 2행: 거래소 + 구름뱃지 + 현재가 + 거래대금 */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${exStyle.bg} ${exStyle.color}`}>
                          {exStyle.label}
                        </span>
                        <CloudBadge above={item.aboveCloud1d} label="일" />
                        <CloudBadge above={item.aboveCloud4h} label="4h" />
                        <CloudBadge above={item.aboveCloud1h} label="1h" />
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-medium text-white">{formatPrice(item.currentPrice)}</div>
                        <div className="text-[10px] text-zinc-500">{formatVolume(item.volume, item.exchange)}</div>
                      </div>
                    </div>

                    {/* 3행: MA 정보 */}
                    <div className="flex items-center gap-3 mb-2 text-[10px]">
                      <span className="text-zinc-600">1h MA</span>
                      <span className="text-cyan-400">{formatPrice(item.ma50_1h)}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-purple-400">{formatPrice(item.ma110_1h)}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-orange-400">{formatPrice(item.ma180_1h)}</span>
                    </div>

                    {/* 4행: 박스권 */}
                    {item.hasBox ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 shrink-0">박스</span>
                        <div className="flex-1">
                          <BoxPositionBar positionInBox={item.positionInBox!} isBreakout={item.isBreakout} />
                        </div>
                        <span className="text-[10px] text-zinc-400 shrink-0">{item.positionInBox!.toFixed(0)}%</span>
                        <span className="text-[10px] text-zinc-600 shrink-0">
                          {formatPrice(item.boxBottom!)}–{formatPrice(item.boxTop!)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[10px] text-zinc-700">박스권 없음</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── 데스크탑: 테이블 ── */}
            <div className="hidden sm:block rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[1fr_95px_55px_55px_55px_100px_120px_65px] bg-zinc-900 px-3 py-2 text-xs text-zinc-500 font-medium border-b border-zinc-800">
                <span>종목</span>
                <span className="text-right">거래대금</span>
                <span className="text-right text-cyan-400">MA50</span>
                <span className="text-right text-purple-400">MA110</span>
                <span className="text-right text-orange-400">MA180</span>
                <span className="text-center">구름대</span>
                <span className="text-center">박스권</span>
                <span className="text-right">등락률</span>
              </div>

              <div className="divide-y divide-zinc-800/60">
                {filteredItems.map((item, idx) => {
                  const exStyle = EXCHANGE_STYLE[item.exchange] ?? { label: item.exchange, color: 'text-zinc-400', bg: '' };
                  const changeColor = item.changeRate > 0 ? 'text-red-400' : 'text-blue-400';

                  return (
                    <div
                      key={`${item.exchange}-${item.symbol}`}
                      onClick={() => setSelectedItem(item)}
                      className="grid grid-cols-[1fr_95px_55px_55px_55px_100px_120px_65px] px-3 py-2.5 cursor-pointer hover:bg-zinc-900/60 active:bg-zinc-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-zinc-600 w-5 shrink-0">{idx + 1}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-white truncate">{item.symbol}</span>
                            {item.score >= 6 && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">A</span>}
                            {item.isBreakout && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">돌파</span>}
                            {item.volumeSurge && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">V급등</span>}
                          </div>
                          <div className={`text-[10px] font-medium ${exStyle.color}`}>{exStyle.label}</div>
                        </div>
                      </div>
                      <div className="text-right self-center">
                        <div className="text-xs font-medium text-white">{formatVolume(item.volume, item.exchange)}</div>
                        <div className="text-[10px] text-zinc-500">{formatPrice(item.currentPrice)}</div>
                      </div>
                      <div className="text-right self-center text-xs text-cyan-400">{formatPrice(item.ma50_1h)}</div>
                      <div className="text-right self-center text-xs text-purple-400">{formatPrice(item.ma110_1h)}</div>
                      <div className="text-right self-center text-xs text-orange-400">{formatPrice(item.ma180_1h)}</div>
                      <div className="flex items-center justify-center gap-1 self-center">
                        <CloudBadge above={item.aboveCloud1d} label="일" />
                        <CloudBadge above={item.aboveCloud4h} label="4h" />
                        <CloudBadge above={item.aboveCloud1h} label="1h" />
                      </div>
                      <div className="self-center px-2">
                        {item.hasBox ? (
                          <div className="flex flex-col gap-0.5">
                            <BoxPositionBar positionInBox={item.positionInBox!} isBreakout={item.isBreakout} />
                            <div className="flex justify-between text-[9px] text-zinc-600">
                              <span>{formatPrice(item.boxBottom!)}</span>
                              <span>{formatPrice(item.boxTop!)}</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-zinc-700 block text-center">-</span>
                        )}
                      </div>
                      <div className="text-right self-center">
                        <span className={`text-xs font-bold ${changeColor}`}>
                          {item.changeRate > 0 ? '+' : ''}{item.changeRate.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* 스캔 진행 중 */}
        {result && filteredItems.length === 0 && !loading && result.isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-8 h-8 animate-spin text-emerald-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-zinc-400">전종목 스캔 중... 잠시 기다려주세요</p>
            <p className="text-xs text-zinc-600">완료 후 자동으로 갱신됩니다</p>
          </div>
        )}

        {/* 결과 없음 */}
        {result && filteredItems.length === 0 && !loading && !result.isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-20 gap-2 text-zinc-500">
            <svg className="w-10 h-10 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">조건을 충족하는 종목이 없습니다.</p>
          </div>
        )}

        {/* 차트 모달 */}
        {selectedItem && (
          <MaSqueezeChartModal
            isOpen={!!selectedItem}
            onClose={() => setSelectedItem(null)}
            symbol={selectedItem.symbol}
            exchange={selectedItem.exchange}
            ma50={selectedItem.ma50_1h}
            ma110={selectedItem.ma110_1h}
            ma180={selectedItem.ma180_1h}
            currentPrice={selectedItem.currentPrice}
            spreadPct={0}
            hasBox={selectedItem.hasBox}
            boxTop={selectedItem.boxTop}
            boxBottom={selectedItem.boxBottom}
          />
        )}

        {/* 범례 */}
        <div className="mt-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            <span className="text-emerald-400">구름 위</span>: 현재가 &gt; 일목구름 선행스팬A·B ·{' '}
            <span className="text-cyan-400">정배열</span>: MA50 &gt; MA110 &gt; MA180 ·{' '}
            <span className="text-amber-400">박스</span>: 최근 20봉 고저 1~25% ·{' '}
            바 색상 <span className="text-red-400">돌파</span> / <span className="text-amber-400">상단80%↑</span> / <span className="text-emerald-400">중단</span> / <span className="text-zinc-400">하단</span> ·{' '}
            <span className="text-amber-400">A</span>: 스코어 6점↑ · MA는 1h 기준
          </p>
        </div>

      </main>
    </div>
  );
}
