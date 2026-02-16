# 🔗 ngrok 연결 가이드

## 📋 목차
1. [기본 연결](#기본-연결)
2. [자동 연결](#자동-연결)
3. [연결 확인](#연결-확인)
4. [문제 해결](#문제-해결)

---

## 🚀 기본 연결

### Step 1: 백엔드 서버 실행

**터미널 1 열기:**
```bash
npm run dev:backend
```

**확인:**
```
✓ 서버가 http://localhost:3001 에서 실행 중
```

---

### Step 2: ngrok 터널 생성

**터미널 2 열기:**
```bash
npm run ngrok:backend
```

**화면:**
```
ngrok

Session Status     online
Region             Japan (jp)
Forwarding         https://xxxx-xxxx.ngrok-free.app -> http://localhost:3001
                   ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
                   이 URL을 복사하세요!
```

---

### Step 3: 환경 변수 설정

#### 방법 A: .env.local 수정 (로컬 개발)

**.env.local** 파일 열기:
```bash
# Before
NEXT_PUBLIC_API_URL=http://localhost:3001

# After (ngrok URL로 변경)
NEXT_PUBLIC_API_URL=https://xxxx-xxxx.ngrok-free.app
```

#### 방법 B: Vercel 환경 변수 (배포)

1. https://vercel.com/dashboard
2. 프로젝트 선택
3. Settings → Environment Variables
4. 변수 추가:
   ```
   Name: NEXT_PUBLIC_API_URL
   Value: https://xxxx-xxxx.ngrok-free.app
   ```
5. Redeploy

---

### Step 4: 프론트엔드 시작/재시작

**터미널 3 열기:**
```bash
npm run dev:frontend
```

**확인:**
```
✓ 프론트엔드가 http://localhost:3000 에서 실행 중
✓ API 호출 → https://xxxx-xxxx.ngrok-free.app
```

---

## ⚡ 자동 연결 (Windows)

### 배치 파일 사용

**더블클릭만 하세요:**
```
start-with-ngrok.bat
```

자동으로:
1. 백엔드 서버 시작
2. ngrok 터널 생성
3. URL 표시

---

## 🧪 연결 확인

### 1. 백엔드 직접 테스트

브라우저에서:
```
https://your-ngrok-url.ngrok-free.app/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

### 2. 프론트엔드에서 테스트

브라우저 개발자 도구 → Console:
```javascript
console.log(process.env.NEXT_PUBLIC_API_URL)
// 출력: https://your-ngrok-url.ngrok-free.app
```

### 3. API 호출 테스트

스캐너 페이지에서 "박스권 스캔 시작" 버튼 클릭

**Network 탭 확인:**
```
Request URL: https://your-ngrok-url.ngrok-free.app/api/scan
Status: 200 OK
```

---

## 🔍 연결 흐름도

```
┌─────────────────────────────────────────────────┐
│  브라우저 (http://localhost:3000)                 │
│  또는 Vercel (https://your-app.vercel.app)       │
└────────────────────┬────────────────────────────┘
                     │
                     │ API 요청
                     ↓
┌─────────────────────────────────────────────────┐
│  ngrok (https://xxxx.ngrok-free.app)             │
│  ↓ 터널링                                         │
│  백엔드 서버 (http://localhost:3001)              │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ 문제 해결

### ❌ ngrok: command not found

**문제:** ngrok이 설치되지 않음

**해결:**
1. https://ngrok.com/download 에서 다운로드
2. 압축 해제
3. PATH에 추가 또는 프로젝트 폴더에 복사

---

### ❌ Failed to start tunnel

**문제:** ngrok 인증 필요

**해결:**
```bash
# 1. ngrok 회원가입
https://dashboard.ngrok.com/signup

# 2. Auth Token 복사
https://dashboard.ngrok.com/get-started/your-authtoken

# 3. 설정
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

---

### ❌ API 호출 실패 (CORS)

**문제:** CORS 에러

**확인:**
1. 백엔드 서버가 실행 중인지 확인
2. `server/index.js`에 CORS 설정 있는지 확인:
   ```javascript
   app.use(cors());
   ```

---

### ❌ 환경 변수가 반영 안됨

**문제:** .env.local 변경 후 적용 안됨

**해결:**
1. 프론트엔드 서버 재시작:
   ```bash
   # Ctrl+C로 종료 후
   npm run dev:frontend
   ```

2. Vercel 재배포:
   ```bash
   vercel --prod --force
   ```

---

### ❌ ngrok URL이 자꾸 바뀜

**문제:** 무료 플랜은 재시작 시 URL 변경

**해결 방법:**

**옵션 1: ngrok 계속 실행**
- ngrok을 종료하지 마세요
- 컴퓨터 재부팅 시에만 URL 변경됨

**옵션 2: ngrok Pro ($8/월)**
- 고정 도메인 제공
- `--domain` 옵션 사용 가능

**옵션 3: 백엔드 배포**
- Railway: https://railway.app (무료 플랜)
- Render: https://render.com (무료 플랜)
- 고정 URL 제공

---

## 📱 모바일에서 테스트

### 1. ngrok URL 사용

모바일 브라우저에서:
```
https://your-ngrok-url.ngrok-free.app
```

직접 백엔드 접속 가능!

### 2. 프론트엔드 (Vercel)에서 테스트

모바일 브라우저에서:
```
https://your-app.vercel.app
```

프론트엔드가 자동으로 ngrok 백엔드 호출

---

## 🎯 실전 시나리오

### 시나리오 1: 혼자 개발

```bash
# 터미널 1
npm run dev:full     # 프론트+백엔드 동시

# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001

# 브라우저
http://localhost:3000
```

---

### 시나리오 2: 모바일 테스트

```bash
# 터미널 1
npm run dev:backend

# 터미널 2
npm run ngrok:backend
# → https://xxxx.ngrok-free.app 복사

# .env.local 수정
NEXT_PUBLIC_API_URL=https://xxxx.ngrok-free.app

# 터미널 3
npm run dev:frontend

# 모바일
http://your-computer-ip:3000
```

---

### 시나리오 3: Vercel 배포

```bash
# 1. 백엔드 + ngrok 실행
start-with-ngrok.bat
# → https://xxxx.ngrok-free.app 복사

# 2. Vercel 환경 변수 설정
NEXT_PUBLIC_API_URL=https://xxxx.ngrok-free.app

# 3. 배포
vercel --prod

# 4. 완료!
https://your-app.vercel.app
```

---

## 📊 연결 체크리스트

### 배포 전
- [ ] 백엔드 서버 실행 중 (포트 3001)
- [ ] ngrok 터널 실행 중
- [ ] ngrok URL 복사함
- [ ] .env.local 또는 Vercel 환경 변수 설정
- [ ] 프론트엔드 재시작 또는 재배포

### 테스트
- [ ] /health 엔드포인트 정상
- [ ] 스캔 기능 작동
- [ ] 차트 모달 작동
- [ ] 모바일에서 접속 가능

---

## 🔐 보안 팁

### ngrok 무료 플랜 주의사항

1. **URL 공개 금지**: ngrok URL을 공개하지 마세요
2. **임시 사용**: 개발/테스트용으로만 사용
3. **인증 추가**: 프로덕션에서는 API 인증 필요

### 프로덕션 배포 시

백엔드를 Railway/Render에 배포하고:
- HTTPS 자동
- 고정 URL
- 환경 변수 보안
- DB 연동 가능

---

## 💡 유용한 명령어

```bash
# ngrok 상태 확인
curl http://localhost:4040/api/tunnels

# ngrok Web UI (브라우저)
http://localhost:4040

# 백엔드 헬스체크
curl https://your-ngrok-url.ngrok-free.app/health

# 프론트엔드 환경 변수 확인 (개발자 도구)
console.log(process.env.NEXT_PUBLIC_API_URL)
```

---

**이제 ngrok 연결이 완벽하게 이해되셨나요?** 🚀

문제가 있으면 위 문제 해결 섹션을 참고하세요!
