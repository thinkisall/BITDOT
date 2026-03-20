'use client';

import Link from 'next/link';
import Header from '../components/Header';

/* ── 기능 카드 데이터 ────────────────────────────────────────────────────── */
const features = [
  {
    emoji: '📦',
    title: '박스권 스캐너',
    badge: '무료',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    href: '/',
    color: 'border-yellow-500/20 hover:border-yellow-500/40',
    iconBg: 'bg-yellow-500/10',
    desc: '4개 시간대(5분·1시간·4시간·1일)에서 동시에 박스권을 형성하고 MA50이 우상향인 종목을 자동으로 추려냅니다.',
    why: '박스권은 가격이 좁은 범위 안에서 움직이는 구간입니다. 여기서 위로 돌파하면 강한 상승이 오는 경우가 많습니다.',
    tags: ['업비트', '빗썸', '전종목', '5분 갱신'],
  },
  {
    emoji: '📊',
    title: '돌파 분석',
    badge: '1~20위 프리미엄',
    badgeColor: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    href: '/box-breakout',
    color: 'border-orange-500/20 hover:border-orange-500/40',
    iconBg: 'bg-orange-500/10',
    desc: '박스권 상단을 실제로 돌파한 종목을 실시간으로 감지합니다. 총 스코어 기반으로 상위 종목을 자동 정렬합니다.',
    why: '이미 돌파가 시작된 종목 중 거래량과 다중 조건을 통과한 것들만 보여줘서 가짜 돌파를 걸러냅니다.',
    tags: ['BTC 상대강도', '스코어 정렬', '빗썸·Bybit'],
  },
  {
    emoji: '📈',
    title: 'MA 라이딩 분석',
    badge: '일부 프리미엄',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    href: '/analysis',
    color: 'border-blue-500/20 hover:border-blue-500/40',
    iconBg: 'bg-blue-500/10',
    desc: '이동평균선(MA50, MA110, MA180, VWMA110) 위에서 가격이 올라타고 있는 종목을 시간대별로 분류해 보여줍니다.',
    why: '"MA 라이딩"이란 주가가 이동평균선을 발판 삼아 상승하는 패턴입니다. 추세가 강한 종목을 빠르게 찾을 수 있습니다.',
    tags: ['1H MA', '4H MA', '1D MA', '5분봉 MA'],
  },
  {
    emoji: '🔥',
    title: '거래량 스캐너',
    badge: '무료',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    href: '/volume-scanner',
    color: 'border-red-500/20 hover:border-red-500/40',
    iconBg: 'bg-red-500/10',
    desc: '평소보다 거래량이 갑자기 20배 이상 급증한 종목을 실시간으로 감지합니다. 급등 초기 신호로 활용됩니다.',
    why: '세력이 매집을 시작하거나 큰 뉴스가 터질 때 거래량이 먼저 폭발합니다. 가격 급등 전에 미리 포착할 수 있습니다.',
    tags: ['실시간 감지', '업비트', '빗썸'],
  },
  {
    emoji: '🌿',
    title: 'MA 정배열 + 일목구름',
    badge: '프리미엄 전용',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    href: '/rsi-scanner',
    color: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconBg: 'bg-emerald-500/10',
    desc: '1시간봉과 4시간봉 모두 MA50 > MA110 > MA180 정배열이면서, 4시간봉 일목구름 위에 있는 종목만 추려냅니다.',
    why: '두 시간대에서 동시에 정배열이 확인되면 상승 추세가 매우 강하다는 의미입니다. 일목구름 위라는 조건까지 더해 신뢰도를 높였습니다.',
    tags: ['1H 정배열', '4H 정배열', '일목구름', '업비트·빗썸'],
  },
  {
    emoji: '💸',
    title: '펀딩비 현황',
    badge: '무료',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    href: '/funding',
    color: 'border-cyan-500/20 hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/10',
    desc: '선물 거래소(Bybit)의 펀딩비를 실시간으로 보여줍니다. 과열·공포 구간을 한눈에 파악할 수 있습니다.',
    why: '펀딩비가 극단적으로 높으면 롱 과매수(하락 위험), 낮으면 숏 과매도(반등 가능성)를 나타냅니다.',
    tags: ['Bybit', '8시간마다 정산', '실시간'],
  },
  {
    emoji: '🤖',
    title: 'AI 예측 / LSTM 예측',
    badge: '무료',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    href: '/predict',
    color: 'border-violet-500/20 hover:border-violet-500/40',
    iconBg: 'bg-violet-500/10',
    desc: '머신러닝(AI)과 딥러닝(LSTM) 모델로 상위 100~200개 종목의 24시간 후 가격 방향을 예측합니다.',
    why: '인간이 보기 어려운 복잡한 패턴을 AI가 학습해 예측합니다. 참고 지표로 활용하면 진입 판단에 도움이 됩니다.',
    tags: ['상위 100종목', 'LSTM 200종목', 'AI 기반'],
  },
  {
    emoji: '💬',
    title: '분석 커뮤니티',
    badge: '무료',
    badgeColor: 'bg-green-500/20 text-green-400 border-green-500/30',
    href: '/community',
    color: 'border-pink-500/20 hover:border-pink-500/40',
    iconBg: 'bg-pink-500/10',
    desc: '다른 사용자들과 종목 분석을 공유하고 의견을 나눌 수 있습니다. 실시간 시장 의견을 빠르게 파악하세요.',
    why: '혼자 판단하기 어려운 상황에서 다른 사람들의 분석을 참고하면 더 넓은 시각을 얻을 수 있습니다.',
    tags: ['게시판', '자유 분석', '커뮤니티'],
  },
];

