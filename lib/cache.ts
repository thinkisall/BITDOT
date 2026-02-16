// lib/cache.ts
// 간단한 메모리 캐시 시스템

interface CacheItem<T> {
  data: T;
  expires: number;
}

class SimpleCache {
  private cache = new Map<string, CacheItem<any>>();

  /**
   * 캐시에서 데이터 가져오기
   * @param key 캐시 키
   * @returns 캐시된 데이터 또는 null (만료/없음)
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    // 만료 확인
    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.data as T;
  }

  /**
   * 캐시에 데이터 저장
   * @param key 캐시 키
   * @param data 저장할 데이터
   * @param ttlMinutes 유효 시간 (분)
   */
  set<T>(key: string, data: T, ttlMinutes = 5): void {
    this.cache.set(key, {
      data,
      expires: Date.now() + ttlMinutes * 60 * 1000,
    });
  }

  /**
   * 특정 키 삭제
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 모든 캐시 삭제
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 캐시 통계
   */
  stats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * 만료된 항목 정리 (선택적)
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// 싱글톤 인스턴스
export const cache = new SimpleCache();

// 정기적으로 만료된 캐시 정리 (5분마다)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cleaned = cache.cleanup();
    if (cleaned > 0) {
      console.log(`[Cache] Cleaned ${cleaned} expired items`);
    }
  }, 5 * 60 * 1000);
}
