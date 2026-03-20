'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';

interface LottoData {
  round: number;
  date: string;
  numbers: number[];
  bonus: number;
  firstPrize: number;
  firstWinners: number;
  totalSales: number;
}

function getBallColor(num: number): string {
  if (num <= 10) return 'bg-yellow-400 text-zinc-900';
  if (num <= 20) return 'bg-blue-500 text-white';
  if (num <= 30) return 'bg-red-500 text-white';
  if (num <= 40) return 'bg-zinc-600 text-white';
  return 'bg-green-500 text-white';
}

function formatMoney(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

export default function LottoPage() {
  const [data, setData] = useState<LottoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roundInput, setRoundInput] = useState('');
  const [currentRound, setCurrentRound] = useState<number | null>(null);

  const fetchLotto = useCallback(async (round?: number) => {
    setLoading(true);
    setError('');
    try {
      const url = round ? `/api/lotto?round=${round}` : '/api/lotto';
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '오류 발생');
      setData(json);
      if (!currentRound) setCurrentRound(json.round);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '데이터를 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [currentRound]);

  useEffect(() => {
    fetchLotto();
  }, []);

  const handleSearch = () => {
    const round = parseInt(roundInput);
    if (!round || round < 1) return;
    fetchLotto(round);
  };

  const handlePrev = () => {
    if (!data) return;
    fetchLotto(data.round - 1);
    setRoundInput(String(data.round - 1));
  };

  const handleNext = () => {
    if (!data || !currentRound) return;
    if (data.round >= currentRound) return;
    fetchLotto(data.round + 1);
    setRoundInput(String(data.round + 1));
  };

  const handleLatest = () => {
    setRoundInput('');
    fetchLotto();
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 max-w-xl">

        <div className="mb-6 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
            🎱 로또 당첨번호
          </h1>
          <p className="text-xs text-zinc-500">동행복권 공식 API 제공</p>
        </div>

        {/* 회차 검색 */}
        <div className="flex gap-2 mb-6">
          <input
            type="number"
            value={roundInput}
            onChange={(e) => setRoundInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="회차 입력 (예: 1100)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold text-sm rounded-lg transition-colors"
          >
            검색
          </button>
          <button
            onClick={handleLatest}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
          >
            최신
          </button>
        </div>

        {/* 결과 카드 */}
        {loading ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="text-zinc-500 text-sm animate-pulse">로딩 중...</div>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-900 bg-red-950/30 p-8 text-center">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        ) : data ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
            {/* 회차 헤더 */}
            <div className="bg-zinc-800/60 px-5 py-4 flex items-center justify-between">
              <div>
                <span className="text-yellow-400 font-bold text-lg">제 {data.round}회</span>
                <span className="text-zinc-500 text-sm ml-2">{data.date} 추첨</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={handlePrev}
                  disabled={data.round <= 1}
                  className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
                >
                  ◀ 이전
                </button>
                <button
                  onClick={handleNext}
                  disabled={!currentRound || data.round >= currentRound}
                  className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
                >
                  다음 ▶
                </button>
              </div>
            </div>

            {/* 번호 볼 */}
            <div className="px-5 py-6">
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                {data.numbers.map((num) => (
                  <div
                    key={num}
                    className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center font-bold text-sm sm:text-base shadow-lg ${getBallColor(num)}`}
                  >
                    {num}
                  </div>
                ))}
                <div className="text-zinc-500 text-lg font-bold mx-1">+</div>
                <div className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center font-bold text-sm sm:text-base shadow-lg ring-2 ring-zinc-400 opacity-80 ${getBallColor(data.bonus)}`}>
                  {data.bonus}
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-3 text-[11px] text-zinc-500">
                <span>당첨번호 6개</span>
                <span>+ 보너스번호</span>
              </div>
            </div>

            {/* 색상 범례 */}
            <div className="px-5 pb-4 flex justify-center gap-3 flex-wrap">
              {[
                { label: '1~10', color: 'bg-yellow-400' },
                { label: '11~20', color: 'bg-blue-500' },
                { label: '21~30', color: 'bg-red-500' },
                { label: '31~40', color: 'bg-zinc-600' },
                { label: '41~45', color: 'bg-green-500' },
              ].map(({ label, color }) => (
                <div key={label} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-[10px] text-zinc-500">{label}</span>
                </div>
              ))}
            </div>

            {/* 당첨 정보 */}
            <div className="border-t border-zinc-800 px-5 py-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-[11px] text-zinc-500 mb-1">1등 당첨금</div>
                <div className="text-sm font-bold text-yellow-400">{formatMoney(data.firstPrize)}</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 mb-1">1등 당첨자</div>
                <div className="text-sm font-bold text-white">{data.firstWinners}명</div>
              </div>
              <div>
                <div className="text-[11px] text-zinc-500 mb-1">총 판매액</div>
                <div className="text-sm font-bold text-zinc-300">{formatMoney(data.totalSales)}</div>
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-center text-[11px] text-zinc-600 mt-6">
          데이터 출처: 동행복권 (dhlottery.co.kr)
        </p>
      </main>
    </div>
  );
}
