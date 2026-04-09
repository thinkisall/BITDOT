// 앱 전체에서 사용하는 유저 타입 (Google/Kakao 공통)
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  provider: 'google' | 'naver';
}
