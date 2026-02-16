import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.damoabom.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'BITDAMOABOM - 암호화폐 거래소 시세 비교',
    template: '%s | BITDAMOABOM'
  },
  description: '업비트와 빗썸의 실시간 암호화폐 시세를 비교하고 박스권 스캐너로 거래 기회를 찾아보세요.',
  keywords: ['암호화폐', '비트코인', '거래소', '시세 비교', '업비트', '빗썸', '박스권', '스캐너'],
  authors: [{ name: 'BITDAMOABOM' }],
  alternates: {
    canonical: siteUrl,
    types: {
      'application/rss+xml': `${siteUrl}/rss.xml`,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    siteName: 'BITDAMOABOM',
    title: 'BITDAMOABOM - 암호화폐 거래소 시세 비교',
    description: '업비트와 빗썸의 실시간 암호화폐 시세를 비교하고 박스권 스캐너로 거래 기회를 찾아보세요.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BITDAMOABOM - 암호화폐 거래소 시세 비교',
    description: '업비트와 빗썸의 실시간 암호화폐 시세를 비교하고 박스권 스캐너로 거래 기회를 찾아보세요.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}
      >
        {children}
      </body>
    </html>
  );
}
