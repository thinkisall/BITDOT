# 💰 서버 비용 및 최적화 분석

## 📊 현재 시스템 분석

### 1. 비용이 많이 드는 부분 (우선순위별)

#### 🔴 **HIGH COST: `/api/scan` (박스권 스캐너)**

**문제점:**
- **300개 종목 × 3개 타임프레임 = 900번의 외부 API 호출**
- 업비트 API: 300개 종목 × 3회 = 900회
- 빗썸 API: 300개 종목 × 3회 = 900회
- **총 1,800회의 API 호출**을 매 스캔마다 실행

**리소스 사용:**
```
메모리: ~500MB (300종목 × 250개 캔들 × 3타임프레임)
CPU: 고사양 (복잡한 지지/저항 계산)
시간: 30초~2분 (네트워크 속도에 따라)
비용: 외부 API Rate Limit 위험
```

**코드 위치:**
- `app/api/scan/route.ts` (라인 72-142)
- `lib/supportResistance.ts` (전체)

#### 🟡 **MEDIUM COST: `/api/chart` (차트 데이터)**

**문제점:**
- 종목 클릭할 때마다 250개 캔들 + SMA 계산
- 캐싱 없이 매번 새로 fetch

**리소스 사용:**
```
메모리: ~10MB per 요청
CPU: 중간 (SMA 계산)
시간: 1~3초
```

---

## 🚨 현재 시스템의 위험 요소

### 1. **API Rate Limiting**
```
업비트: 초당 10회 제한
빗썸: 초당 20회 제한
→ 현재: 동시에 300개 요청 = 즉시 차단 위험!
```

### 2. **메모리 오버플로우**
- 300개 종목의 캔들 데이터 동시 로딩
- ngrok 무료 플랜: 메모리 제한 가능

### 3. **느린 응답 시간**
- 사용자가 스캔 버튼 누르면 1~2분 대기
- ngrok 터널 레이턴시 추가

### 4. **중복 계산**
- 같은 데이터를 매번 새로 계산
- 캐싱 없음

---

## ✅ 해결 방안 (비용 절감 전략)

### 방법 1: **캐싱 시스템 도입** (가장 효과적)

#### 메모리 캐시 (간단한 방법)
```typescript
// lib/cache.ts
const cache = new Map<string, { data: any; expires: number }>();

export function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

export function setCache<T>(key: string, data: T, ttlMinutes = 5) {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMinutes * 60 * 1000,
  });
}
```

**효과:**
- API 호출 90% 감소
- 응답 속도 10배 향상
- 비용: 0원 (메모리만 사용)

#### Redis 캐시 (프로덕션 추천)
```bash
# 무료 Redis 옵션
- Upstash: 10,000 요청/day 무료
- Redis Cloud: 30MB 무료
```

**효과:**
- 서버 재시작해도 캐시 유지
- 여러 서버 인스턴스 공유 가능

---

### 방법 2: **Rate Limiting & 배치 처리**

#### 동시 요청 제한
```typescript
// lib/rateLimiter.ts
import pLimit from 'p-limit';

// 동시에 최대 5개만 처리
const limit = pLimit(5);

// 사용
const results = await Promise.all(
  coins.map(coin => limit(() => fetchCoinData(coin)))
);
```

**효과:**
- API 차단 위험 제거
- 안정적인 서비스

---

### 방법 3: **백그라운드 작업 (Background Jobs)**

#### 정기 스캔 + 결과 캐싱
```typescript
// lib/backgroundScanner.ts
// 5분마다 자동으로 스캔하고 결과를 캐싱
setInterval(async () => {
  const results = await performScan();
  setCache('scan-results', results, 5);
}, 5 * 60 * 1000);
```

**효과:**
- 사용자 요청 즉시 응답 (캐시에서)
- 서버 부하 분산

---

### 방법 4: **데이터베이스 도입**

#### 무료 옵션
```
- Supabase: 500MB 무료
- PlanetScale: 5GB 무료
- MongoDB Atlas: 512MB 무료
```

**사용 방법:**
- 캔들 데이터 저장
- 스캔 결과 저장
- 과거 데이터 조회

---

### 방법 5: **서버리스 배포** (최고 추천!)

