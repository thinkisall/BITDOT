'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/app/components/Header';
import CommentList from '@/app/components/board/CommentList';
import { useAuth } from '@/contexts/AuthContext';
import { getCommunityPostById, CommunityPost } from '@/lib/supabase/community';
import { incrementViewCount } from '@/lib/supabase/posts';
import {
  Eye, MessageSquare, Clock, ArrowLeft, Trash2,
  BarChart2, TrendingUp
} from 'lucide-react';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function CoinBadge({ symbol }: { symbol: string }) {
  const colors: Record<string, string> = {
    BTC: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    ETH: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    XRP: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    SOL: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    DOGE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  };
  const cls = colors[symbol] || 'bg-zinc-700/60 text-zinc-300 border-zinc-600/40';
  return (
    <span className={`inline-flex items-center gap-1.5 border rounded-lg px-3 py-1 text-sm font-bold ${cls}`}>
      <TrendingUp className="w-3.5 h-3.5" />
      {symbol}
    </span>
  );
}

// 마크다운 스타일 간단 렌더링 (## 헤더, - 리스트)
function ContentRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="text-zinc-300 text-sm leading-relaxed space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-base font-bold text-white mt-5 mb-2 border-b border-zinc-800 pb-1">
              {line.slice(3)}
            </h2>
          );
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-sm font-semibold text-yellow-300/80 mt-3 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-2 pl-2">
              <span className="text-zinc-500 flex-shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line === '') return <div key={i} className="h-2" />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}

export default function CommunityPostPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const postId = params.id as string;

  useEffect(() => {
    if (!postId) return;
    loadPost();
  }, [postId]);

  const loadPost = async () => {
    try {
      setLoading(true);
      const data = await getCommunityPostById(postId);
      if (!data) {
        alert('게시글을 찾을 수 없습니다.');
        router.push('/community');
        return;
      }
      setPost(data);
      incrementViewCount(postId).catch(() => {});
    } catch {
      alert('게시글을 불러오는데 실패했습니다.');
      router.push('/community');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!post || !user) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      setDeleting(true);
      setConfirmDelete(false);
      const headers: Record<string, string> = { 'x-user-uid': user.uid };
      if (user.email) headers['x-user-email'] = user.email;
      const res = await fetch(`/api/community-delete?postId=${post.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '삭제에 실패했습니다.');
      }
      router.push('/community');
    } catch (err) {
      console.error('Delete error:', err);
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!post) return null;

  const ADMIN_EMAILS = ['thinkisall@gmail.com', 'bitdamoabom@gmail.com'];
  const isAdmin = !authLoading && !!user && ADMIN_EMAILS.includes(user.email || '');
  const isAuthor = !authLoading && !!user && user.uid === post.author_id;
  const canDelete = isAuthor || isAdmin;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-3xl">
        {/* 뒤로가기 */}
        <button
          onClick={() => router.push('/community')}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors mb-5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          커뮤니티로
        </button>

        {/* 게시글 본문 */}
        <article className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden mb-5">
          {/* 헤더 */}
          <div className="p-5 sm:p-6 border-b border-zinc-800">
            <div className="flex items-center gap-2.5 mb-3">
              <BarChart2 className="w-4 h-4 text-yellow-400" />
              <CoinBadge symbol={post.coinSymbol} />
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-white leading-snug mb-4">
              {post.title}
            </h1>

            {/* 메타 */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                  {(post.author_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">{post.author_name}</p>
                  <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-0.5">
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

              {canDelete && (
                <div className="flex items-center gap-2">
                  {confirmDelete ? (
                    <>
                      <span className="text-xs text-red-400">정말 삭제?</span>
                      <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 text-xs transition-colors disabled:opacity-50"
                      >
                        {deleting ? '삭제 중...' : '확인'}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs transition-colors"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      삭제
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 본문 내용 */}
          <div className="p-5 sm:p-6">
            <ContentRenderer content={post.bodyContent} />
          </div>
        </article>

        {/* 댓글 */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6">
          <CommentList postId={post.id} user={user} />
        </div>
      </main>
    </div>
  );
}
