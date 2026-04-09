const NAVER_SESSION_KEY = 'naver_session';

export interface NaverSession {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export function getNaverAuthUrl(): string {
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SITE_URL;
  const redirectUri = `${origin}/auth/naver/callback`;
  const state = Math.random().toString(36).substring(2);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
    redirect_uri: redirectUri,
    state,
  });
  return `https://nid.naver.com/oauth2.0/authorize?${params}`;
}

export function getNaverSession(): NaverSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(NAVER_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setNaverSession(session: NaverSession): void {
  localStorage.setItem(NAVER_SESSION_KEY, JSON.stringify(session));
}

export function clearNaverSession(): void {
  localStorage.removeItem(NAVER_SESSION_KEY);
}