#### Vercel (Next.js 최적화)
```bash
# 배포 명령어
vercel

# 무료 플랜:
- 100GB 대역폭/월
- 서버리스 함수: 100GB-Hrs/월
- 자동 스케일링
```

**장점:**
- ngrok 불필요
- HTTPS 자동
- 글로벌 CDN
- 무료!

**설정:**
```json
// vercel.json
{
  "functions": {
    "app/api/scan/route.ts": {
      "maxDuration": 60
    }
  }
}
```

---

## 💡 추천 솔루션 (단계별)

### 🏆 **즉시 적용 가능 (무료)**

**1단계: 메모리 캐싱 추가**
```typescript
// app/api/scan/route.ts에 추가
const CACHE_KEY = 'scan-results';
const CACHE_TTL = 5; // 5분

export async function POST() {
  // 캐시 확인
  const cached = getCached(CACHE_KEY);
  if (cached) {
    return Response.json(cached);
  }

  // 스캔 실행
  const results = await performScan();

  // 캐시 저장
  setCache(CACHE_KEY, results, CACHE_TTL);

  return Response.json(results);
}
```

**2단계: Rate Limiting**
```bash
npm install p-limit
```

**효과:**
- 구현 시간: 30분
- 비용 절감: 90%
- 속도 향상: 10배

---

### 🌟 **프로덕션 배포 (무료)**

**Vercel 배포**
```bash
# 1. Vercel 설치
npm i -g vercel

# 2. 배포
vercel

# 3. 프로덕션
vercel --prod
```

**비용:**
```
무료 플랜 한도:
- 트래픽: 100GB/월 (충분)
- 함수 실행: 100 GB-Hrs/월
- 빌드: 6,000분/월

→ 소규모~중규모 서비스 충분
```

---

### 💎 **대규모 확장 (유료)**

**옵션 1: Vercel Pro**
- $20/월
- 1,000 GB-Hrs 함수 실행
- 무제한 대역폭

**옵션 2: Railway**
- $5/월부터
- 512MB RAM 서버
- Postgres DB 포함

**옵션 3: DigitalOcean App Platform**
- $5/월부터
- 1GB RAM 서버

---

## 📈 비용 예상 (월간)

### 현재 시스템 (ngrok + 로컬)
```
전기세: ~₩5,000
인터넷: 기존 비용
ngrok Pro (필요시): $8/월 (₩11,000)

총: ₩5,000~16,000/월
```

### Vercel 무료
```
비용: ₩0
제한: 100GB 트래픽/월
→ 일 3만 페이지뷰 정도 가능
```

### Vercel Pro (대규모)
```
비용: ₩27,000/월 ($20)
무제한 트래픽
더 빠른 빌드
```

---

## 🎯 최종 추천

### 개발/테스트 단계
1. **로컬 + ngrok**: 현재 방식 유지
2. **메모리 캐싱 추가**: 즉시 성능 향상

### 프로덕션 배포
1. **Vercel 무료 플랜**: 가장 추천
   - 비용: 0원
   - 설정: 5분
   - 성능: 우수

2. **캐싱 전략**:
   - 스캔 결과: 5분 캐싱
   - 차트 데이터: 1분 캐싱

3. **필요시 업그레이드**:
   - 트래픽 증가 → Vercel Pro
   - 복잡한 작업 → Railway/DigitalOcean

---

## 📝 다음 단계

### 즉시 실행할 것
1. [ ] 메모리 캐싱 구현
2. [ ] Rate Limiting 추가
3. [ ] Vercel 배포 테스트

### 나중에 고려할 것
1. [ ] Redis 캐시 도입
2. [ ] 데이터베이스 추가
3. [ ] 백그라운드 스캔 작업
4. [ ] 사용자 인증 추가

---

## 🔗 유용한 링크

- **Vercel 문서**: https://vercel.com/docs
- **Upstash Redis**: https://upstash.com (무료 Redis)
- **Railway**: https://railway.app
- **PlanetScale**: https://planetscale.com (무료 DB)

---

**요약: ngrok은 개발용으로만 사용하고, Vercel 무료 플랜으로 배포하는 것이 가장 경제적이고 효율적입니다!** 🚀