/* ── 차트 용어 설명 데이터 ───────────────────────────────────────────────── */
const chartTerms = [
  {
    term: '이동평균선 (MA)',
    en: 'Moving Average',
    color: 'text-yellow-400',
    dot: 'bg-yellow-400',
    desc: '일정 기간의 종가를 평균낸 선입니다. MA50은 최근 50개 캔들의 평균이에요.',
    tip: '가격이 MA 위에 있으면 상승 추세, 아래에 있으면 하락 추세로 봅니다.',
    example: 'MA50 (노란선) > MA110 (주황선) > MA180 (빨간선) 순서면 "정배열"이라고 해요.',
  },
  {
    term: '박스권',
    en: 'Consolidation Zone',
    color: 'text-blue-400',
    dot: 'bg-blue-400',
    desc: '가격이 일정한 범위(지지선~저항선) 안에서 횡보하는 구간입니다.',
    tip: '에너지가 축적되는 구간으로, 돌파 후 큰 방향성이 나오는 경우가 많습니다.',
    example: '박스권 상단(저항선) 위로 가격이 올라서면 "상방 돌파"라고 합니다.',
  },
  {
    term: '거래량',
    en: 'Volume',
    color: 'text-green-400',
    dot: 'bg-green-400',
    desc: '일정 시간 동안 거래된 코인의 양입니다. 막대가 클수록 많은 사람이 거래한 것이에요.',
    tip: '가격이 오를 때 거래량도 늘어나면 신뢰도 있는 상승, 거래량 없이 오르면 약한 상승입니다.',
    example: '거래량이 평소의 20배 이상 터지면 세력의 개입 가능성이 높습니다.',
  },
  {
    term: '일목균형표 (구름)',
    en: 'Ichimoku Cloud',
    color: 'text-emerald-400',
    dot: 'bg-emerald-400',
    desc: '여러 지표를 한 번에 보여주는 복합 지표입니다. 녹색/빨간 구름 형태로 표시됩니다.',
    tip: '가격이 구름 위에 있으면 강세, 구름 아래에 있으면 약세 신호입니다.',
    example: '구름 위에서 정배열까지 확인되면 강한 상승 추세를 의미합니다.',
  },
  {
    term: 'RSI',
    en: 'Relative Strength Index',
    color: 'text-purple-400',
    dot: 'bg-purple-400',
    desc: '가격이 얼마나 과매수/과매도 상태인지 0~100 숫자로 나타냅니다.',
    tip: '30 이하면 과매도(반등 가능), 70 이상이면 과매수(하락 주의)로 해석합니다.',
    example: 'RSI 30 근처에서 반등이 나오면 매수 타이밍으로 보는 트레이더가 많습니다.',
  },
  {
    term: '펀딩비',
    en: 'Funding Rate',
    color: 'text-cyan-400',
    dot: 'bg-cyan-400',
    desc: '선물 거래에서 롱(상승 베팅)과 숏(하락 베팅) 포지션 간에 주고받는 수수료입니다.',
    tip: '펀딩비가 매우 높으면 롱이 넘쳐 과열 상태, 매우 낮으면 숏이 넘쳐 공포 상태입니다.',
    example: '펀딩비 +0.3% 이상이면 롱 과열, -0.1% 이하면 숏 과매도 구간으로 봅니다.',
  },
];

