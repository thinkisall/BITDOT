"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

const VISITED_KEY = "coupang_visited_date";

export function hasCoupangVisitedToday(): boolean {
  try {
    const stored = localStorage.getItem(VISITED_KEY);
    if (!stored) return false;
    return stored === new Date().toDateString();
  } catch {
    return false;
  }
}

function markCoupangVisited() {
  try {
    localStorage.setItem(VISITED_KEY, new Date().toDateString());
  } catch {}
}

interface CoupangAdModalProps {
  onClose: () => void;
  targetPath?: string;
}

export function CoupangAdModal({ onClose }: CoupangAdModalProps) {
  useEffect(() => {
    markCoupangVisited();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-zinc-900 border border-zinc-700 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <p className="text-xs text-zinc-400">파트너스 광고</p>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Ad Content */}
        <div className="p-5 text-center">
          <div className="text-4xl mb-3">🛍️</div>
          <h3 className="text-base font-bold text-white mb-2">쿠팡 파트너스</h3>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            이 서비스는 쿠팡 파트너스 활동을 통해<br />
            일정액의 수수료를 제공받습니다.
          </p>
          <a
            href="https://link.coupang.com"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="inline-block w-full py-2.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-sm transition-colors"
          >
            쿠팡 방문하기
          </a>
          <button
            onClick={onClose}
            className="mt-2 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            오늘 하루 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
