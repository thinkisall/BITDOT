// lib/rateLimiter.ts
// Rate Limiting 유틸리티

/**
 * 동시 실행 제한
 * @param concurrency 동시 실행 개수
 */
export function createConcurrencyLimiter(concurrency: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    while (running >= concurrency) {
      await new Promise<void>(resolve => queue.push(resolve));
    }

    running++;
    try {
      return await fn();
    } finally {
      running--;
      const resolve = queue.shift();
      if (resolve) resolve();
    }
  };
}

/**
 * 배치 처리
 * @param items 처리할 항목들
 * @param batchSize 배치 크기
 * @param processor 처리 함수
 * @param delayMs 배치 간 지연 (밀리초)
 */
export async function processBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R[]>,
  delayMs = 0
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await processor(batch);
    results.push(...batchResults);

    // 배치 간 지연
    if (delayMs > 0 && i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }

  return results;
}

/**
 * 지연 함수
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 재시도 로직
 * @param fn 실행할 함수
 * @param maxRetries 최대 재시도 횟수
 * @param delayMs 재시도 간 지연
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (i < maxRetries) {
        await sleep(delayMs * (i + 1)); // 지수 백오프
      }
    }
  }

  throw lastError;
}

/**
 * Rate Limiter 클래스
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number // 초당 토큰 수
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  /**
   * 토큰 획득 대기
   */
  async acquire(tokens = 1): Promise<void> {
    this.refill();

    while (this.tokens < tokens) {
      await sleep(100);
      this.refill();
    }

    this.tokens -= tokens;
  }

  /**
   * 토큰 리필
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const tokensToAdd = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// 업비트 API Rate Limiter (초당 10회)
export const upbitLimiter = new RateLimiter(10, 10);

// 빗썸 API Rate Limiter (초당 20회)
export const bithumbLimiter = new RateLimiter(20, 20);
