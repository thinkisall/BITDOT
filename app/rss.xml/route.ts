// app/rss.xml/route.ts
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.damoabom.com';
  const currentDate = new Date().toUTCString();

  const items = [
    {
      title: '거래소 시세 비교',
      link: baseUrl,
      description: '업비트와 빗썸의 실시간 암호화폐 시세를 비교하고 차익거래 기회를 찾아보세요.',
    },
    {
      title: '박스권 분석 (4개 시간대)',
      link: `${baseUrl}/analysis`,
      description: '4개 시간대 박스권 + MA50 우상향 조건을 동시에 충족하는 종목을 자동으로 추려냅니다.',
    },
    {
      title: '박스권 돌파 타점 분석',
      link: `${baseUrl}/box-breakout`,
      description: '업비트·빗썸 전종목에서 박스권 + 거래량 급등 조건으로 돌파 직전 종목을 포착합니다. 매수가·손절가·목표가를 자동 계산합니다.',
    },
    {
      title: 'MA50 위 종목 스캐너',
      link: `${baseUrl}/divergence`,
      description: '5분봉 MA50 + 1시간봉 MA50 동시에 위에 있는 종목을 탐지합니다. 단기·중기 모두 상승 추세인 종목을 포착합니다.',
    },
    {
      title: 'RSI 스캐너',
      link: `${baseUrl}/rsi-scanner`,
      description: '빗썸 전종목의 RSI 과매도/과매수 구간을 실시간으로 스캔합니다.',
    },
    {
      title: '박스권 스캐너',
      link: `${baseUrl}/scanner`,
      description: '거래량 상위 종목 중 박스권을 형성한 종목을 자동으로 탐지합니다. 지지/저항 레벨 분석과 함께 제공됩니다.',
    },
    {
      title: '펀딩비 현황',
      link: `${baseUrl}/funding`,
      description: '주요 암호화폐의 선물 펀딩비 현황을 한눈에 확인하세요.',
    },
    {
      title: '코인 분석 커뮤니티',
      link: `${baseUrl}/community`,
      description: '사용자들이 코인을 직접 분석하고 공유하는 커뮤니티 게시판입니다.',
    },
    {
      title: '자유게시판',
      link: `${baseUrl}/board`,
      description: '암호화폐 투자에 관한 자유로운 이야기를 나누는 게시판입니다.',
    },
  ];

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>빗다모아봄 - 암호화폐 박스권·RSI·MA50 스캐너</title>
    <link>${baseUrl}</link>
    <description>업비트·빗썸 전종목 박스권 돌파, MA50 우상향, RSI 스캔을 자동으로 분석하는 암호화폐 분석 서비스</description>
    <language>ko</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>
${items.map((item) => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${currentDate}</pubDate>
      <guid>${item.link}</guid>
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
