import { NextRequest, NextResponse } from 'next/server';
import { createOrUpdateUser } from '@/lib/supabase/users';

export async function POST(request: NextRequest) {
  const { code, state } = await request.json();
  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 });
  }

  const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL;
  const redirectUri = `${origin}/auth/naver/callback`;

  // 1. auth code → access token
  const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.NEXT_PUBLIC_NAVER_CLIENT_ID!,
      client_secret: process.env.NAVER_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
      state: state || '',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    console.error('Naver token error:', tokenData);
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 });
  }

  // 2. 유저 정보 조회
  const userRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userData = await userRes.json();
  if (userData.resultcode !== '00') {
    return NextResponse.json({ error: 'Failed to get Naver user info' }, { status: 400 });
  }

  const profile = userData.response;
  const uid = `naver_${profile.id}`;
  const email = profile.email ?? null;
  const displayName = profile.name ?? profile.nickname ?? null;
  const photoURL = profile.profile_image ?? null;

  // 3. Supabase에 저장
  await createOrUpdateUser(uid, email ?? `naver_${profile.id}@naver.local`, displayName, photoURL);

  return NextResponse.json({ uid, email, displayName, photoURL });
}
