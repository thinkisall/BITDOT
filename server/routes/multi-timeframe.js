// server/routes/multi-timeframe.js
// Next.js API를 프록시하는 간단한 라우트
const express = require('express');
const router = express.Router();

// 캐시 (10분 TTL)
let cache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10분

// 분석 중 플래그
let isAnalyzing = false;

router.post('/', async (req, res) => {
  try {
    // 캐시 확인
    const now = Date.now();
    if (cache && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('Returning cached multi-timeframe data');
      return res.json(cache);
    }

    // 캐시 만료 또는 없음
    if (!isAnalyzing) {
      console.log('Starting multi-timeframe analysis in background...');
      isAnalyzing = true;

      // 백그라운드에서 분석 실행 (응답 대기하지 않음)
      performAnalysis().catch(err => {
        console.error('Multi-timeframe analysis error:', err);
        isAnalyzing = false;
      });
    }

    // 기존 캐시 반환 (만료되었어도 분석 완료 전까지 사용)
    if (cache) {
      const cacheAge = Math.floor((now - cacheTimestamp) / 1000);
      console.log(`Returning stale cache (age: ${cacheAge}s), new analysis in progress`);
      return res.json({
        ...cache,
        cached: true,
        stale: true,
        cacheAge,
        analyzing: isAnalyzing,
      });
    }

    // 캐시도 없고 첫 분석 중
    console.log('No cache available, analysis in progress');
    return res.json({
      results: [],
      totalAnalyzed: 0,
      foundCount: 0,
      lastUpdated: 0,
      cached: false,
      analyzing: true,
      message: '분석이 진행 중입니다. 잠시 후 다시 시도해주세요.',
    });
  } catch (error) {
    console.error('Multi-timeframe route error:', error);
    res.status(500).json({
      error: error.message || 'Failed to fetch multi-timeframe data',
      results: [],
      totalAnalyzed: 0,
      foundCount: 0,
    });
  }
});

// 실제 분석 로직 (여기서는 외부 Python 스크립트나 별도 서비스 호출 가능)
async function performAnalysis() {
  try {
    // TODO: 실제 분석 로직 구현
    // 현재는 더미 데이터 반환
    console.log('Analysis started...');

    // 3분 정도 걸리는 무거운 작업 시뮬레이션
    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = {
      results: [],
      totalAnalyzed: 0,
      foundCount: 0,
      lastUpdated: Date.now(),
    };

    cache = result;
    cacheTimestamp = Date.now();
    isAnalyzing = false;

    console.log('Analysis completed and cached');
  } catch (error) {
    console.error('Analysis failed:', error);
    isAnalyzing = false;
    throw error;
  }
}

// 서버 시작 시 첫 분석 실행
console.log('[Multi-timeframe] Starting initial analysis...');
performAnalysis().catch(err => {
  console.error('[Multi-timeframe] Initial analysis failed:', err);
});

// 10분마다 자동 분석
setInterval(() => {
  if (!isAnalyzing) {
    console.log('[Multi-timeframe] Starting scheduled analysis...');
    performAnalysis().catch(err => {
      console.error('[Multi-timeframe] Scheduled analysis failed:', err);
    });
  }
}, CACHE_TTL);

module.exports = router;
