// server/index.js
// 백엔드 API 서버 (Express)

const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// 미들웨어
app.use(cors());
app.use(express.json());

// 로깅 미들웨어
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// 라우트 임포트
const scanRouter = require('./routes/scan');
const chartRouter = require('./routes/chart');
const fundingRouter = require('./routes/funding');

// API 라우트 등록
app.use('/api/scan', scanRouter);
app.use('/api/chart', chartRouter);
app.use('/api/funding', fundingRouter);

// 헬스체크
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 루트 경로
app.get('/', (req, res) => {
  res.json({
    name: 'BITDAMOABOM Backend API',
    version: '1.0.0',
    endpoints: [
      'POST /api/scan - 박스권 스캔',
      'GET /api/chart?symbol=BTC&exchange=upbit - 차트 데이터',
      'GET /api/funding - 펀딩비 데이터',
      'GET /health - 서버 상태',
    ],
  });
});

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════╗
║   BITDAMOABOM Backend API Server      ║
╠═══════════════════════════════════════╣
║  포트: ${PORT}                          ║
║  URL: http://localhost:${PORT}         ║
║  상태: http://localhost:${PORT}/health  ║
╚═══════════════════════════════════════╝

[✓] 서버가 실행 중입니다.
[i] Ctrl+C를 눌러 종료할 수 있습니다.
  `);
});

module.exports = app;
