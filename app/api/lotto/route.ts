import { NextRequest, NextResponse } from 'next/server';

const FIRST_DRAW_DATE = new Date('2002-12-07T20:00:00+09:00');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Referer': 'https://www.dhlottery.co.kr/gameResult.do?method=byWin',
  'X-Requested-With': 'XMLHttpRequest',
};

function getCurrentRound(): number {
  const now = new Date();
  const diffMs = now.getTime() - FIRST_DRAW_DATE.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

async function getSessionCookie(): Promise<string> {
  const res = await fetch('https://www.dhlottery.co.kr/common.do?method=main', {
    headers: {
      'User-Agent': HEADERS['User-Agent'],
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
    cache: 'no-store',
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  // JSESSIONID 또는 다른 세션 쿠키 추출
  const cookies = setCookie.split(',').map(c => c.split(';')[0].trim()).join('; ');
  return cookies;
}

async function fetchLotto(round: number, cookie: string) {
  const res = await fetch(
    `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${round}`,
    {
      headers: { ...HEADERS, Cookie: cookie },
      cache: 'no-store',
    }
  );

  const text = await res.text();
  if (text.trim().startsWith('<')) {
    throw new Error(`HTML_RESPONSE:${round}`);
  }

  return JSON.parse(text) as Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const roundParam = searchParams.get('round');
  let round = roundParam ? parseInt(roundParam) : getCurrentRound();

  try {
    const cookie = await getSessionCookie();

    let data = await fetchLotto(round, cookie);

    // 아직 추첨 전 회차면 이전 회차로
    if (data.returnValue !== 'success' && !roundParam) {
      round = round - 1;
      data = await fetchLotto(round, cookie);
    }

    if (data.returnValue !== 'success') {
      return NextResponse.json(
        { error: `해당 회차(${round}) 데이터가 없습니다.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      round: data.drwNo,
      date: data.drwNoDate,
      numbers: [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6],
      bonus: data.bnusNo,
      firstPrize: data.firstWinamnt,
      firstWinners: data.firstPrzwnerCo,
      totalSales: data.totSellamnt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `서버 오류: ${msg}` }, { status: 500 });
  }
}
