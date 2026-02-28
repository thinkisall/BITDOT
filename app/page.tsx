'use client';

import Link from 'next/link';
import Header from './components/Header';
import PriceTicker from './components/PriceTicker';
import MarketTable from './components/MarketTable';
import { useMarketData } from './hooks/useMarketData';

export default function Home() {
  const { data, isConnected } = useMarketData();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <PriceTicker data={data} />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">

        {/* 히어로 섹션 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-zinc-800 bg-linear-to-br from-zinc-900 via-zinc-900 to-zinc-800 p-4 sm:p-6 overflow-hidden relative">
          {/* 배경 장식 */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-yellow-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="absolute bottom-0 left-10 w-24 h-24 bg-cyan-500/5 rounded-full translate-y-1/2 pointer-events-none" />

          <div className="relative">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                5분마다 자동 갱신
              </span>
              <span className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                업비트 · 빗썸 전종목
              </span>
            </div>

            <h1 className="text-lg sm:text-2xl font-bold text-white mb-1.5 sm:mb-2 leading-tight">
              차트 볼 시간 없어도<br />
              <span className="text-yellow-500">터질 것 같은 코인</span>은 알 수 있다
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mb-4 sm:mb-5 leading-relaxed">
              4개 시간대 박스권 + MA50 우상향 조건을 동시에 충족하는 종목만 자동으로 추려냅니다.
              매일 수백 개 차트를 확인하던 시간, 이제 아낄 수 있습니다.
            </p>

            {/* 기능 요약 3개 */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-5">
              <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-xl font-bold text-yellow-500 mb-0.5">4개</div>
                <div className="text-[9px] sm:text-[11px] text-zinc-400 leading-tight">시간대 동시<br />박스권 탐지</div>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-xl font-bold text-cyan-400 mb-0.5">MA50</div>
                <div className="text-[9px] sm:text-[11px] text-zinc-400 leading-tight">우상향 추세<br />관심종목 표시</div>
              </div>
              <div className="bg-zinc-800/60 rounded-lg p-2 sm:p-3 text-center">
                <div className="text-base sm:text-xl font-bold text-purple-400 mb-0.5">🔥</div>
                <div className="text-[9px] sm:text-[11px] text-zinc-400 leading-tight">거래량 20배<br />급증 알림</div>
              </div>
            </div>

            <Link
              href="/analysis"
              className="flex items-center justify-center gap-2 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2.5 sm:py-3 px-4 rounded-lg transition-colors text-sm sm:text-base"
            >
              지금 바로 분석 결과 보기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>

        {/* MA50 위 종목 스캐너 배너 */}
        <div className="mb-4 sm:mb-6 rounded-xl border border-green-500/20 bg-linear-to-r from-green-950/20 to-zinc-900 p-4 sm:p-5">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm sm:text-base font-bold text-white mb-1">
                <span className="text-green-400">MA50 위</span> 종목 스캐너
              </div>
              <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">
                업비트 전종목에서 <strong className="text-zinc-300">5분봉 MA50 + 1시간봉 MA50</strong> 동시에 위에 있는 종목을 탐지합니다.
                단기·중기 모두 상승 추세인 종목을 포착합니다.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['5분봉 MA50 위', '1시간봉 MA50 위', '업비트 전종목'].map((text) => (
                  <span key={text} className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    {text}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/divergence"
              className="shrink-0 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
            >
              스캔하기
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

        {/* Exchange Comparison */}
        <MarketTable data={data} isConnected={isConnected} />
      </main>
    </div>
  );
}
