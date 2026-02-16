#!/usr/bin/env node

/**
 * ngrok 터널 생성 스크립트
 * 이미 실행 중인 Next.js 서버에 ngrok 터널을 연결합니다.
 */

const { spawn } = require('child_process');

const PORT = process.env.PORT || 3000;
const REGION = process.env.NGROK_REGION || 'jp'; // 일본 리전 (한국과 가장 가까움)

console.log(`
🔗 ngrok 터널 생성 중...
📍 대상 포트: ${PORT}
🌏 리전: ${REGION}
`);

const args = ['http', PORT.toString()];

// 리전 설정
if (REGION) {
  args.push('--region', REGION);
}

const ngrok = spawn('ngrok', args, {
  stdio: 'inherit',
  shell: true
});

ngrok.on('error', (error) => {
  console.error('❌ ngrok 실행 실패:', error.message);
  console.log('\n💡 해결 방법:');
  console.log('1. ngrok 설치: https://ngrok.com/download');
  console.log('2. 설치 후 PATH에 추가되었는지 확인');
  console.log('3. ngrok 계정 설정: ngrok config add-authtoken <YOUR_TOKEN>');
  process.exit(1);
});

ngrok.on('close', (code) => {
  console.log(`\n👋 ngrok 터널 종료 (코드: ${code})`);
  process.exit(code);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 터널을 종료합니다...');
  ngrok.kill();
  process.exit(0);
});
