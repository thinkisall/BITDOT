// app/rss.xml/route.ts
export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.damoabom.com';
  const currentDate = new Date().toUTCString();

  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>BITDAMOABOM - 암호화폐 거래소 시세 비교 및 박스권 스캐너</title>
    <link>${baseUrl}</link>
    <description>업비트와 빗썸의 실시간 암호화폐 시세 비교 및 박스권 스캐너 서비스</description>
    <language>ko</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <atom:link href="${baseUrl}/rss.xml" rel="self" type="application/rss+xml"/>

    <item>
      <title>거래소 시세 비교</title>
      <link>${baseUrl}</link>
      <description>업비트와 빗썸의 실시간 암호화폐 시세를 비교하고 차익거래 기회를 찾아보세요.</description>
      <pubDate>${currentDate}</pubDate>
      <guid>${baseUrl}</guid>
    </item>

    <item>
      <title>박스권 스캐너</title>
      <link>${baseUrl}/scanner</link>
      <description>거래량 상위 300종목 중 박스권을 형성한 종목을 자동으로 탐지합니다. 지지/저항 레벨 분석과 함께 제공됩니다.</description>
      <pubDate>${currentDate}</pubDate>
      <guid>${baseUrl}/scanner</guid>
    </item>
  </channel>
</rss>`;

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