/* ── 사용 흐름 단계 ──────────────────────────────────────────────────────── */
const steps = [
  {
    step: '01',
    title: '홈에서 박스권 종목 확인',
    desc: '매일 홈 화면을 열면 조건을 통과한 종목들이 자동으로 정렬되어 있습니다. 따로 차트를 뒤질 필요가 없습니다.',
    color: 'text-yellow-400',
    border: 'border-yellow-500/30',
    bg: 'bg-yellow-500/5',
  },
  {
    step: '02',
    title: '거래량·분석 페이지로 교차 확인',
    desc: '관심 종목이 생기면 거래량 스캐너와 분석 페이지에서 이동평균선 라이딩 여부를 추가로 확인하세요.',
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
  },
  {
    step: '03',
    title: '돌파 분석으로 진입 타이밍 잡기',
    desc: '박스권 상단을 실제로 돌파한 순간을 돌파 분석 페이지에서 실시간으로 확인합니다.',
    color: 'text-orange-400',
    border: 'border-orange-500/30',
    bg: 'bg-orange-500/5',
  },
  {
    step: '04',
    title: '펀딩비·AI 예측으로 시장 분위기 파악',
    desc: '시장이 지나치게 과열되어 있는지, AI는 어느 방향을 예측하는지 참고해 최종 판단을 내립니다.',
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
  },
];

