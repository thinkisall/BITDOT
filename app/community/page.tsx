'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { getCommunityPosts, CommunityPost } from '@/lib/supabase/community';
import {
  MessageSquare, Eye, TrendingUp, Search, PenSquare,
  ChevronRight, BarChart2, Filter, X, Clock, Flame
} from 'lucide-react';

const QUICK_FILTER_COINS = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA', 'AVAX', 'LINK', 'DOT', 'MATIC'];
const PAGE_SIZE = 20;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}시간 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function CoinBadge({ symbol, size = 'sm' }: { symbol: string; size?: 'sm' | 'md' }) {
  const colors: Record<string, string> = {
    BTC: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    ETH: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    XRP: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    SOL: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    DOGE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  };
  const cls = colors[symbol] || 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40';
  const sz = size === 'md' ? 'px-2.5 py-1 text-xs font-bold' : 'px-2 py-0.5 text-[11px] font-semibold';
  return (
    <span className={`inline-flex items-center border rounded-md ${cls} ${sz}`}>
      {symbol}
    </span>
  );
}

function PostCard({ post, onClick }: { post: CommunityPost; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="group bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 sm:p-5 cursor-pointer transition-all hover:bg-zinc-800/60"
    >
      <div className="flex items-start gap-3">
        {/* 좌측: 코인 배지 */}
        <div className="shrink-0 mt-0.5">
          <CoinBadge symbol={post.coinSymbol} size="md" />
        </div>

        {/* 본문 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-semibold text-white text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-yellow-300 transition-colors">
              {post.title}
            </h3>
            <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0 mt-0.5 transition-colors" />
          </div>

          {post.bodyContent && (
            <p className="text-xs text-zinc-500 line-clamp-2 mb-3 leading-relaxed">
              {post.bodyContent.replace(/\n/g, ' ')}
            </p>
          )}

          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
            <span className="font-medium text-zinc-400">{post.author_name}</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(post.created_at)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {post.comment_count}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CommunityPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [coinFilter, setCoinFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular'>('latest');

  const loadPosts = useCallback(async (reset = true, coin?: string) => {
    try {
      setLoading(true);
      const currentOffset = reset ? 0 : offset;
      const result = await getCommunityPosts(PAGE_SIZE, currentOffset, coin);
      if (reset) {
        setPosts(result.posts);
        setOffset(PAGE_SIZE);
      } else {
        setPosts((prev) => [...prev, ...result.posts]);
        setOffset((prev) => prev + PAGE_SIZE);
      }
      setHasMore(result.hasMore);
    } catch {
      alert('게시글을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [offset]);

  useEffect(() => {
    loadPosts(true, coinFilter || undefined);
  }, [coinFilter]);

  const handleCoinFilter = (coin: string) => {
    setCoinFilter((prev) => (prev === coin ? '' : coin));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCoinFilter(searchInput.trim().toUpperCase());
  };

  const displayPosts = sortBy === 'popular'
    ? [...posts].sort((a, b) => (b.view_count + b.comment_count * 3) - (a.view_count + a.comment_count * 3))
    : posts;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-yellow-400" />
              <h1 className="text-lg sm:text-2xl font-bold text-white">코인 분석 커뮤니티</h1>
            </div>
            {user && (
              <button
                onClick={() => router.push('/community/write')}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold transition-colors text-xs sm:text-sm"
              >
                <PenSquare className="w-3.5 h-3.5" />
                분석 작성
              </button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-zinc-400">
            종목별 차트 분석과 투자 인사이트를 공유하세요
          </p>
        </div>

        {/* 코인 필터 */}
        <div className="mb-4 space-y-3">
          {/* 인기 코인 빠른 필터 */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            {QUICK_FILTER_COINS.map((coin) => (
              <button
                key={coin}
                onClick={() => handleCoinFilter(coin)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  coinFilter === coin
                    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                    : 'bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                }`}
              >
                {coin}
              </button>
            ))}
          </div>

          {/* 직접 검색 + 정렬 */}
          <div className="flex items-center gap-2">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value.toUpperCase())}
                  placeholder="종목 검색 (예: ALGO)"
                  className="w-full pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-500/50"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-200 transition-colors"
              >
                검색
              </button>
            </form>

            {coinFilter && (
              <button
                onClick={() => { setCoinFilter(''); setSearchInput(''); }}
                className="flex items-center gap-1 px-2.5 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs hover:bg-yellow-500/20 transition-colors"
              >
                <X className="w-3 h-3" />
                {coinFilter} 해제
              </button>
            )}

            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setSortBy('latest')}
                className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  sortBy === 'latest'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Clock className="w-3 h-3" />
                최신
              </button>
              <button
                onClick={() => setSortBy('popular')}
                className={`flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs transition-colors ${
                  sortBy === 'popular'
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Flame className="w-3 h-3" />
                인기
              </button>
            </div>
          </div>
        </div>

        {/* 현재 필터 표시 */}
        {coinFilter && (
          <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
            <TrendingUp className="w-3.5 h-3.5 text-yellow-400" />
            <span><span className="text-yellow-300 font-bold">{coinFilter}</span> 분석글 {posts.length}개</span>
          </div>
        )}

        {/* 게시글 목록 */}
        {loading && posts.length === 0 ? (
          <div className="space-y-3">
            {Array(5).fill(null).map((_, i) => (
              <div key={i} className="h-24 bg-zinc-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : displayPosts.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">
            <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium mb-1">
              {coinFilter ? `${coinFilter} 분석글이 없습니다` : '아직 게시글이 없습니다'}
            </p>
            <p className="text-xs text-zinc-600">
              첫 번째 분석을 작성해보세요
            </p>
            {user && (
              <button
                onClick={() => router.push('/community/write')}
                className="mt-4 px-4 py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-sm font-semibold hover:bg-yellow-500/25 transition-colors"
              >
                분석 작성하기
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {displayPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onClick={() => router.push(`/community/${post.id}`)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-5 text-center">
                <button
                  onClick={() => loadPosts(false, coinFilter || undefined)}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors disabled:opacity-50 text-sm"
                >
                  {loading ? '로딩 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}

        {!user && (
          <div className="mt-6 p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 text-center">
            <p className="text-sm text-zinc-400 mb-3">로그인하면 분석글을 작성할 수 있습니다</p>
            <button
              onClick={() => router.push('/auth/login')}
              className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors"
            >
              로그인
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
