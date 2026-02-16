"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";
import { useAuth } from "@/contexts/AuthContext";

// 관리자 이메일 목록
const ADMIN_EMAILS = ['thinkisall@gmail.com', 'bitdamoabom@gmail.com'];

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();

  // 관리자 체크
  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2 sm:gap-4 md:gap-8 min-w-0 flex-1">
          <Link href="/" className="flex-shrink-0">
            <h1 className="text-base sm:text-lg md:text-2xl font-bold text-yellow-500 cursor-pointer whitespace-nowrap">
              <span className="hidden sm:inline">BITDAMOABOM</span>
              <span className="sm:hidden">BITDA</span>
            </h1>
          </Link>
          <nav className="flex gap-2 sm:gap-3 md:gap-6 text-[10px] sm:text-xs md:text-sm overflow-x-auto scrollbar-hide">
            <Link
              href="/"
              className={`whitespace-nowrap transition-colors ${pathname === "/" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              홈
            </Link>
            <Link
              href="/analysis"
              className={`whitespace-nowrap transition-colors ${pathname === "/analysis" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              분석
            </Link>
            <Link
              href="/board"
              className={`whitespace-nowrap transition-colors ${pathname?.startsWith("/board") ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              게시판
            </Link>
            <Link
              href="/premium"
              className={`whitespace-nowrap transition-colors ${pathname === "/premium" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              프리미엄
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className={`whitespace-nowrap transition-colors ${pathname === "/admin" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
              >
                관리자
              </Link>
            )}
          </nav>
        </div>
        <div className="flex-shrink-0">
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
