// server/routes/multi-timeframe.js
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
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

    // 캐시 만료 또는 없음 - 백그라운드에서 분석 시작
    if (!isAnalyzing) {
      console.log('Starting multi-timeframe analysis in background...');
      isAnalyzing = true;

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
        stale: cacheAge > CACHE_TTL / 1000,
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

// Python 스크립트 호출 함수
async function performAnalysis() {
  try {
    console.log('[Multi-timeframe] Analysis started...');

    const scriptPath = path.join(__dirname, '../scripts/multi_timeframe_analysis.py');

    // Python 스크립트 실행
    const result = await runPythonScript(scriptPath);

    cache = {
      results: result.results || [],
      totalAnalyzed: result.totalAnalyzed || 0,
      foundCount: result.foundCount || 0,
      lastUpdated: Date.now(),
    };
    cacheTimestamp = Date.now();
    isAnalyzing = false;

    console.log(`[Multi-timeframe] Analysis completed: ${cache.foundCount} results found`);
  } catch (error) {
    console.error('[Multi-timeframe] Analysis failed:', error);
    isAnalyzing = false;
    throw error;
  }
}

// Python 스크립트 실행 헬퍼
function runPythonScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [scriptPath]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python script exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e.message}`));
      }
    });

    python.on('error', (error) => {
      reject(new Error(`Failed to start Python script: ${error.message}`));
    });
  });
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
