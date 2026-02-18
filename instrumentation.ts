// instrumentation.ts
// Next.js 서버 시작 시 한 번 실행됨 — 백그라운드 분석 워커 자동 시작
export async function register() {
  // Node.js 런타임에서만 실행 (Edge Runtime 제외)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundWorker } = await import('./app/api/multi-timeframe/route');
    startBackgroundWorker();
  }
}
