'use client';

import Link from 'next/link';
import Header from './components/Header';
import PriceTicker from './components/PriceTicker';
import MarketTable from './components/MarketTable';
import DailyPicks from './components/DailyPicks';
import { useMarketData } from './hooks/useMarketData';

export default function Home() {
  const { data, isConnected } = useMarketData();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <PriceTicker data={data} />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* 오늘의 픽 */}
        <DailyPicks />

        {/* 돌파 타점 분석 배너 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-orange-500/20 bg-linear-to-r from-orange-950/20 to-zinc-900 p-4 sm:p-5">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-white mb-1">
                <span className="text-orange-400">박스권 돌파</span> 타점 분석
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">
                업비트·빗썸 전종목에서 <strong className="text-zinc-300">박스권 + 거래량 급등</strong> 조건으로 돌파 직전 종목을 포착합니다.
                매수가·손절가·목표가를 자동으로 계산합니다.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['실시간 박스권 탐지', '자동 타점 계산', 'BTC 상대강도 분석'].map((text) => (
                  <span key={text} className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    {text}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/box-breakout"
              className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              분석 보기
            </Link>
          </div>
        </div>

        {/* 프리미엄 유도 배너 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-yellow-500/20 bg-linear-to-r from-yellow-500/5 to-zinc-900 p-4 sm:p-5">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-white mb-1">
                상위 종목은 <span className="text-yellow-500">프리미엄 회원</span>만 볼 수 있어요
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">
                박스권 돌파 확률이 가장 높은 <strong className="text-zinc-300">1~2페이지 상위 종목</strong>은 프리미엄 전용입니다.
                일반 회원은 3페이지부터만 열람 가능합니다.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['상위 종목 무제한 열람', '5분 간격 실시간 갱신', '전종목 MA50 분석'].map((text) => (
                  <span key={text} className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    ✓ {text}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/premium"
              className="shrink-0 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              프리미엄 보기
            </Link>
          </div>
        </div>

        {/* MA 역배열 스캐너 배너 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-red-500/20 bg-linear-to-r from-red-950/20 to-zinc-900 p-4 sm:p-5">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-white mb-1">
                <span className="text-red-400">MA 역배열</span> 스캐너
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">
                5분봉에서 <strong className="text-zinc-300">MA50 · MA110 · MA180이 역배열</strong>인 상태에서{' '}
                <strong className="text-zinc-300">캔들이 MA50 위</strong>에 있는 종목을 포착합니다.
                빗썸 · Bybit 전종목 스캔.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['역배열 탐지', 'MA50 위 반등', '빗썸 + Bybit'].map((text) => (
                  <span key={text} className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                    {text}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/ma-reverse"
              className="shrink-0 px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              분석 보기
            </Link>
          </div>
        </div>

        {/* Exchange Comparison */}
        <MarketTable data={data} isConnected={isConnected} />
      </main>
    </div>
  );
}
