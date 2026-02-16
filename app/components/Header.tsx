"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AuthButton from "./AuthButton";

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/">
            <h1 className="text-lg sm:text-2xl font-bold text-yellow-500 cursor-pointer">
              BITDAMOABOM
            </h1>
          </Link>
          <nav className="flex gap-3 sm:gap-6 text-xs sm:text-sm">
            <Link
              href="/"
              className={`transition-colors ${pathname === "/" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              홈
            </Link>
            <Link
              href="/scanner"
              className={`transition-colors ${pathname === "/scanner" ? "text-white font-medium" : "text-zinc-400 hover:text-white"}`}
            >
              스캐너
            </Link>
          </nav>
        </div>
        <AuthButton />
      </div>
    </header>
  );
}
