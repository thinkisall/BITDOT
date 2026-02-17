// lib/apiClient.ts
// API 클라이언트 - 환경에 따라 올바른 API URL 사용

/**
 * API Base URL 가져오기
 * - 로컬: http://localhost:3001
 * - Vercel: Cloudflare Tunnel URL
 */
export function getApiUrl(): string {
  // 브라우저에서만 접근 가능한 환경 변수
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  // 서버 사이드
  return process.env.API_URL || 'http://localhost:3001';
}

/**
 * API 호출 헬퍼
 */
export async function apiClient<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }

  return response.json();
}