/* ── 페이지 ──────────────────────────────────────────────────────────────── */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-6 sm:py-10 max-w-4xl">

        {/* ── 히어로 ── */}
        <section className="mb-12 sm:mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-xs font-bold mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
            비트다모아봄 소개
          </div>
          <h1 className="text-2xl sm:text-4xl font-bold text-white mb-4 leading-tight">
            차트 몰라도 괜찮아요<br />
            <span className="text-yellow-500">조건 충족 종목</span>을 자동으로 알려드립니다
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed mb-8">
            매일 수백 개 차트를 직접 볼 시간이 없는 분들을 위해 만들었습니다.
            복잡한 기술적 지표를 서버가 대신 계산하고, 조건에 맞는 종목만 추려서 보여줍니다.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-sm font-bold transition-colors"
            >
              지금 바로 사용하기
            </Link>
            <Link
              href="/premium"
              className="px-5 py-2.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm font-semibold transition-colors"
            >
              프리미엄 보기
            </Link>
          </div>
        </section>

        {/* ── 기능 소개 ── */}
        <section className="mb-12 sm:mb-16">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-bold text-white mb-2">주요 기능</h2>
            <p className="text-sm text-zinc-500">각 기능이 무엇을 하는지, 왜 유용한지 설명합니다.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className={`group rounded-xl border ${f.color} bg-zinc-900 p-4 sm:p-5 transition-all hover:bg-zinc-800/80`}
              >
                {/* 헤더 */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${f.iconBg} flex items-center justify-center text-xl shrink-0`}>
                      {f.emoji}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{f.title}</h3>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${f.badgeColor}`}>
                        {f.badge}
                      </span>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* 설명 */}
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">{f.desc}</p>

                {/* 왜 유용한가 */}
                <div className="rounded-lg bg-zinc-800/60 p-2.5 mb-3">
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    <span className="text-zinc-300 font-semibold">왜 유용한가? </span>
                    {f.why}
                  </p>
                </div>

                {/* 태그 */}
                <div className="flex flex-wrap gap-1">
                  {f.tags.map((tag) => (
                    <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── 추천 사용 흐름 ── */}
        <section className="mb-12 sm:mb-16">
          <div className="mb-6 sm:mb-8">
            <h2 className="text-lg sm:text-2xl font-bold text-white mb-2">이렇게 활용하세요</h2>
            <p className="text-sm text-zinc-500">처음 접속했을 때 어떤 순서로 보면 좋은지 알려드립니다.</p>
          </div>

          <div className="space-y-3">
            {steps.map((s) => (
              <div key={s.step} className={`rounded-xl border ${s.border} ${s.bg} p-4 sm:p-5 flex gap-4`}>
                <div className={`text-2xl sm:text-3xl font-black ${s.color} shrink-0 leading-none mt-0.5`}>{s.step}</div>
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">{s.title}</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 차트 용어 설명 (초보자) ── */}
        <section className="mb-12 sm:mb-16">
          <div className="mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold mb-3">
              초보자 안내
            </div>
            <h2 className="text-lg sm:text-2xl font-bold text-white mb-2">차트 용어가 낯선 분들을 위해</h2>
            <p className="text-sm text-zinc-500">사이트에서 자주 나오는 단어들을 쉽게 설명합니다.</p>
          </div>

          <div className="space-y-3">
            {chartTerms.map((t) => (
              <div key={t.term} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${t.dot} shrink-0`} />
                  <h3 className={`text-sm font-bold ${t.color}`}>{t.term}</h3>
                  <span className="text-[10px] text-zinc-600">{t.en}</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed mb-2">{t.desc}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 rounded-lg bg-zinc-800 px-3 py-2">
                    <p className="text-[10px] text-zinc-500 mb-0.5 font-semibold">포인트</p>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">{t.tip}</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-zinc-800 px-3 py-2">
                    <p className="text-[10px] text-zinc-500 mb-0.5 font-semibold">예시</p>
                    <p className="text-[10px] text-zinc-400 leading-relaxed">{t.example}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 주의사항 ── */}
        <section className="mb-10">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0">⚠️</span>
              <div>
                <h3 className="text-sm font-bold text-zinc-200 mb-2">투자 주의사항</h3>
                <ul className="text-xs text-zinc-500 space-y-1.5 leading-relaxed">
                  <li>• 이 사이트의 모든 정보는 <span className="text-zinc-300">참고용 데이터</span>이며, 투자 권유가 아닙니다.</li>
                  <li>• 기술적 지표는 과거 데이터를 기반으로 하며, 미래 수익을 보장하지 않습니다.</li>
                  <li>• 단일 지표만으로 매매 결정을 내리지 마세요. 여러 지표를 교차해서 확인하세요.</li>
                  <li>• 코인 투자는 원금 손실 위험이 있습니다. 감당할 수 있는 금액만 투자하세요.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="text-center py-6 sm:py-8">
          <h2 className="text-base sm:text-xl font-bold text-white mb-2">준비되셨나요?</h2>
          <p className="text-sm text-zinc-500 mb-6">지금 바로 조건 충족 종목을 확인해보세요.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-zinc-950 text-sm font-bold transition-colors"
            >
              박스권 스캐너 보기
            </Link>
            <Link
              href="/box-breakout"
              className="px-6 py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm font-semibold transition-colors"
            >
              돌파 분석 보기
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}
