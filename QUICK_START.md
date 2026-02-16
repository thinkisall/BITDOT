# 🚀 빠른 시작 가이드

## 개발 서버만 실행 (로컬 테스트)

### 방법 1: npm 명령어
```bash
npm run dev
```

### 방법 2: 배치 파일 (Windows)
```bash
start-dev.bat
```

→ 브라우저에서 http://localhost:3000 접속

---

## 외부 접속 가능하게 하기 (모바일 테스트)

### 1단계: 개발 서버 실행

**터미널 1** 또는 **배치 파일**로 서버 실행:
```bash
npm run dev
```
또는
```bash
start-dev.bat
```

### 2단계: ngrok 터널 생성

**새로운 터미널 2** 또는 **배치 파일**로 ngrok 실행:
```bash
npm run ngrok
```
또는
```bash
start-ngrok.bat
```

### 3단계: URL 확인

ngrok 터미널에 다음과 같이 표시됩니다:
```
Forwarding  https://1234-56-78-90.ngrok-free.app -> http://localhost:3000
```

이 HTTPS URL을 모바일이나 다른 기기에서 접속!

---

## ⚠️ ngrok 첫 사용 시 필수 설정

1. **ngrok 다운로드**
   https://ngrok.com/download

2. **계정 생성 및 인증**
   ```bash
   ngrok config add-authtoken <YOUR_TOKEN>
   ```
   Token은 여기서 확인: https://dashboard.ngrok.com/get-started/your-authtoken

---

## 💡 팁

- **두 터미널 필요**: 하나는 Next.js 서버, 하나는 ngrok
- **한 번만 설정**: ngrok authtoken은 한 번만 설정하면 됨
- **무료 사용 가능**: ngrok 무료 플랜으로도 충분히 사용 가능
- **HTTPS 자동**: ngrok이 자동으로 HTTPS URL 제공

---

## 📱 모바일에서 테스트하는 방법

1. PC에서 개발 서버 + ngrok 실행
2. ngrok URL 복사 (예: `https://xxxx.ngrok-free.app`)
3. 모바일 브라우저에서 해당 URL 접속
4. 실시간으로 코드 수정하면 모바일에서도 바로 반영됨!

---

## 🔗 자세한 가이드

더 자세한 내용은 [SERVER_GUIDE.md](./SERVER_GUIDE.md) 참고
