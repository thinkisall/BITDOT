'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart } from 'recharts';

/* ── 타입 ──────────────────────────────────────── */
interface DetailRow {
  ds: string;
  hybrid_pred: number;
  hybrid_lower: number;
  hybrid_upper: number;
}

interface SymbolResult {
  symbol: string;
  latest_price: number;
  latest_date: string;
  pred_5d: number;
  pred_30d: number;
  change_5d_pct: number;
  change_30d_pct: number;
  '5d': DetailRow[];
  '30d': DetailRow[];
}

interface Top100Response {
  updated_at: string;
  count: number;
  results: SymbolResult[];
}

/* ── 포맷 유틸 ─────────────────────────────────── */
function fmtPrice(v: number): string {
  if (isNaN(v)) return '-';
  if (v >= 1000) return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 });
  if (v >= 1) return v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });
  return v.toLocaleString('ko-KR', { maximumFractionDigits: 6 });
}

function fmtPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

function fmtDate(ds: string): string {
  const m = ds.match(/\d{4}-(\d{2})-(\d{2})/);
  return m ? `${parseInt(m[1])}/${parseInt(m[2])}` : ds;
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

/* ── 5일 카드 ──────────────────────────────────── */
function ShortCards({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="grid grid-cols-5 gap-1.5 p-3">
      {rows.map((row, i) => {
        const isLast = i === rows.length - 1;
        return (
          <div
            key={i}
            className={`rounded-lg border p-2.5 space-y-1 ${
              isLast
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-zinc-800 bg-zinc-800/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-zinc-500">{fmtDate(row.ds)}</span>
              {isLast && <span className="text-[8px] bg-blue-500/20 text-blue-400 px-1 rounded">최종</span>}
            </div>
            <p className="text-xs font-bold text-white font-mono leading-tight">
              {fmtPrice(row.hybrid_pred)}
            </p>
            <div className="space-y-0.5">
              <div className="flex justify-between gap-1">
                <span className="text-[8px] text-zinc-600">상단</span>
                <span className="text-[9px] text-green-400 font-mono tabular-nums">{fmtPrice(row.hybrid_upper)}</span>
              </div>
              <div className="flex justify-between gap-1">
                <span className="text-[8px] text-zinc-600">하단</span>
                <span className="text-[9px] text-red-400 font-mono tabular-nums">{fmtPrice(row.hybrid_lower)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 차트 컴포넌트 ──────────────────────────────── */
function PredictionChart({ rows, currentPrice, title, color }: {
  rows: DetailRow[];
  currentPrice: number;
  title: string;
  color: string;
}) {
  // 현재가를 첫 데이터로 추가
  const chartData = [
    {
      ds: '현재',
      date: '현재',
      pred: currentPrice,
      upper: currentPrice,
      lower: currentPrice,
    },
    ...rows.map(row => ({
      ds: row.ds,
      date: fmtDate(row.ds),
      pred: row.hybrid_pred,
      upper: row.hybrid_upper,
      lower: row.hybrid_lower,
    }))
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0].payload;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-xs text-zinc-400 mb-2">{data.date}</p>
        <div className="space-y-1">
          <p className="text-sm font-bold text-white">예측: {fmtPrice(data.pred)}</p>
          <p className="text-xs text-green-400">상단: {fmtPrice(data.upper)}</p>
          <p className="text-xs text-red-400">하단: {fmtPrice(data.lower)}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-[300px] sm:h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="date"
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis
            stroke="#71717a"
            tick={{ fill: '#71717a', fontSize: 11 }}
            tickFormatter={(value) => fmtPrice(value)}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
          />
          <Area
            type="monotone"
            dataKey="upper"
            stroke="none"
            fill={color === 'blue' ? '#3b82f6' : '#a855f7'}
            fillOpacity={0.1}
            name="신뢰구간"
          />
          <Area
            type="monotone"
            dataKey="lower"
            stroke="none"
            fill={color === 'blue' ? '#3b82f6' : '#a855f7'}
            fillOpacity={0.1}
          />
          <Line
            type="monotone"
            dataKey="pred"
            stroke={color === 'blue' ? '#60a5fa' : '#c084fc'}
            strokeWidth={3}
            dot={{ fill: color === 'blue' ? '#60a5fa' : '#c084fc', r: 4 }}
            activeDot={{ r: 6 }}
            name="예측가"
          />
          <Line
            type="monotone"
            dataKey="upper"
            stroke="#22c55e"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="상단"
          />
          <Line
            type="monotone"
            dataKey="lower"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="하단"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── 30일 테이블 ────────────────────────────────── */
function LongTable({ rows }: { rows: DetailRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-96">
        <thead className="sticky top-0 z-10 bg-zinc-900 border-b border-zinc-800">
          <tr>
            <th className="px-3 py-2.5 text-left text-zinc-600 font-medium w-8">#</th>
            <th className="px-3 py-2.5 text-left text-zinc-500 font-medium">날짜</th>
            <th className="px-3 py-2.5 text-right text-zinc-500 font-medium">예측가</th>
            <th className="px-3 py-2.5 text-right text-green-600 font-medium">상단</th>
            <th className="px-3 py-2.5 text-right text-red-600 font-medium">하단</th>
            <th className="px-3 py-2.5 text-right text-zinc-500 font-medium">범위폭</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isLast = i === rows.length - 1;
            const range = row.hybrid_upper - row.hybrid_lower;
            return (
              <tr
                key={i}
                className={`border-b border-zinc-800/40 transition-colors ${
                  isLast
                    ? 'bg-purple-500/10 font-semibold'
                    : i % 2 === 1 ? 'bg-zinc-900/40 hover:bg-zinc-800/30' : 'hover:bg-zinc-800/30'
                }`}
              >
                <td className="px-3 py-2 text-zinc-600 tabular-nums">
                  {i + 1}
                  {isLast && <span className="ml-1 text-[8px] bg-purple-500/30 text-purple-400 px-1 rounded">최종</span>}
                </td>
                <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">{fmtDate(row.ds)}</td>
                <td className="px-3 py-2 text-white font-mono text-right tabular-nums">{fmtPrice(row.hybrid_pred)}</td>
                <td className="px-3 py-2 text-green-400 font-mono text-right tabular-nums">{fmtPrice(row.hybrid_upper)}</td>
                <td className="px-3 py-2 text-red-400 font-mono text-right tabular-nums">{fmtPrice(row.hybrid_lower)}</td>
                <td className="px-3 py-2 text-zinc-500 font-mono text-right tabular-nums">{fmtPrice(range)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── 메인 ───────────────────────────────────────── */
export default function PredictPage() {
  const [allData, setAllData]       = useState<Top100Response | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<string | null>(null);
  const [search, setSearch]         = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/predict');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: Top100Response = await res.json();
      setAllData(json);
      // 첫 로드 시 첫 번째 종목 선택
      if (json.results.length > 0 && !selected) {
        setSelected(json.results[0].symbol);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filteredSymbols = allData?.results.filter(r =>
    r.symbol.toUpperCase().includes(search.toUpperCase())
  ) ?? [];

  const currentData = allData?.results.find(r => r.symbol === selected) ?? null;

  const short = currentData?.['5d'] ?? [];
  const long  = currentData?.['30d'] ?? [];

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-5xl">

        {/* 타이틀 */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-white mb-0.5">AI 가격 예측</h1>
            <p className="text-xs text-zinc-400">단기 5일 · 장기 30일 가격 예측 데이터</p>
          </div>
          <div className="flex items-center gap-2">
            {allData && (
              <span className="text-[10px] text-zinc-600">
                {fmtUpdatedAt(allData.updated_at)} 업데이트
              </span>
            )}
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-400 hover:text-white rounded-lg text-xs transition-colors"
            >
              <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              새로고침
            </button>
          </div>
        </div>

        {/* 에러 */}
        {error && !loading && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-400 font-semibold mb-1">불러오기 실패</p>
            <p className="text-xs text-zinc-400">{error}</p>
          </div>
        )}

        {/* 전체 로딩 */}
        {loading && !allData && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-yellow-500 border-t-transparent animate-spin" />
            <p className="text-sm text-zinc-400">예측 데이터 불러오는 중…</p>
          </div>
        )}

        {allData && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">

            {/* 종목 목록 패널 */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-3 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide">
                    종목 {allData.count}개
                  </span>
                </div>
                {/* 검색 */}
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value.toUpperCase())}
                  placeholder="검색..."
                  className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-lg px-3 py-1.5 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              {/* 종목 리스트 */}
              <div className="overflow-y-auto" style={{ maxHeight: '500px' }}>
                {filteredSymbols.length === 0 ? (
                  <p className="text-xs text-zinc-600 text-center py-6">검색 결과 없음</p>
                ) : (
                  filteredSymbols.map(r => {
                    const isActive = r.symbol === selected;
                    const pct5 = r.change_5d_pct;
                    const pct30 = r.change_30d_pct;
                    return (
                      <button
                        key={r.symbol}
                        onClick={() => setSelected(r.symbol)}
                        className={`w-full text-left px-3 py-2.5 border-b border-zinc-800/50 transition-colors ${
                          isActive
                            ? 'bg-yellow-500/10 border-l-2 border-l-yellow-500'
                            : 'hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold font-mono ${isActive ? 'text-yellow-400' : 'text-white'}`}>
                            {r.symbol}
                          </span>
                          <div className="flex gap-1">
                            <span className={`text-[9px] font-mono ${pct5 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              5d {pct5 >= 0 ? '+' : ''}{pct5.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[9px] text-zinc-600 font-mono">{fmtPrice(r.latest_price)}</span>
                          <span className={`text-[9px] font-mono ${pct30 >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
                            30d {pct30 >= 0 ? '+' : ''}{pct30.toFixed(1)}%
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
                    <span>{currentData.latest_date} 기준</span>
                  </div>

                  {/* 요약 카드 3개 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
                      <p className="text-[10px] text-zinc-500 mb-1">현재가</p>
                      <p className="text-base sm:text-xl font-bold text-white font-mono">
                        {fmtPrice(currentData.latest_price)}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-1">{currentData.latest_date}</p>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
                      <p className="text-[10px] text-zinc-500 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
                        5일 후 예측
                      </p>
                      <p className="text-base sm:text-xl font-bold text-white font-mono">
                        {fmtPrice(currentData.pred_5d)}
                      </p>
                      <p className={`text-xs font-bold mt-0.5 ${currentData.change_5d_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {currentData.change_5d_pct >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(currentData.change_5d_pct))}
                      </p>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 sm:p-4">
                      <p className="text-[10px] text-zinc-500 mb-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />
                        30일 후 예측
                      </p>
                      <p className="text-base sm:text-xl font-bold text-white font-mono">
                        {fmtPrice(currentData.pred_30d)}
                      </p>
                      <p className={`text-xs font-bold mt-0.5 ${currentData.change_30d_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {currentData.change_30d_pct >= 0 ? '▲' : '▼'} {fmtPct(Math.abs(currentData.change_30d_pct))}
                      </p>
                    </div>
                  </div>

                  {/* 5일 차트 */}
                  {short.length > 0 && (
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800 bg-linear-to-r from-blue-500/10 to-transparent">
                        <h2 className="text-sm font-bold text-white">단기 예측 차트 <span className="text-blue-400">5일</span></h2>
                        <p className="text-[10px] text-zinc-500 mt-0.5">예측 가격 추이 및 신뢰구간</p>
                      </div>
                      <div className="p-4">
                        <PredictionChart
                          rows={short}
                          currentPrice={currentData.latest_price}
                          title="5일 예측"
                          color="blue"
                        />
                      </div>
                    </div>
                  )}

                  {/* 5일 상세 카드 */}
                  {short.length > 0 && (
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800 bg-linear-to-r from-blue-500/10 to-transparent">
                        <h2 className="text-sm font-bold text-white">단기 예측 상세 <span className="text-blue-400">5일</span></h2>
                        <p className="text-[10px] text-zinc-500 mt-0.5">예측가 · 상단(신뢰구간 상한) · 하단(신뢰구간 하한)</p>
                      </div>
                      <ShortCards rows={short} />
                    </div>
                  )}

                  {/* 30일 차트 */}
                  {long.length > 0 && (
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800 bg-linear-to-r from-purple-500/10 to-transparent">
                        <h2 className="text-sm font-bold text-white">장기 예측 차트 <span className="text-purple-400">30일</span></h2>
                        <p className="text-[10px] text-zinc-500 mt-0.5">30일간 예측 가격 추이 및 신뢰구간</p>
                      </div>
                      <div className="p-4">
                        <PredictionChart
                          rows={long}
                          currentPrice={currentData.latest_price}
                          title="30일 예측"
                          color="purple"
                        />
                      </div>
                    </div>
                  )}

                  {/* 30일 상세 테이블 */}
                  {long.length > 0 && (
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                      <div className="px-4 py-3 border-b border-zinc-800 bg-linear-to-r from-purple-500/10 to-transparent">
                        <h2 className="text-sm font-bold text-white">장기 예측 상세 <span className="text-purple-400">30일</span></h2>
                        <p className="text-[10px] text-zinc-500 mt-0.5">일별 예측가 및 신뢰구간 · 마지막 행 = 최종 예측</p>
                      </div>
                      <div className="overflow-y-auto" style={{ maxHeight: '520px' }}>
                        <LongTable rows={long} />
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
