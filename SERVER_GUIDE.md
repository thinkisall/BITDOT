# BITDAMOABOM 서버 실행 가이드

## 📋 목차
1. [기본 실행](#기본-실행)
2. [ngrok 터널 사용](#ngrok-터널-사용)
3. [환경 변수 설정](#환경-변수-설정)
4. [배포](#배포)

---

## 🚀 기본 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 시작
```bash
npm run dev
```

서버가 시작되면 http://localhost:3000 에서 접속 가능합니다.

---

## 🔗 ngrok 터널 사용

외부에서 로컬 서버에 접속하려면 ngrok을 사용합니다.

### ngrok 설치 및 설정

1. **ngrok 다운로드**
   - https://ngrok.com/download 에서 다운로드
   - 압축 해제 후 PATH에 추가

2. **ngrok 계정 설정** (필수)
   ```bash
   ngrok config add-authtoken <YOUR_AUTH_TOKEN>
   ```
   - Auth Token은 https://dashboard.ngrok.com/get-started/your-authtoken 에서 확인

### 방법 1: 별도 터미널 사용 (권장)

**터미널 1** - Next.js 서버 실행
```bash
npm run dev
```

**터미널 2** - ngrok 터널 생성
```bash
npm run ngrok
```

### 방법 2: 통합 실행

개발 서버와 ngrok을 동시에 실행:
```bash
npm run dev:ngrok
```

### 방법 3: 직접 ngrok 명령어 사용

```bash
# 기본 (포트 3000)
ngrok http 3000

# 특정 리전 지정 (일본 - 한국과 가까움)
ngrok http 3000 --region jp

# 고정 도메인 사용 (유료 플랜)
ngrok http 3000 --domain=your-domain.ngrok-free.app
```

### ngrok 터널 확인

ngrok이 실행되면 다음과 같은 정보가 표시됩니다:
```
Forwarding  https://xxxx-xxx-xxx-xxx.ngrok-free.app -> http://localhost:3000
```

이 URL을 모바일이나 다른 기기에서 접속하여 테스트할 수 있습니다.

---

## ⚙️ 환경 변수 설정

### .env 파일 생성

```bash
cp .env.example .env
```

### 설정 옵션

```env
# 서버 포트 (기본: 3000)
PORT=3000

# ngrok 자동 시작 (start-server.js 사용 시)
USE_NGROK=false

# ngrok 리전
# jp: 일본 (한국과 가장 가까움, 권장)
# us: 미국
# eu: 유럽
# au: 호주
# ap: 아시아
NGROK_REGION=jp

# 환경
NODE_ENV=development
```

---

## 📱 모바일 테스트

ngrok URL을 사용하여 실제 모바일 기기에서 테스트:

1. 개발 서버 + ngrok 실행
   ```bash
   npm run dev
   npm run ngrok  # 별도 터미널
   ```

2. ngrok이 제공하는 HTTPS URL 확인
   ```
   https://xxxx-xxx-xxx-xxx.ngrok-free.app
   ```

3. 모바일 브라우저에서 해당 URL 접속

---

## 🌐 배포

### Vercel 배포 (권장)

1. **Vercel 설치**
   ```bash
   npm install -g vercel
   ```

2. **배포**
   ```bash
   vercel
   ```

3. **프로덕션 배포**
   ```bash
   vercel --prod
   ```

### 기타 배포 옵션

- **Netlify**: https://docs.netlify.com/integrations/frameworks/next-js/
- **Railway**: https://railway.app
- **Render**: https://render.com
- **Digital Ocean**: https://www.digitalocean.com/products/app-platform

---

## 🔧 트러블슈팅

### ngrok 실행 안됨

**문제**: `ngrok: command not found`

**해결**:
1. ngrok이 설치되어 있는지 확인
2. PATH에 ngrok이 추가되어 있는지 확인
3. 터미널 재시작

### 포트 이미 사용 중

**문제**: `Port 3000 is already in use`

**해결**:
```bash
# 다른 포트 사용
PORT=3001 npm run dev
```

또는 실행 중인 프로세스 종료:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### API 요청 실패

**문제**: 외부에서 접속 시 API 호출 실패

**확인 사항**:
1. CORS 설정 확인
2. API 라우트가 상대 경로로 호출되는지 확인
3. ngrok HTTPS URL 사용 (HTTP는 일부 기능 제한)

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:
- Next.js 공식 문서: https://nextjs.org/docs
- ngrok 공식 문서: https://ngrok.com/docs
- GitHub Issues: (프로젝트 저장소)

---

## 🎯 유용한 명령어 요약

```bash
# 개발 시작
npm run dev

# ngrok 터널 (별도 터미널)
npm run ngrok

# 통합 실행 (개발 서버 + ngrok)
npm run dev:ngrok

# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm run start

# 린트 검사
npm run lint
```
