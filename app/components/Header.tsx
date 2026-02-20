"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AuthButton from "./AuthButton";
import { useAuth } from "@/contexts/AuthContext";

// 관리자 이메일 목록
const ADMIN_EMAILS = ['thinkisall@gmail.com', 'bitdamoabom@gmail.com'];

export default function Header() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // 관리자 체크
  const isAdmin = user && ADMIN_EMAILS.includes(user.email || '');

  // 메뉴 항목 클릭 시 메뉴 닫기
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0" onClick={closeMenu}>
          <h1 className="text-base sm:text-lg md:text-2xl font-bold text-yellow-500 cursor-pointer whitespace-nowrap">
            <span className="hidden sm:inline">BITDAMOABOM</span>
            <span className="sm:hidden">BITDA</span>
          </h1>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex gap-6 text-sm">
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
            href="/funding"
            className={`whitespace-nowrap transition-colors ${pathname === "/funding" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
          >
            펀딩비
          </Link>
          <Link
            href="/board"
            className={`whitespace-nowrap transition-colors ${pathname?.startsWith("/board") ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
          >
            게시판
          </Link>
          <Link
            href="/predict"
            className={`whitespace-nowrap transition-colors ${pathname === "/predict" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
          >
            AI 예측
          </Link>
          <Link
            href="/lstm"
            className={`whitespace-nowrap transition-colors ${pathname === "/lstm" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
          >
            LSTM 예측
          </Link>
          <Link
            href="/ai-chat"
            className={`whitespace-nowrap transition-colors ${pathname === "/ai-chat" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
          >
            AI 채팅
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

        {/* Right Side: Auth Button + Hamburger */}
        <div className="flex items-center gap-3">
          {/* Auth Button - Desktop only */}
          <div className="hidden md:block">
            <AuthButton />
          </div>

          {/* Hamburger Button - Mobile only */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-white p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="메뉴"
          >
            {isMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-50 md:hidden"
          onClick={closeMenu}
        >
          <div
            className="absolute right-0 top-0 h-full w-64 bg-zinc-900 border-l border-zinc-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-yellow-500">MENU</h2>
              <button
                onClick={closeMenu}
                className="text-zinc-400 hover:text-white transition-colors p-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Mobile Navigation Links */}
            <nav className="flex flex-col p-4 gap-1">
              <Link
                href="/"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname === "/"
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                홈
              </Link>
              <Link
                href="/analysis"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname === "/analysis"
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                분석
              </Link>
              <Link
                href="/funding"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname === "/funding"
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                펀딩비
              </Link>
              <Link
                href="/board"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname?.startsWith("/board")
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                게시판
              </Link>
              <Link
                href="/predict"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname === "/predict"
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                AI 예측
              </Link>
              <Link
                href="/lstm"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname === "/lstm"
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                LSTM 예측
              </Link>
              <Link
                href="/ai-chat"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname === "/ai-chat"
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                AI 채팅
              </Link>
              <Link
                href="/premium"
                onClick={closeMenu}
                className={`px-4 py-3 rounded-lg transition-colors ${
                  pathname === "/premium"
                    ? "bg-yellow-500/20 text-yellow-500 font-medium"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                프리미엄
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={closeMenu}
                  className={`px-4 py-3 rounded-lg transition-colors ${
                    pathname === "/admin"
                      ? "bg-yellow-500/20 text-yellow-500 font-medium"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  관리자
                </Link>
              )}
            </nav>

            {/* Auth Button in Mobile Menu */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-zinc-800">
              <AuthButton />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
