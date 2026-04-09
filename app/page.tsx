'use client';

import Link from 'next/link';
import Header from './components/Header';
import PriceTicker from './components/PriceTicker';
import { useMarketData } from './hooks/useMarketData';

const TOOLS = [
  {
    href: '/box-breakout',
    color: 'orange',
    border: 'border-orange-500/20',
    bg: 'from-orange-950/20',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    btnBg: 'bg-orange-600 hover:bg-orange-500',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    title: '박스권 돌파 타점 분석',
    titleHighlight: '박스권 돌파',
    highlightColor: 'text-orange-400',
    desc: '업비트·빗썸 전종목에서 박스권 + 거래량 급등 조건으로 돌파 직전 종목을 포착합니다. 매수가·손절가·목표가를 자동으로 계산합니다.',
    tags: ['실시간 박스권 탐지', '자동 타점 계산', 'BTC 상대강도 분석'],
    label: '분석 보기',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/ma-cycle',
    color: 'purple',
    border: 'border-purple-500/20',
    bg: 'from-purple-950/20',
    iconBg: 'bg-purple-500/15',
    iconColor: 'text-purple-400',
    btnBg: 'bg-purple-700 hover:bg-purple-600',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    title: 'MA 사이클 스캐너',
    titleHighlight: 'MA 사이클',
    highlightColor: 'text-purple-400',
    desc: '1분봉에서 MA50·110·180이 수렴 → 정배열 → 재수렴 후 현재 역배열 확산 중인 종목을 포착합니다. 빗썸 · Bybit 전종목 스캔.',
    tags: ['수렴→정배열→수렴→역배열', '1분봉 사이클 탐지', '빗썸 + Bybit'],
    label: '분석 보기',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    href: '/ma-reverse',
    color: 'red',
    border: 'border-red-500/20',
    bg: 'from-red-950/20',
    iconBg: 'bg-red-500/15',
    iconColor: 'text-red-400',
    btnBg: 'bg-red-700 hover:bg-red-600',
    badge: 'bg-red-500/10 text-red-400 border-red-500/20',
    title: 'MA 역배열 스캐너',
    titleHighlight: 'MA 역배열',
    highlightColor: 'text-red-400',
    desc: '5분봉에서 MA50 · MA110 · MA180이 역배열인 상태에서 캔들이 MA50 위에 있는 종목을 포착합니다. 빗썸 · Bybit 전종목 스캔.',
    tags: ['역배열 탐지', 'MA50 위 반등', '빗썸 + Bybit'],
    label: '분석 보기',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
      </svg>
    ),
  },
  {
    href: '/ma-squeeze',
    color: 'blue',
    border: 'border-blue-500/20',
    bg: 'from-blue-950/20',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    btnBg: 'bg-blue-700 hover:bg-blue-600',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    title: 'MA 스퀴즈 스캐너',
    titleHighlight: 'MA 스퀴즈',
    highlightColor: 'text-blue-400',
    desc: 'MA가 좁게 수렴된 스퀴즈 구간을 탐지해 폭발적 상승 직전 종목을 포착합니다.',
    tags: ['스퀴즈 탐지', '변동성 수렴 구간', '빗썸 + Bybit'],
    label: '분석 보기',
    icon: (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

const LEARN_CARDS = [
  {
    icon: '📦',
    title: '박스권이란?',
    desc: '가격이 일정 범위 안에서 위아래로 반복 등락하는 횡보 구간. 박스권 상단 돌파 시 강한 상승이 나오는 경우가 많습니다.',
  },
  {
    icon: '📈',
    title: '이동평균선(MA)이란?',
    desc: '일정 기간의 종가 평균을 이은 선. MA50(단기), MA110(중기), MA180(장기)의 배열 상태로 추세 강도를 파악합니다.',
  },
  {
    icon: '🔄',
    title: '정배열 vs 역배열',
    desc: '정배열은 단기 MA가 장기 MA 위에 있는 상승 추세. 역배열은 반대로 하락 추세. 전환 시점이 핵심 매매 타점입니다.',
  },
  {
    icon: '💥',
    title: '스퀴즈(수렴)란?',
    desc: 'MA들이 좁게 모이는 구간. 에너지가 압축된 상태로, 이후 방향성 돌파 시 폭발적인 움직임이 나올 수 있습니다.',
  },
  {
    icon: '📊',
    title: '거래량의 중요성',
    desc: '가격 돌파 시 거래량이 동반되어야 신뢰도가 높습니다. 거래량 없는 돌파는 속임수일 가능성이 높습니다.',
  },
  {
    icon: '⚡',
    title: '펀딩비란?',
    desc: '선물 시장에서 롱/숏 포지션 비율에 따라 부과되는 비용. 펀딩비가 극단적이면 반전 신호로 볼 수 있습니다.',
  },
];

export default function Home() {
  const { data } = useMarketData();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />
      <PriceTicker data={data} />

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-10 sm:space-y-14">

        {/* 히어로 */}
        <section className="text-center py-6 sm:py-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            실시간 코인 분석 플랫폼
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-3 leading-tight">
            차트를 읽는 눈을<br />
            <span className="text-yellow-400">데이터로</span> 키우세요
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto leading-relaxed mb-6">
            박스권 돌파, MA 배열, 스퀴즈 등 핵심 기술적 분석 개념을 실제 차트와 함께 학습하고,
            실시간 스캐너로 타점을 찾아보세요.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/box-breakout"
              className="px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 font-bold text-sm transition-colors"
            >
              스캐너 시작하기
            </Link>
            <Link
              href="/market"
              className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm transition-colors"
            >
              실시간 시세 보기
            </Link>
          </div>
        </section>

        {/* 기초 개념 학습 */}
        <section>
          <div className="mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-bold text-white">코인 기초 개념</h2>
            <p className="text-xs text-zinc-500 mt-1">매매에 필요한 핵심 용어를 먼저 이해하세요</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {LEARN_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors"
              >
                <div className="text-2xl mb-2">{card.icon}</div>
                <h3 className="text-sm font-bold text-white mb-1">{card.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 분석 도구 */}
        <section>
          <div className="mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-bold text-white">실시간 분석 도구</h2>
            <p className="text-xs text-zinc-500 mt-1">배운 개념을 실전 스캐너로 바로 적용해보세요</p>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {TOOLS.map((tool) => (
              <div
                key={tool.href}
                className={`rounded-xl border ${tool.border} bg-linear-to-r ${tool.bg} to-zinc-900 p-4 sm:p-5`}
              >
                <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-col sm:flex-row">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0 ${tool.iconColor}`}>
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm sm:text-base font-bold text-white mb-1">
                      <span className={tool.highlightColor}>{tool.titleHighlight}</span>{' '}
                      {tool.title.replace(tool.titleHighlight, '').trim()}
                    </div>
                    <p className="text-[10px] sm:text-xs text-zinc-400 leading-relaxed">{tool.desc}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tool.tags.map((tag) => (
                        <span key={tag} className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full border ${tool.badge}`}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Link
                    href={tool.href}
                    className={`shrink-0 px-4 py-2 ${tool.btnBg} text-white font-bold rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap`}
                  >
                    {tool.label}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 프리미엄 유도 */}
        <section className="rounded-xl border border-yellow-500/20 bg-linear-to-r from-yellow-500/5 to-zinc-900 p-5 sm:p-7">
          <div className="flex items-start sm:items-center gap-4 flex-col sm:flex-row">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/15 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-white mb-1">
                상위 종목은 <span className="text-yellow-500">프리미엄 회원</span>만 볼 수 있어요
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                박스권 돌파 확률이 가장 높은 1~2페이지 상위 종목은 프리미엄 전용입니다.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {['상위 종목 무제한 열람', '5분 간격 실시간 갱신', '전종목 MA50 분석'].map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                    ✓ {t}
                  </span>
                ))}
              </div>
            </div>
            <Link
              href="/premium"
              className="shrink-0 px-5 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              프리미엄 보기
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
