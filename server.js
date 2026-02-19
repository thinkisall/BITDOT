const express = require('express');
const cors    = require('cors');
const path    = require('path');
const multer  = require('multer');
const fs      = require('fs');

const app  = express();
const PORT = 3002;

// ── Ollama 설정 ─────────────────────────────────────────
const OLLAMA_URL = 'http://localhost:11434';
const MODEL_NAME = 'bitdot-ai';

// ── 파일 업로드 설정 ────────────────────────────────────
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.txt','.js','.ts','.jsx','.tsx','.py','.java',
                        '.html','.css','.json','.md','.csv','.xml','.go',
                        '.rs','.c','.cpp','.h','.php','.rb','.sh','.yaml','.yml'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) cb(null, true);
    else cb(new Error('지원하지 않는 파일 형식'));
  }
});

app.use(cors());
app.use(express.json({ limit: '5mb' }));

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ── 한국어 시스템 프롬프트 ───────────────────────────────
const SYSTEM_PROMPT = `당신은 한국어 AI 어시스턴트 "Bitdot AI"입니다.
반드시 한국어로만 답변하세요. 절대 영어로 답변하지 마세요.
코드 분석, 문서 요약, 질문 답변 등 모든 작업을 한국어로 수행합니다.
코드 블록은 마크다운 형식(\`\`\`언어명)으로 작성하세요.`;

// ── 공통 스트리밍 함수 ───────────────────────────────────
async function streamOllama(messages, res) {
  const fullMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: fullMessages,
      stream: true,
      options: { temperature: 0.7, num_ctx: 4096 }
    })
  });

  if (!response.ok) throw new Error(`Ollama 오류: ${await response.text()}`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const lines = decoder.decode(value, { stream: true }).split('\n').filter(l => l.trim());
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        if (data.message?.content) res.write(`data: ${JSON.stringify({ content: data.message.content })}\n\n`);
        if (data.done) { res.write(`data: ${JSON.stringify({ done: true })}\n\n`); res.end(); return; }
      } catch {}
    }
  }
  res.end();
}

// ── 일반 채팅 ────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages?.length) return res.status(400).json({ error: '메시지가 없습니다.' });
  try { await streamOllama(messages, res); }
  catch (err) { if (!res.headersSent) res.status(500).json({ error: err.message }); }
});

// ── 파일 AI 분석 ─────────────────────────────────────────
app.post('/api/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const { analysisType = 'general', extraPrompt = '' } = req.body;
  const fileName = req.file.originalname;
  const ext      = path.extname(fileName).toLowerCase().slice(1);

  try {
    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const maxLen = 6000;
    const content = fileContent.length > maxLen
      ? fileContent.slice(0, maxLen) + '\n\n...(이하 생략)'
      : fileContent;

    const prompts = {
      general:  `파일 "${fileName}"을 분석하고 한국어로 설명해주세요:\n\n\`\`\`${ext}\n${content}\n\`\`\``,
      code:     `코드 "${fileName}"을 분석해주세요. 기능 설명, 문제점, 개선방안을 한국어로 알려주세요:\n\n\`\`\`${ext}\n${content}\n\`\`\``,
      security: `코드 "${fileName}"의 보안 취약점을 한국어로 분석해주세요. 위험도와 해결방법도 제시해주세요:\n\n\`\`\`${ext}\n${content}\n\`\`\``,
      summary:  `파일 "${fileName}"의 핵심 내용을 한국어로 간결하게 요약해주세요:\n\n${content}`,
      review:   `코드 "${fileName}"을 코드 리뷰해주세요. 가독성, 성능, 유지보수성 관점에서 한국어로 평가해주세요:\n\n\`\`\`${ext}\n${content}\n\`\`\``,
    };

    let prompt = prompts[analysisType] || prompts.general;
    if (extraPrompt) prompt += `\n\n추가 요청: ${extraPrompt}`;

    await streamOllama([{ role: 'user', content: prompt }], res);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
});

// ── 서버 상태 ────────────────────────────────────────────
app.get('/api/status', async (req, res) => {
  try {
    const data   = await (await fetch(`${OLLAMA_URL}/api/tags`)).json();
    const models = data.models?.map(m => m.name) || [];
    res.json({ status: 'ok', models, current: MODEL_NAME });
  } catch {
    res.status(500).json({ status: 'error', message: 'Ollama에 연결할 수 없습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Bitdot AI: http://localhost:${PORT}`);
  console.log(`🤖 모델: ${MODEL_NAME}`);
});
