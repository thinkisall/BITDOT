'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header';

/* ── 상수 ──────────────────────────────────────── */
const CACHE_KEY   = 'lstm_top200_cache';
const CACHE_TTL   = 6 * 60 * 60 * 1000; // 6시간 (ms)
const POLL_SECS   = 300;                  // 5분

/* ── 타입 ──────────────────────────────────────── */
interface DetailRow {
  ds: string;
  pred_price: number;
}

interface SymbolResult {
  symbol: string;
  latest_price: number;
  latest_time: string;
  pred_5h: number;
  pred_30h: number;
  change_5h_pct: number;
  change_30h_pct: number;
  attention_5h: string[];
  attention_30h: string[];
  '5h_detail': DetailRow[];
  '30h_detail': DetailRow[];
}

interface LstmResponse {
  updated_at: string;
  count: number;
  results: SymbolResult[];
}

interface CacheEntry {
  data: LstmResponse;
  cachedAt: number;
}

/* ── 캐시 유틸 ─────────────────────────────────── */
function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.cachedAt > CACHE_TTL) return null;
    return entry;
  } catch {
    return null;
  }
}

function saveCache(data: LstmResponse): number {
  const cachedAt = Date.now();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt }));
  } catch {}
  return cachedAt;
}

/* ── 포맷 유틸 ─────────────────────────────────── */
function fmtPrice(v: number): string {
  if (isNaN(v)) return '-';
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 1)    return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
}

function fmtPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtTime(ds: string): string {
  const m = ds.match(/\d{4}-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])} ${m[3]}:${m[4]}` : ds;
}

function fmtUpdatedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ko-KR', {
      month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── 5시간 카드 ─────────────────────────────────── */
function ShortCards({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 p-3">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        return (
          <div
            key={i}
            className={`rounded-lg border p-2.5 space-y-1.5 ${
              isLast
                ? 'border-cyan-500/50 bg-cyan-500/10'
                : 'border-zinc-800 bg-zinc-800/40'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] font-bold text-zinc-500 leading-tight">{fmtTime(row.ds)}</span>
              {isLast && <span className="text-[7px] bg-cyan-500/20 text-cyan-400 px-1 rounded shrink-0">최종</span>}
            </div>
            <p className="text-xs font-bold text-white font-mono leading-tight">
              {fmtPrice(row.pred_price)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ── 30시간 테이블 ───────────────────────────────── */
function LongTable({ rows, attention }: { rows: DetailRow[]; attention: string[] }) {
  const attSet = new Set(attention);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-64">
        <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800">
          <tr>
            <th className="px-3 py-2.5 text-left text-zinc-600 font-medium w-8">#</th>
            <th className="px-3 py-2.5 text-left text-zinc-500 font-medium">시간</th>
            <th className="px-3 py-2.5 text-right text-zinc-500 font-medium">예측가</th>
            <th className="px-3 py-2.5 text-right text-amber-600 font-medium">주목도</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1;
            const isAttention = attSet.has(row.ds);
            return (
              <tr
                key={i}
                className={`border-b border-zinc-800/40 transition-colors ${
                  isLast
                    ? 'bg-purple-500/10 font-semibold'
                    : isAttention
                    ? 'bg-amber-500/5'
                    : i % 2 === 1 ? 'bg-zinc-900/40 hover:bg-zinc-800/30' : 'hover:bg-zinc-800/30'
                }`}
              >
                <td className="px-3 py-2 text-zinc-600 tabular-nums">
                  {i + 1}
                  {isLast && <span className="ml-1 text-[8px] bg-purple-500/30 text-purple-400 px-1 rounded">최종</span>}
                </td>
                <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{fmtTime(row.ds)}</td>
                <td className="px-3 py-2 text-white font-mono text-right tabular-nums">{fmtPrice(row.pred_price)}</td>
                <td className="px-3 py-2 text-right">
                  {isAttention && (
                    <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">주목</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── 메인 ───────────────────────────────────────── */
export default function LstmPage() {
  const [allData, setAllData]         = useState<LstmResponse | null>(null);
  const [cachedAt, setCachedAt]       = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching]       = useState(false); // 백그라운드 요청 중
  const [countdown, setCountdown]     = useState(POLL_SECS);
  const [selected, setSelected]       = useState<string | null>(null);
  const [search, setSearch]           = useState('');

  // selected를 ref로 추적해 fetchAll deps 없이 사용
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  /* ── 데이터 fetch (백그라운드 폴링용) ── */
  const fetchAll = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/predict-lstm');
      const json = await res.json();

      if (json.results && Array.isArray(json.results) && json.results.length > 0) {
        const data = json as LstmResponse;
        const at = saveCache(data);
        setAllData(data);
        setCachedAt(at);
        if (!selectedRef.current) {
          setSelected(data.results[0].symbol);
        }
      }
      // 데이터 없으면 기존 캐시 유지 (allData 건드리지 않음)
    } catch {
      // 오류도 기존 캐시 유지
    } finally {
      setFetching(false);
      setInitialLoading(false);
    }
  }, []);

  /* ── 마운트: 캐시 로드 → 즉시 fetch ── */
  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setAllData(cached.data);
      setCachedAt(cached.cachedAt);
      setInitialLoading(false);
      if (!selectedRef.current) {
        setSelected(cached.data.results[0]?.symbol ?? null);
      }
    }
    fetchAll();
  }, [fetchAll]);

  /* ── 카운트다운 + 5분 폴링 ── */
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchAll();
          return POLL_SECS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const filteredSymbols = allData?.results.filter(r =>
    r.symbol.toUpperCase().includes(search.toUpperCase())
  ) ?? [];

  const currentData = allData?.results.find(r => r.symbol === selected) ?? null;
  const short = currentData?.['5h_detail'] ?? [];
  const long  = currentData?.['30h_detail'] ?? [];

  // 캐시 나이 표시
  const cacheAgeMin = cachedAt ? Math.floor((Date.now() - cachedAt) / 60000) : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">

        {/* 타이틀 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-lg sm:text-2xl font-bold text-white">LSTM 가격 예측</h1>
              <span className="text-[10px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full font-medium">
                딥러닝
              </span>
            </div>
            <p className="text-xs text-zinc-400">단기 5시간 · 장기 30시간 시간별 가격 예측</p>
          </div>

          {/* 폴링 상태 표시 */}
          <div className="flex items-center gap-3">
            {allData && (
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-zinc-600">
                  {fmtUpdatedAt(allData.updated_at)} 업데이트
                </p>
                {cacheAgeMin !== null && (
                  <p className="text-[9px] text-zinc-700">캐시 {cacheAgeMin}분 전</p>
                )}
              </div>
            )}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg">
              {fetching ? (
                <svg className="w-3 h-3 text-cyan-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-pulse" />
              )}
              <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
                {fetching ? '확인 중…' : `${fmtCountdown(countdown)} 후 확인`}
              </span>
            </div>
          </div>
        </div>

        {/* 초기 로딩 (캐시도 없고 첫 요청 전) */}
        {initialLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
            <p className="text-sm text-zinc-400">LSTM 예측 데이터 확인 중…</p>
          </div>
        )}

        {/* 데이터 없음 (캐시도 없고 API도 없음) */}
        {!initialLoading && !allData && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-14 h-14 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <svg className="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">LSTM 학습 데이터 준비 중</p>
              <p className="text-xs text-zinc-500 mb-3">데이터가 준비되면 자동으로 표시됩니다</p>
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-600">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/60 animate-pulse" />
                <span className="font-mono">{fmtCountdown(countdown)} 후 다시 확인</span>
              </div>
            </div>
          </div>
        )}

        {/* 데이터 있음 */}
        {allData && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">

            {/* 종목 목록 패널 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-zinc-800">
                <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
                  종목 {allData.count}개
                </span>
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value.toUpperCase())}
                  placeholder="검색..."
                  className="mt-2 w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-lg px-3 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                {filteredSymbols.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-6">검색 결과 없음</p>
                ) : (
                  filteredSymbols.map(r => {
                    const isActive = r.symbol === selected;
                    const pct5  = r.change_5h_pct;
                    const pct30 = r.change_30h_pct;
                    return (
                      <button
                        key={r.symbol}
                        onClick={() => setSelected(r.symbol)}
                        className={`w-full text-left px-3 py-2.5 border-b border-zinc-800/50 transition-colors ${
                          isActive
                            ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500'
                            : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold font-mono ${isActive ? 'text-cyan-400' : 'text-white'}`}>
                            {r.symbol}
                          </span>
                          <span className={`text-[9px] font-mono ${pct5 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            5h {pct5 >= 0 ? '+' : ''}{pct5.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[9px] text-zinc-600 font-mono">{fmtPrice(r.latest_price)}</span>
                          <span className={`text-[9px] font-mono ${pct30 >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            30h {pct30 >= 0 ? '+' : ''}{pct30.toFixed(1)}%
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* 상세 패널 */}
            <div className="space-y-4 min-w-0">
              {!currentData ? (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                  <p className="text-zinc-500 text-sm">좌측에서 종목을 선택하세요</p>
                </div>
              ) : (
                <>
                  {/* 메타 */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-600 px-0.5">
                    <span className="font-bold text-zinc-300 text-sm">{currentData.symbol}</span>
                    <span>{fmtTime(currentData.latest_time)} 기준</span>
                  </div>

                  {/* 요약 카드 3개 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
                      <p className="text-[10px] text-zinc-500 mb-1">현재가</p>
                      <p className="text-base sm:text-xl font-bold text-white font-mono">
                        {fmtPrice(currentData.latest_price)}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-1">{fmtTime(currentData.latest_time)}</p>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
                      <p className="text-[10px] text-zinc-500 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />
                        5시간 후 예측
                      </p>
                      <p className="text-base sm:text-xl font-bold text-white font-mono">
                        {fmtPrice(currentData.pred_5h)}
                      </p>
                      <p className={`text-xs font-bold mt-0.5 ${currentData.change_5h_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {currentData.change_5h_pct >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(currentData.change_5h_pct))}
                      </p>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
                      <p className="text-[10px] text-zinc-500 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                        30시간 후 예측
                      </p>
                      <p className="text-base sm:text-xl font-bold text-white font-mono">
                        {fmtPrice(currentData.pred_30h)}
                      </p>
                      <p className={`text-xs font-bold mt-0.5 ${currentData.change_30h_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {currentData.change_30h_pct >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(currentData.change_30h_pct))}
                      </p>
                    </div>
                  </div>

                  {/* LSTM 주목 시점 */}
                  {(currentData.attention_5h.length > 0 || currentData.attention_30h.length > 0) && (
                    <div className="bg-zinc-900 border border-amber-500/20 rounded-xl p-3">
                      <p className="text-[10px] text-amber-500/80 font-medium uppercase tracking-wide mb-2">
                        LSTM 주목 시점 (Attention)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {currentData.attention_5h.map((t, i) => (
                          <span key={`5h-${i}`} className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-mono">
                            5h · {fmtTime(t)}
                          </span>
                        ))}
                        {currentData.attention_30h.map((t, i) => (
                          <span key={`30h-${i}`} className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-mono">
                            30h · {fmtTime(t)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5시간 상세 카드 */}
                  {short.length > 0 && (
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800 bg-linear-to-r from-cyan-500/10 to-transparent">
                        <h2 className="text-sm font-bold text-white">단기 예측 <span className="text-cyan-400">5시간</span></h2>
                        <p className="text-[10px] text-zinc-500 mt-0.5">시간별 LSTM 예측가</p>
                      </div>
                      <ShortCards rows={short} />
                    </div>
                  )}

                  {/* 30시간 상세 테이블 */}
                  {long.length > 0 && (
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800 bg-linear-to-r from-purple-500/10 to-transparent">
                        <h2 className="text-sm font-bold text-white">장기 예측 <span className="text-purple-400">30시간</span></h2>
                        <p className="text-[10px] text-zinc-500 mt-0.5">시간별 예측가 · 황색 표시 = LSTM 주목 시점</p>
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
                        <LongTable rows={long} attention={currentData.attention_30h} />
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-zinc-700 text-center pb-2">
                    ※ AI 예측 데이터는 참고용입니다. 실제 가격과 다를 수 있으며 투자 결정의 근거로 사용하지 마세요.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
