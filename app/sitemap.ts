// app/sitemap.ts
import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.damoabom.com';
  const now = new Date();

  return [
    { url: baseUrl, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${baseUrl}/analysis`, lastModified: now, changeFrequency: 'hourly', priority: 0.95 },
    { url: `${baseUrl}/box-breakout`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/divergence`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${baseUrl}/rsi-scanner`, lastModified: now, changeFrequency: 'hourly', priority: 0.85 },
    { url: `${baseUrl}/scanner`, lastModified: now, changeFrequency: 'hourly', priority: 0.85 },
    { url: `${baseUrl}/funding`, lastModified: now, changeFrequency: 'hourly', priority: 0.7 },
    { url: `${baseUrl}/premium`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/board`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
    { url: `${baseUrl}/community`, lastModified: now, changeFrequency: 'daily', priority: 0.6 },
  ];
}
