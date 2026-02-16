#!/usr/bin/env node

/**
 * BITDAMOABOM 서버 시작 스크립트
 * Next.js 개발 서버를 시작하고 ngrok 터널을 생성합니다.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const USE_NGROK = process.env.USE_NGROK === 'true';

console.log('🚀 BITDAMOABOM 서버를 시작합니다...\n');

// Next.js 개발 서버 시작
const nextServer = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: PORT.toString() }
});

nextServer.on('error', (error) => {
  console.error('❌ 서버 시작 실패:', error);
  process.exit(1);
});

// ngrok 터널 생성 (옵션)
if (USE_NGROK) {
  console.log('\n🔗 ngrok 터널을 생성 중...');

  // 3초 후 ngrok 시작 (Next.js 서버가 준비될 시간 확보)
  setTimeout(() => {
    const ngrok = spawn('ngrok', ['http', PORT.toString()], {
      stdio: 'inherit',
      shell: true
    });

    ngrok.on('error', (error) => {
      console.error('⚠️  ngrok 실행 실패:', error.message);
      console.log('💡 ngrok이 설치되어 있는지 확인하세요: https://ngrok.com/download');
    });
  }, 3000);
}

// 종료 처리
process.on('SIGINT', () => {
  console.log('\n\n👋 서버를 종료합니다...');
  nextServer.kill();
  process.exit(0);
});

console.log(`
✅ 서버 설정 완료
📍 로컬 주소: http://localhost:${PORT}
${USE_NGROK ? '🌐 ngrok URL은 터미널에서 확인하세요\n' : ''}
💡 Ctrl+C를 눌러 서버를 종료할 수 있습니다.
`);
