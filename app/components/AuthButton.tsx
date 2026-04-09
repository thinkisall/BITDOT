'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function AuthButton() {
  const { user, loading, signOut } = useAuth();

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      await signOut();
    }
  };

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />;
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2">
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-8 h-8 rounded-full border-2 border-zinc-700"
            />
          )}
          <div className="hidden md:block">
            <div className="text-sm text-white font-medium">{user.displayName || user.email}</div>
            <div className="text-xs text-zinc-400">{user.email}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/auth/login"
      className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-linear-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-zinc-950 font-semibold text-xs sm:text-sm transition-all duration-300 shadow-lg hover:shadow-yellow-500/20 active:scale-95"
    >
      로그인
    </Link>
  );
}
