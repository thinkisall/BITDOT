'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Header from '../components/Header';

const OLLAMA_SERVER = 'http://localhost:3002';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
}

interface ServerStatus {
  status: 'ok' | 'error' | 'checking';
  models?: string[];
  current?: string;
  message?: string;
}

const ANALYSIS_TYPES = [
  { value: 'general',  label: '일반 분석' },
  { value: 'code',     label: '코드 분석' },
  { value: 'security', label: '보안 검사' },
  { value: 'summary',  label: '요약' },
  { value: 'review',   label: '코드 리뷰' },
];

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus>({ status: 'checking' });

  // File analysis state
  const [tab, setTab] = useState<'chat' | 'file'>('chat');
  const [file, setFile] = useState<File | null>(null);
  const [analysisType, setAnalysisType] = useState('general');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [fileResult, setFileResult] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 서버 상태 확인
  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch(`${OLLAMA_SERVER}/api/status`);
      const data = await res.json();
      setServerStatus(data);
    } catch {
      setServerStatus({ status: 'error', message: 'Ollama 서버에 연결할 수 없습니다.' });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 채팅 전송
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const newMessages: Message[] = [...messages, { role: 'user', content: text }];
    setMessages([...newMessages, { role: 'assistant', content: '', pending: true }]);
    setInput('');
    setIsStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${OLLAMA_SERVER}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantText += data.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantText };
                return updated;
              });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `오류가 발생했습니다: ${err.message}\n\nOllama 서버(localhost:3002)가 실행 중인지 확인해주세요.`,
          };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const clearChat = () => {
    if (isStreaming) stopStreaming();
    setMessages([]);
  };

  // 파일 분석
  const analyzeFile = async () => {
    if (!file || isAnalyzing) return;

    setIsAnalyzing(true);
    setFileResult('');

    abortRef.current = new AbortController();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('analysisType', analysisType);
    formData.append('extraPrompt', extraPrompt);

    try {
      const res = await fetch(`${OLLAMA_SERVER}/api/analyze`, {
        method: 'POST',
        body: formData,
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`서버 오류: ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let resultText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              resultText += data.content;
              setFileResult(resultText);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setFileResult(`오류: ${err.message}`);
      }
    } finally {
      setIsAnalyzing(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 마크다운 코드블록 간단 렌더링
  const renderContent = (text: string) => {
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```')) {
        const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
        const lang = match?.[1] || '';
        const code = match?.[2] || part.slice(3, -3);
        return (
          <pre key={i} className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 mt-2 mb-2 overflow-x-auto text-xs text-zinc-200 font-mono">
            {lang && <div className="text-zinc-500 text-[10px] mb-1">{lang}</div>}
            <code>{code}</code>
          </pre>
        );
      }
      return <span key={i} className="whitespace-pre-wrap">{part}</span>;
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 max-w-4xl flex flex-col">

        {/* 상단 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">AI</span> Bitdot AI 어시스턴트
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">deepseek-r1-ko · 로컬 Ollama 연동</p>
          </div>

          {/* 서버 상태 */}
          <div className="flex items-center gap-2">
            <button
              onClick={checkStatus}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              title="상태 새로고침"
            >
              새로고침
            </button>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${
              serverStatus.status === 'ok'
                ? 'border-green-500/30 bg-green-500/10 text-green-400'
                : serverStatus.status === 'checking'
                ? 'border-zinc-600 bg-zinc-800 text-zinc-400'
                : 'border-red-500/30 bg-red-500/10 text-red-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                serverStatus.status === 'ok' ? 'bg-green-400 animate-pulse' :
                serverStatus.status === 'checking' ? 'bg-zinc-500' : 'bg-red-400'
              }`} />
              {serverStatus.status === 'ok' ? '연결됨' :
               serverStatus.status === 'checking' ? '확인 중' : '연결 안됨'}
            </div>
          </div>
        </div>

        {/* 서버 오류 배너 */}
        {serverStatus.status === 'error' && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
            Ollama 서버(localhost:3002)에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-1 mb-4 p-1 bg-zinc-900 rounded-lg border border-zinc-800 w-fit">
          <button
            onClick={() => setTab('chat')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'chat'
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            채팅
          </button>
          <button
            onClick={() => setTab('file')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'file'
                ? 'bg-purple-600 text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            파일 분석
          </button>
        </div>

        {/* ── 채팅 탭 ── */}
        {tab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-3 space-y-4 min-h-[400px] max-h-[60vh]">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm font-medium">Bitdot AI와 대화를 시작하세요</p>
                    <p className="text-zinc-600 text-xs mt-1">코드 분석, 시장 분석, 질문 답변 등 무엇이든 물어보세요</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-sm mt-2">
                    {[
                      '비트코인 시장 분석해줘',
                      '이 코드의 문제점을 찾아줘',
                      '암호화폐 투자 전략 추천해줘',
                      '박스권 돌파 패턴 설명해줘',
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        className="text-left px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/10 text-xs text-zinc-400 hover:text-zinc-200 transition-all"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs text-purple-400 font-bold">AI</span>
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-200'
                    }`}>
                      {msg.pending && !msg.content ? (
                        <div className="flex gap-1 items-center py-1">
                          <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      ) : (
                        renderContent(msg.content)
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-zinc-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 입력 영역 */}
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
                    rows={2}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 resize-none outline-none transition-colors"
                    disabled={isStreaming}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  {isStreaming ? (
                    <button
                      onClick={stopStreaming}
                      className="px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      중지
                    </button>
                  ) : (
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim() || serverStatus.status !== 'ok'}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-colors"
                    >
                      전송
                    </button>
                  )}
                  {messages.length > 0 && (
                    <button
                      onClick={clearChat}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl text-xs transition-colors"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 text-center">
                Enter: 전송 · Shift+Enter: 줄바꿈 · 로컬 AI (데이터 외부 전송 없음)
              </p>
            </div>
          </div>
        )}

        {/* ── 파일 분석 탭 ── */}
        {tab === 'file' && (
          <div className="flex flex-col gap-4">
            {/* 파일 업로드 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-sm font-semibold text-white mb-3">파일 업로드</h2>
              <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors ${
                file ? 'border-purple-500/50 bg-purple-500/5' : 'border-zinc-700 hover:border-zinc-600'
              }`}>
                <input
                  type="file"
                  className="hidden"
                  accept=".txt,.js,.ts,.jsx,.tsx,.py,.java,.html,.css,.json,.md,.csv,.xml,.go,.rs,.c,.cpp,.h,.php,.rb,.sh,.yaml,.yml"
                  onChange={e => {
                    setFile(e.target.files?.[0] || null);
                    setFileResult('');
                  }}
                />
                {file ? (
                  <>
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm text-purple-300 font-medium">{file.name}</span>
                    <span className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB · 클릭하여 변경</span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-sm text-zinc-400">파일을 클릭하거나 드래그하여 업로드</span>
                    <span className="text-xs text-zinc-600">지원: .txt .js .ts .py .json .md 등 (최대 10MB)</span>
                  </>
                )}
              </label>
            </div>

            {/* 분석 옵션 */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-sm font-semibold text-white mb-3">분석 옵션</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {ANALYSIS_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setAnalysisType(t.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      analysisType === t.value
                        ? 'border-purple-500 bg-purple-600 text-white'
                        : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={extraPrompt}
                onChange={e => setExtraPrompt(e.target.value)}
                placeholder="추가 요청사항 (선택) — 예: 특히 메모리 누수를 중점 분석해줘"
                className="w-full bg-zinc-800 border border-zinc-700 focus:border-purple-500 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none transition-colors"
              />
            </div>

            {/* 분석 버튼 */}
            <button
              onClick={analyzeFile}
              disabled={!file || isAnalyzing || serverStatus.status !== 'ok'}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-sm"
            >
              {isAnalyzing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  분석 중...
                </span>
              ) : 'AI 분석 시작'}
            </button>

            {/* 분석 결과 */}
            {fileResult && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-white">분석 결과</h2>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(fileResult);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    복사
                  </button>
                </div>
                <div className="text-sm text-zinc-300 leading-relaxed">
                  {renderContent(fileResult)}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
