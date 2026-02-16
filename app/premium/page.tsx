'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

interface PremiumRequestStatus {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reject_reason?: string;
}

export default function PremiumPage() {
  const { user, loading, isPremium, premiumUntil } = useAuth();
  const router = useRouter();
  const [depositorName, setDepositorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentRequest, setCurrentRequest] = useState<PremiumRequestStatus | null>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);

  // 로그인 체크
  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // 신청 상태 조회
  useEffect(() => {
    if (user) {
      fetchRequestStatus();
    }
  }, [user]);

  const fetchRequestStatus = async () => {
    try {
      setIsLoadingRequest(true);
      const response = await fetch(`/api/premium/apply?uid=${user?.uid}`);
      const data = await response.json();

      if (data.request && data.request.status === 'pending') {
        setCurrentRequest(data.request);
      }
    } catch (err) {
      console.error('Failed to fetch request status:', err);
    } finally {
      setIsLoadingRequest(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!depositorName.trim()) {
      setError('입금자명을 입력해주세요.');
      return;
    }

    if (depositorName.length < 2 || depositorName.length > 20) {
      setError('입금자명은 2-20자로 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/premium/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user?.uid,
          email: user?.email,
          displayName: user?.displayName,
          depositorName: depositorName.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '신청 처리 중 오류가 발생했습니다.');
      }

      // 성공
      alert('프리미엄 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.');
      setDepositorName('');
      fetchRequestStatus(); // 상태 새로고침
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || isLoadingRequest) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">프리미엄 등록</h1>
          <p className="text-sm text-zinc-400">
            무통장입금 방식으로 프리미엄 멤버십을 신청하세요
          </p>
        </div>

        {/* 이미 프리미엄인 경우 */}
        {isPremium && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">✓</span>
              <h2 className="text-lg font-bold text-yellow-500">프리미엄 회원</h2>
            </div>
            <div className="text-sm text-zinc-300 space-y-2">
              <p>현재 프리미엄 멤버십이 활성화되어 있습니다.</p>
              {premiumUntil ? (
                <p className="text-zinc-400">
                  만료일: <span className="text-white">{formatDate(premiumUntil.toISOString())}</span>
                </p>
              ) : (
                <p className="text-green-500">영구 프리미엄</p>
              )}
            </div>
          </div>
        )}

        {/* 신청 대기 중인 경우 */}
        {!isPremium && currentRequest && currentRequest.status === 'pending' && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-2xl">⏳</span>
              <h2 className="text-lg font-bold text-yellow-500">승인 대기 중</h2>
            </div>
            <div className="text-sm text-zinc-300 space-y-2">
              <p>프리미엄 신청이 처리 대기 중입니다.</p>
              <p className="text-zinc-400">
                신청일: {formatDate(currentRequest.created_at)}
              </p>
              <p className="text-zinc-500 mt-4">
                입금 확인 후 관리자가 승인하면 자동으로 프리미엄 권한이 부여됩니다.
              </p>
            </div>
          </div>
        )}

        {/* 신청 폼 - 프리미엄 아니고 대기 중인 신청도 없을 때만 표시 */}
        {!isPremium && (!currentRequest || currentRequest.status !== 'pending') && (
          <>
            {/* 가격 안내 */}
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-yellow-500 mb-2">39,900원</div>
                <div className="text-sm text-zinc-400">1개월 (30일)</div>
              </div>

              <div className="border-t border-zinc-800 pt-4 space-y-3">
                <h3 className="text-sm font-bold text-white mb-2">프리미엄 혜택</h3>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>1-2페이지 상위 종목 데이터 무제한 열람</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>실시간 시장 분석 데이터 제공</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">•</span>
                    <span>고급 차트 및 기술적 지표 활용</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* 입금 안내 */}
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
              <h3 className="text-sm font-bold text-white mb-4">입금 계좌 안내</h3>
              <div className="bg-zinc-950 rounded-lg p-4 mb-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">은행</span>
                    <span className="text-white font-medium">카카오뱅크</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">계좌번호</span>
                    <span className="text-white font-mono">3333-15-8030322</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">예금주</span>
                    <span className="text-white">김상현</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">입금액</span>
                    <span className="text-yellow-500 font-bold">39,900원</span>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-zinc-500">
                <span>ℹ️</span>
                <p>
                  위 계좌로 입금 후 아래 폼에서 입금자명을 입력하여 신청해주세요.
                  관리자가 입금을 확인하면 자동으로 프리미엄 권한이 부여됩니다.
                </p>
              </div>
            </div>

            {/* 신청 폼 */}
            <form onSubmit={handleSubmit} className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
              <h3 className="text-sm font-bold text-white mb-4">프리미엄 신청</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-500">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">
                    이메일
                  </label>
                  <input
                    type="text"
                    value={user.email || ''}
                    disabled
                    className="w-full px-4 py-2.5 bg-zinc-800 text-zinc-500 rounded-lg border border-zinc-700 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-zinc-400 mb-2">
                    입금자명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={depositorName}
                    onChange={(e) => setDepositorName(e.target.value)}
                    placeholder="실제 입금하신 이름을 입력하세요"
                    maxLength={20}
                    className="w-full px-4 py-2.5 bg-zinc-800 text-white rounded-lg border border-zinc-700 focus:outline-none focus:border-yellow-500 text-sm placeholder:text-zinc-600"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    입금 확인을 위해 정확한 입금자명을 입력해주세요 (2-20자)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-zinc-950 font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? '신청 중...' : '신청하기'}
                </button>
              </div>
            </form>

            {/* 주의사항 */}
            <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <div className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-zinc-500">💡</span>
                <div className="space-y-1">
                  <p className="font-medium text-zinc-300">신청 전 확인사항</p>
                  <ul className="space-y-1 text-zinc-500">
                    <li>• 입금 후 신청해주세요 (선입금 후 신청)</li>
                    <li>• 입금자명이 다를 경우 확인이 지연될 수 있습니다</li>
                    <li>• 영업일 기준 1-2일 내 처리됩니다</li>
                    <li>• 승인 후 30일간 프리미엄 혜택이 제공됩니다</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
