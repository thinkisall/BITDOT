'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { createCommunityPost } from '@/lib/supabase/community';
import { BarChart2, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';

async function fetchBithumbCoins(): Promise<string[]> {
  const res = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW');
  const json = await res.json();
  if (json.status !== '0000') return [];
  return Object.keys(json.data)
    .filter((s) => s !== 'date')
    .sort();
}

const ANALYSIS_TEMPLATES = [
  { label: '기술적 분석', text: '## 기술적 분석\n\n### 현재 추세\n\n### 주요 지지/저항\n- 저항: \n- 지지: \n\n### 이동평균\n\n### 결론\n' },
  { label: '박스권 분석', text: '## 박스권 분석\n\n### 박스권 범위\n- 상단 저항: \n- 하단 지지: \n\n### 돌파 조건\n\n### 매매 전략\n- 진입가: \n- 손절가: \n- 목표가: \n' },
  { label: '수급 분석', text: '## 수급 분석\n\n### 거래량 동향\n\n### 세력 흔적\n\n### 단기 방향성\n' },
];

export default function CommunityWritePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [coinSymbol, setCoinSymbol] = useState('');
  const [coinInput, setCoinInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allCoins, setAllCoins] = useState<string[]>([]);
  const [coinsLoading, setCoinsLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBithumbCoins()
      .then(setAllCoins)
      .finally(() => setCoinsLoading(false));
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      alert('로그인이 필요합니다.');
      router.push('/community');
    }
  }, [user, loading, router]);

  if (loading || !user) return null;

  const filteredSuggestions = allCoins.filter((c) =>
    coinInput ? c.includes(coinInput.toUpperCase()) : true
  ).slice(0, 60);

  const selectCoin = (coin: string) => {
    setCoinSymbol(coin);
    setCoinInput(coin);
    setShowSuggestions(false);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!coinSymbol) e.coin = '분석할 종목을 선택해주세요';
    if (!title.trim()) e.title = '제목을 입력해주세요';
    if (title.trim().length < 5) e.title = '제목은 5자 이상 입력해주세요';
    if (!content.trim()) e.content = '내용을 입력해주세요';
    if (content.trim().length < 20) e.content = '내용은 20자 이상 입력해주세요';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      setSubmitting(true);
      const postId = await createCommunityPost({
        title: title.trim(),
        content: content.trim(),
        coinSymbol,
        author_id: user.uid,
        author_name: user.displayName || user.email?.split('@')[0] || '익명',
        author_email: user.email || '',
        author_photo_url: user.photoURL || undefined,
      });
      router.push(`/community/${postId}`);
    } catch {
      alert('글 작성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        <div className="mb-6">
          <button
            onClick={() => router.push('/community')}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-4 block"
          >
            ← 커뮤니티로
          </button>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-yellow-400" />
            <h1 className="text-lg sm:text-xl font-bold text-white">코인 분석 작성</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">차트 분석, 매매 전략, 시황 등을 자유롭게 공유하세요</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 종목 선택 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              분석 종목 <span className="text-yellow-400">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={coinInput}
                onChange={(e) => {
                  setCoinInput(e.target.value.toUpperCase());
                  setCoinSymbol(e.target.value.toUpperCase().trim());
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="예: BTC, ETH, ALGO..."
                className={`w-full px-4 py-3 bg-zinc-800 border rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none transition-colors ${
                  errors.coin ? 'border-red-500/50' : 'border-zinc-700 focus:border-yellow-500/50'
                }`}
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />

              {showSuggestions && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                  {coinsLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-zinc-400 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      종목 불러오는 중...
                    </div>
                  ) : filteredSuggestions.length === 0 ? (
                    <div className="py-4 text-center text-xs text-zinc-500">일치하는 종목이 없습니다</div>
                  ) : (
                    <div className="p-2 flex flex-wrap gap-1">
                      {filteredSuggestions.map((coin) => (
                        <button
                          key={coin}
                          type="button"
                          onClick={() => selectCoin(coin)}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-700/60 hover:bg-yellow-500/20 hover:text-yellow-300 text-zinc-300 transition-colors"
                        >
                          {coin}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            {errors.coin && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" /> {errors.coin}
              </p>
            )}
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              제목 <span className="text-yellow-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="분석 제목을 입력하세요"
              maxLength={100}
              className={`w-full px-4 py-3 bg-zinc-800 border rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none transition-colors ${
                errors.title ? 'border-red-500/50' : 'border-zinc-700 focus:border-yellow-500/50'
              }`}
            />
            <div className="flex items-center justify-between mt-1">
              {errors.title ? (
                <p className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="w-3 h-3" /> {errors.title}
                </p>
              ) : <span />}
              <span className="text-[11px] text-zinc-600">{title.length}/100</span>
            </div>
          </div>

          {/* 템플릿 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-zinc-300">
                내용 <span className="text-yellow-400">*</span>
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-zinc-500">템플릿:</span>
                {ANALYSIS_TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setContent(t.text)}
                    className="px-2 py-1 rounded-md bg-zinc-700/60 hover:bg-zinc-600 text-zinc-400 hover:text-zinc-200 text-[11px] transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="차트 분석 내용을 자유롭게 작성하세요&#10;&#10;• 지지/저항 레벨&#10;• 매수/매도 타이밍&#10;• 리스크 관리 방안 등"
              rows={16}
              className={`w-full px-4 py-3 bg-zinc-800 border rounded-xl text-white text-sm placeholder:text-zinc-500 focus:outline-none transition-colors font-mono leading-relaxed resize-none ${
                errors.content ? 'border-red-500/50' : 'border-zinc-700 focus:border-yellow-500/50'
              }`}
            />
            {errors.content && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="w-3 h-3" /> {errors.content}
              </p>
            )}
          </div>

          {/* 제출 */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/community')}
              className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? '게시 중...' : '분석글 게시'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
