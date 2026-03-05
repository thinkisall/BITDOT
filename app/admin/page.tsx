'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Header from '../components/Header';

interface UserData {
  uid: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  is_premium: boolean;
  premium_until: string | null;
  created_at: string;
  updated_at: string;
}

interface PremiumRequestData {
  id: string;
  uid: string;
  email: string;
  display_name: string | null;
  depositor_name: string;
  amount: number;
  status: string;
  created_at: string;
}

// 관리자 이메일 목록 (클라이언트 체크용)
const ADMIN_EMAILS = ['thinkisall@gmail.com', 'bitdamoabom@gmail.com'];

export default function AdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [premiumDays, setPremiumDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<'users' | 'premium-requests'>('users');
  const [premiumRequests, setPremiumRequests] = useState<PremiumRequestData[]>([]);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/');
    }
  }, [user, loading, isAdmin, router]);

  useEffect(() => {
    if (isAdmin) {
      if (activeTab === 'users') {
        fetchUsers();
      } else if (activeTab === 'premium-requests') {
        fetchPremiumRequests();
      }
    }
  }, [isAdmin, activeTab]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/admin/users', {
        headers: {
          'x-user-email': user?.email || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
      setCurrentPage(1); // 새로고침 시 1페이지로 리셋
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePremiumStatus = async (
    uid: string,
    isPremium: boolean,
    days?: number
  ) => {
    try {
      const premiumUntil = isPremium && days
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
        },
        body: JSON.stringify({
          uid,
          isPremium,
          premiumUntil,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user');
      }

      // 성공 시 유저 목록 새로고침
      await fetchUsers();
      setEditingUser(null);
    } catch (err: any) {
      alert('업데이트 실패: ' + err.message);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const fetchPremiumRequests = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/premium-requests', {
        headers: {
          'x-user-email': user?.email || '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch premium requests');
      }

      const data = await response.json();
      setPremiumRequests(data.requests || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessRequest = async (
    requestId: string,
    action: 'approve' | 'reject',
    rejectReason?: string
  ) => {
    const confirmMessage = action === 'approve'
      ? '프리미엄을 승인하시겠습니까? (30일 권한 부여)'
      : '신청을 거부하시겠습니까?';

    if (!confirm(confirmMessage)) return;

    try {
      setProcessingRequest(requestId);

      const response = await fetch('/api/admin/premium-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user?.email || '',
        },
        body: JSON.stringify({
          requestId,
          action,
          rejectReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process request');
      }

      alert(data.message);
      await fetchPremiumRequests(); // 목록 새로고침

      if (action === 'approve') {
        await fetchUsers(); // 유저 목록도 새로고침
      }
    } catch (err: any) {
      alert('처리 실패: ' + err.message);
    } finally {
      setProcessingRequest(null);
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-white">관리자 페이지</h1>
            <button
              onClick={() => router.push('/admin/picks')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-sm font-semibold hover:bg-yellow-500/25 transition-colors"
            >
              🏆 오늘의 픽 설정
            </button>
          </div>
          <p className="text-sm text-zinc-400">
            유저 관리 및 프리미엄 상태 설정
          </p>
        </div>

        {/* 탭 메뉴 */}
        <div className="mb-6">
          <div className="flex gap-2 border-b border-zinc-800">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'text-yellow-500 border-b-2 border-yellow-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              유저 관리
            </button>
            <button
              onClick={() => setActiveTab('premium-requests')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'premium-requests'
                  ? 'text-yellow-500 border-b-2 border-yellow-500'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              프리미엄 신청 관리
              {premiumRequests.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-zinc-950 text-xs rounded-full font-bold">
                  {premiumRequests.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* 유저 관리 탭 */}
        {activeTab === 'users' && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">전체 유저</h2>
              <button
                onClick={fetchUsers}
                disabled={isLoading}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {isLoading ? '로딩 중...' : '새로고침'}
              </button>
            </div>
            <p className="text-sm text-zinc-400 mt-1">
              총 {users.length}명 · {Math.ceil(users.length / PAGE_SIZE)}페이지
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left text-xs text-zinc-500 font-medium p-4">이메일</th>
                  <th className="text-left text-xs text-zinc-500 font-medium p-4">이름</th>
                  <th className="text-center text-xs text-zinc-500 font-medium p-4">프리미엄</th>
                  <th className="text-center text-xs text-zinc-500 font-medium p-4">만료일</th>
                  <th className="text-center text-xs text-zinc-500 font-medium p-4">가입일</th>
                  <th className="text-center text-xs text-zinc-500 font-medium p-4">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((userData) => (
                  <tr
                    key={userData.uid}
                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="text-sm text-white">{userData.email}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {userData.uid.slice(0, 8)}...
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-white">
                        {userData.display_name || '-'}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      {userData.is_premium ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                          ✓ 프리미엄
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-500">
                          일반
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="text-sm text-zinc-400">
                        {userData.premium_until
                          ? formatDate(userData.premium_until)
                          : userData.is_premium
                            ? '영구'
                            : '-'}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <div className="text-sm text-zinc-400">
                        {formatDate(userData.created_at)}
                      </div>
                    </td>
                    <td className="p-4">
                      {editingUser === userData.uid ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={premiumDays}
                              onChange={(e) => setPremiumDays(Number(e.target.value))}
                              placeholder="일수"
                              className="w-20 px-2 py-1 bg-zinc-800 text-white text-sm rounded border border-zinc-700 focus:outline-none focus:border-yellow-500"
                            />
                            <span className="text-xs text-zinc-400">일</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updatePremiumStatus(userData.uid, true, premiumDays)}
                              className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-medium rounded transition-colors"
                            >
                              기간제
                            </button>
                            <button
                              onClick={() => updatePremiumStatus(userData.uid, true)}
                              className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors"
                            >
                              영구
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updatePremiumStatus(userData.uid, false)}
                              className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors"
                            >
                              해제
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-medium rounded transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingUser(userData.uid)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          수정
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && !isLoading && (
              <div className="p-8 text-center">
                <p className="text-sm text-zinc-500">등록된 유저가 없습니다</p>
              </div>
            )}
          </div>

          {/* 페이지네이션 */}
          {users.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-500">
                {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, users.length)} / {users.length}명
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ‹
                </button>
                {Array.from({ length: Math.ceil(users.length / PAGE_SIZE) }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === Math.ceil(users.length / PAGE_SIZE) || Math.abs(p - currentPage) <= 2)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-xs text-zinc-600">…</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item as number)}
                        className={`px-2.5 py-1 text-xs rounded transition-colors ${
                          currentPage === item
                            ? 'bg-yellow-500 text-black font-bold'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage === Math.ceil(users.length / PAGE_SIZE)}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ›
                </button>
                <button
                  onClick={() => setCurrentPage(Math.ceil(users.length / PAGE_SIZE))}
                  disabled={currentPage === Math.ceil(users.length / PAGE_SIZE)}
                  className="px-2 py-1 text-xs text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  »
                </button>
              </div>
            </div>
          )}
        </div>
        )}

        {/* 프리미엄 신청 관리 탭 */}
        {activeTab === 'premium-requests' && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">프리미엄 신청 목록</h2>
                <button
                  onClick={fetchPremiumRequests}
                  disabled={isLoading}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {isLoading ? '로딩 중...' : '새로고침'}
                </button>
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                승인 대기 중인 신청: {premiumRequests.length}건
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left text-xs text-zinc-500 font-medium p-4">신청일</th>
                    <th className="text-left text-xs text-zinc-500 font-medium p-4">신청자</th>
                    <th className="text-left text-xs text-zinc-500 font-medium p-4">입금자명</th>
                    <th className="text-center text-xs text-zinc-500 font-medium p-4">금액</th>
                    <th className="text-center text-xs text-zinc-500 font-medium p-4">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {premiumRequests.map((request) => (
                    <tr
                      key={request.id}
                      className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="text-sm text-white">
                          {formatDate(request.created_at)}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-white">{request.email}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {request.display_name || '-'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-yellow-500 font-medium">
                          {request.depositor_name}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="text-sm text-white">
                          {request.amount.toLocaleString()}원
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleProcessRequest(request.id, 'approve')}
                            disabled={processingRequest === request.id}
                            className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('거부 사유를 입력하세요 (선택사항):');
                              handleProcessRequest(request.id, 'reject', reason || undefined);
                            }}
                            disabled={processingRequest === request.id}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded transition-colors disabled:opacity-50"
                          >
                            거부
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {premiumRequests.length === 0 && !isLoading && (
                <div className="p-8 text-center">
                  <p className="text-sm text-zinc-500">대기 중인 신청이 없습니다</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 사용 안내 */}
        <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-zinc-500">💡</span>
            <div className="space-y-2">
              <p className="font-medium text-zinc-300">프리미엄 설정 안내:</p>
              <ul className="space-y-1 text-zinc-500">
                <li>• <strong>기간제</strong>: 지정한 일수만큼 프리미엄 (예: 30일)</li>
                <li>• <strong>영구</strong>: 만료일 없이 영구 프리미엄</li>
                <li>• <strong>해제</strong>: 프리미엄 상태 제거</li>
                <li>• 프리미엄 유저는 1-2페이지 상위 종목 데이터를 볼 수 있습니다</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
