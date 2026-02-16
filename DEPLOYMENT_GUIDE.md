# 🚀 배포 가이드 (프론트엔드 + 백엔드 분리)

## 📋 아키텍처

```
┌─────────────────────────────────────────┐
│         사용자 (브라우저)                  │
└────────────┬────────────────────────────┘
             │
             ├─ 프론트엔드 (Vercel)
             │  ├─ Pages (/, /scanner)
             │  ├─ Components
             │  └─ Static Assets
             │
             └─ 백엔드 (로컬 + ngrok)
                ├─ POST /api/scan
                └─ GET /api/chart
```

---

## 🔧 설정 단계

### 1️⃣ 의존성 설치

```bash
npm install
```

새로 추가된 패키지:
- `express`: 백엔드 서버
- `cors`: CORS 처리
- `concurrently`: 동시 실행

---

### 2️⃣ 로컬 개발 (프론트 + 백엔드 동시 실행)

#### 방법 1: 통합 실행 (권장)
```bash
npm run dev:full
```

이 명령어는 다음을 동시에 실행:
- 프론트엔드: http://localhost:3000
- 백엔드: http://localhost:3001

#### 방법 2: 별도 터미널
**터미널 1 - 프론트엔드**
```bash
npm run dev:frontend
```

**터미널 2 - 백엔드**
```bash
npm run dev:backend
```

---

### 3️⃣ 백엔드를 ngrok으로 외부 노출

**터미널 3 - ngrok**
```bash
npm run ngrok:backend
```

또는 직접:
```bash
ngrok http 3001 --region jp
```

ngrok이 시작되면 URL 확인:
```
Forwarding  https://xxxx-xxxx.ngrok-free.app -> http://localhost:3001
```

---

### 4️⃣ 환경 변수 설정

#### 로컬 개발 (.env.local)
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### Vercel 배포 (Environment Variables)

Vercel 대시보드에서 설정:
```
NEXT_PUBLIC_API_URL = https://your-ngrok-url.ngrok-free.app
```

**중요:** ngrok URL을 여기에 입력!

---

### 5️⃣ Vercel 배포

#### 초기 설정
```bash
# Vercel CLI 설치 (처음 한 번만)
npm i -g vercel

# 로그인
vercel login

# 프로젝트 연결
vercel
```

#### vercel.json 수정

`vercel.json` 파일을 열고 ngrok URL 업데이트:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://YOUR-ACTUAL-NGROK-URL.ngrok-free.app/api/:path*"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://YOUR-ACTUAL-NGROK-URL.ngrok-free.app"
  }
}
```

#### 배포 실행
```bash
# 미리보기 배포
vercel

# 프로덕션 배포
vercel --prod
```

---

## 🎯 전체 워크플로우

### 개발 단계
```bash
# 1. 프론트 + 백엔드 동시 실행
npm run dev:full

# 2. 브라우저에서 테스트
http://localhost:3000
```

### 외부 접속 테스트 (모바일)
```bash
# 1. 백엔드 실행
npm run dev:backend

# 2. ngrok 터널
npm run ngrok:backend
# → https://xxxx.ngrok-free.app 확인

# 3. .env.local 업데이트
NEXT_PUBLIC_API_URL=https://xxxx.ngrok-free.app

# 4. 프론트엔드 재시작
npm run dev:frontend

# 5. 모바일에서 접속
http://localhost:3000 (같은 와이파이)
```

### Vercel 배포
```bash
# 1. 백엔드 시작
npm run dev:backend

# 2. ngrok 터널 (고정 유지)
npm run ngrok:backend

# 3. ngrok URL 복사
https://xxxx-xxxx.ngrok-free.app

# 4. Vercel 환경 변수 설정
NEXT_PUBLIC_API_URL=https://xxxx-xxxx.ngrok-free.app

# 5. Vercel 배포
vercel --prod

# 6. 완료!
https://your-project.vercel.app
```

---

## 📁 파일 구조

```
bitdot/
├── app/                    # 프론트엔드 (Vercel)
│   ├── page.tsx
│   ├── scanner/page.tsx
│   └── components/
│
├── server/                 # 백엔드 (로컬 + ngrok)
│   ├── index.js           # Express 서버
│   └── routes/
│       ├── scan.js        # POST /api/scan
│       └── chart.js       # GET /api/chart
│
├── lib/
│   ├── apiClient.ts       # API 클라이언트
│   ├── cache.ts           # 캐싱
│   └── rateLimiter.ts     # Rate Limiting
│
├── .env.local             # 로컬 환경 변수
├── vercel.json            # Vercel 설정
└── package.json
```

---

## 🔍 API 호출 흐름

### 로컬 개발
```
브라우저
  → http://localhost:3000 (프론트엔드)
    → http://localhost:3001/api/scan (백엔드)
```

### Vercel 배포
```
브라우저
  → https://your-app.vercel.app (프론트엔드)
    → https://xxxx.ngrok-free.app/api/scan (백엔드)
```

---

## ⚙️ 환경 변수 관리

### .env.local (로컬 개발)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Vercel (프로덕션)
```
Dashboard → Settings → Environment Variables

NEXT_PUBLIC_API_URL = https://your-ngrok-url.ngrok-free.app
```

---

## 🛠️ 트러블슈팅

### CORS 에러
**문제:** `Access-Control-Allow-Origin` 에러

**해결:** `server/index.js`에 이미 CORS 설정됨
```javascript
app.use(cors());
```

### 환경 변수가 반영 안됨
**해결:**
1. 프론트엔드 재시작
2. Vercel 재배포
```bash
vercel --prod --force
```

### ngrok URL이 계속 바뀜
**문제:** 무료 플랜은 재시작 시 URL 변경

**해결 방법:**
1. ngrok을 계속 실행 (종료하지 않기)
2. ngrok Pro ($8/월) - 고정 URL
3. 또는 Railway/Render 사용 (고정 URL 제공)

---

## 💡 권장 사항

### 개발 시
- 로컬에서 `npm run dev:full` 사용
- CORS 문제 없음

### 배포 시
- 프론트: Vercel (무료)
- 백엔드: ngrok (무료, 테스트용)
- 프로덕션: Railway/Render (유료, $5~)

---

## 🚀 다음 단계

### 백엔드를 영구적으로 배포하려면

**옵션 1: Railway (권장)**
```bash
# Railway 계정 생성
# GitHub 연동
# server/ 폴더만 배포
# 고정 URL 제공
```

**옵션 2: Render**
```bash
# render.com 가입
# Web Service 생성
# Start Command: node server/index.js
```

**옵션 3: Fly.io**
```bash
flyctl launch
flyctl deploy
```

비용: 모두 $5/월부터 시작

---

## 📞 API 엔드포인트

### 백엔드 서버 (http://localhost:3001)

- `GET /` - API 정보
- `GET /health` - 서버 상태
- `POST /api/scan` - 박스권 스캔
- `GET /api/chart?symbol=BTC&exchange=upbit` - 차트 데이터

---

## ✅ 체크리스트

### 배포 전 확인사항
- [ ] 백엔드 서버 실행 중
- [ ] ngrok 터널 실행 중
- [ ] ngrok URL 확인
- [ ] Vercel 환경 변수 설정
- [ ] vercel.json에 ngrok URL 입력
- [ ] API 테스트 완료

### 배포 후 확인사항
- [ ] Vercel 사이트 접속
- [ ] 스캔 기능 테스트
- [ ] 차트 모달 테스트
- [ ] 모바일에서 테스트

---

**이제 프론트엔드는 Vercel에, 백엔드는 로컬 + ngrok으로 분리 완료!** 🎉
