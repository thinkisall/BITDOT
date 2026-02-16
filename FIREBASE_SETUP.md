# Firebase OAuth 로그인 설정 가이드

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력 (예: bitdamoabom)
4. Google 애널리틱스는 선택사항 (필요하면 활성화)

## 2. 웹 앱 추가

1. Firebase 프로젝트 개요 화면에서 "웹" 아이콘 클릭 (`</>`)
2. 앱 닉네임 입력 (예: BITDAMOABOM Web)
3. Firebase SDK 스니펫에서 **구성** 정보 복사

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## 3. 환경변수 설정

`.env.local` 파일을 생성하고 Firebase 구성 정보를 입력:

```env
# Firebase 설정 (Google OAuth 로그인)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

## 4. Google 로그인 활성화

1. Firebase Console에서 **Authentication** 메뉴 클릭
2. "Sign-in method" 탭 선택
3. "Google" 제공업체 클릭
4. "사용 설정" 토글 활성화
5. 프로젝트 지원 이메일 선택
6. "저장" 클릭

## 5. 승인된 도메인 추가 (배포 시)

1. Authentication > Settings > Authorized domains
2. 배포 도메인 추가 (예: `www.damoabom.com`)
3. 개발 중에는 `localhost` 자동 포함

## 6. 카카오 로그인 추가 (선택사항)

카카오 로그인을 추가하려면:

1. [Kakao Developers](https://developers.kakao.com/) 접속
2. 애플리케이션 등록
3. Firebase에서 Custom OAuth 설정

또는 Firebase Extensions에서 "Kakao Login" 확장 설치

## 7. Firebase 패키지 설치

```bash
npm install firebase
```

## 8. 테스트

1. 개발 서버 실행: `npm run dev`
2. 헤더의 "Google 로그인" 버튼 클릭
3. Google 계정으로 로그인
4. 프로필 사진과 이름이 표시되는지 확인

## 주의사항

- `.env.local` 파일은 절대 Git에 커밋하지 마세요
- `.gitignore`에 `.env.local`이 포함되어 있는지 확인
- Firebase 프로젝트 권한을 안전하게 관리하세요

## 다음 단계

로그인 기능이 작동하면:
- 사용자별 주목 종목 저장 기능 추가
- Firestore로 사용자 데이터 관리
- 가격 알림 기능 구현
