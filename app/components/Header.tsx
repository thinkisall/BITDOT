'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/">
            <h1 className="text-2xl font-bold text-yellow-500 cursor-pointer">BITDOT</h1>
          </Link>
          <nav className="flex gap-6 text-sm">
            <Link
              href="/"
              className={`transition-colors ${pathname === '/' ? 'text-white font-medium' : 'text-zinc-400 hover:text-white'}`}
            >
              홈
            </Link>
            <Link
              href="/scanner"
              className={`transition-colors ${pathname === '/scanner' ? 'text-white font-medium' : 'text-zinc-400 hover:text-white'}`}
            >
              스캐너
            </Link>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors">거래</a>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors">선물</a>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors">마켓</a>
            <a href="#" className="text-zinc-400 hover:text-white transition-colors">자산</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <button className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">
            로그인
          </button>
          <button className="px-4 py-2 text-sm bg-yellow-500 text-black rounded hover:bg-yellow-400 transition-colors font-medium">
            회원가입
          </button>
        </div>
      </div>
    </header>
  );
}
