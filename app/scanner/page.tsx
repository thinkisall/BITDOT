'use client';

import { useState } from 'react';
import Header from '../components/Header';
import BoxChartModal from '../components/BoxChartModal';

interface ScanResult {
  symbol: string;
  exchange: 'upbit' | 'bithumb';
  volume: number;
  ok: boolean;
  reason?: string;
  sma50?: number;
  top?: number;
  bottom?: number;
  currentPrice?: number;
  nearTop?: boolean;
  rangePct?: number;
  atr?: number;
  slopeNorm?: number;
  touchesTop?: number;
  touchesBottom?: number;
  error?: string;
}

interface ScanResponse {
  picked: ScanResult[];
  resultsCount: number;
  pickedCount: number;
}

export default function ScannerPage() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<ScanResult | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setError(null);
    setScanResults(null);

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: ScanResponse = await response.json();
      setScanResults(data);
    } catch (e: any) {
      setError(e?.message || '스캔 중 오류가 발생했습니다');
    } finally {
      setIsScanning(false);
    }
  };

  const formatNumber = (num: number | undefined, decimals = 2) => {
    if (num === undefined) return '-';
    return num.toFixed(decimals);
  };

  const formatPercent = (num: number | undefined) => {
    if (num === undefined) return '-';
    return `${(num * 100).toFixed(2)}%`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000000) {
      return `${(volume / 1000000000).toFixed(2)}B`;
    } else if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(2)}K`;
    }
    return volume.toFixed(2);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header Section */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">박스권 스캐너</h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            거래량 상위 300종목 중 박스권 형성 종목 탐지
          </p>
        </div>

        {/* Scan Settings Card */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">스캔 설정</h2>

          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-zinc-800/50 rounded-lg p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 sm:mb-1">대상</div>
              <div className="text-base sm:text-xl font-bold text-white">300</div>
              <div className="text-[9px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">종목</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 sm:mb-1">기준</div>
              <div className="text-base sm:text-xl font-bold text-white">72</div>
              <div className="text-[9px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">1시간봉</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-2 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-0.5 sm:mb-1">SMA</div>
              <div className="text-base sm:text-xl font-bold text-white">50</div>
              <div className="text-[9px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">이평선</div>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-black font-bold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
          >
            {isScanning ? '스캔 중...' : '박스권 스캔 시작'}
          </button>

          {error && (
            <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-xs sm:text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResults && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="p-3 sm:p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white">스캔 결과</h2>
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="text-xs sm:text-sm">
                    <span className="text-zinc-400">전체: </span>
                    <span className="text-white font-medium">{scanResults.resultsCount}</span>
                  </div>
                  <div className="text-xs sm:text-sm">
                    <span className="text-zinc-400">발견: </span>
                    <span className="text-green-500 font-bold">{scanResults.pickedCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {scanResults.pickedCount > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900/50">
                      <th className="text-left text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">종목</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">거래소</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden md:table-cell">거래대금</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden lg:table-cell">50SMA</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">상단</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">하단</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden sm:table-cell">폭</th>
                      <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden lg:table-cell">터치</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.picked
                      .sort((a, b) => {
                        // 주목 표시 종목을 맨 위로
                        if (a.nearTop && !b.nearTop) return -1;
                        if (!a.nearTop && b.nearTop) return 1;
                        // 나머지는 거래량 순
                        return b.volume - a.volume;
                      })
                      .map((result) => (
                      <tr
                        key={`${result.exchange}-${result.symbol}`}
                        onClick={() => setSelectedCoin(result)}
                        className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      >
                        <td className="p-2 sm:p-4">
                          <div className="flex items-center gap-1.5 sm:gap-3">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-[9px] sm:text-xs font-bold text-yellow-500">
                                {result.symbol.slice(0, 2)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-[11px] sm:text-sm font-medium text-white flex items-center gap-1 sm:gap-2">
                                <span className="truncate">{result.symbol}</span>
                                {result.nearTop && (
                                  <span className="text-[9px] sm:text-xs px-1 sm:px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold whitespace-nowrap">
                                    주목
                                  </span>
                                )}
                              </div>
                              <div className="text-[9px] sm:text-xs text-green-500">박스권</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-4">
                          <span className={`text-[9px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded ${
                            result.exchange === 'upbit'
                              ? 'bg-purple-500/10 text-purple-500'
                              : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {result.exchange === 'upbit' ? '업비트' : '빗썸'}
                          </span>
                        </td>
                        <td className="text-right p-2 sm:p-4 hidden md:table-cell">
                          <div className="text-xs sm:text-sm text-zinc-400">
                            ₩{formatVolume(result.volume)}
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-4 hidden lg:table-cell">
                          <div className="text-xs sm:text-sm text-white font-medium">
                            ₩{formatNumber(result.sma50, 0)}
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-4">
                          <div className="text-[10px] sm:text-sm text-blue-400">
                            ₩{formatNumber(result.top, 0)}
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-4">
                          <div className="text-[10px] sm:text-sm text-orange-400">
                            ₩{formatNumber(result.bottom, 0)}
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-4 hidden sm:table-cell">
                          <div className="text-xs sm:text-sm text-white">
                            {formatPercent(result.rangePct)}
                          </div>
                        </td>
                        <td className="text-right p-2 sm:p-4 hidden lg:table-cell">
                          <div className="text-[10px] sm:text-xs text-zinc-400">
                            {result.touchesTop ?? '-'} / {result.touchesBottom ?? '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 sm:p-8 text-center">
                <div className="text-zinc-500">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-xs sm:text-sm">박스권을 형성한 종목이 없습니다</p>
                  <p className="text-[10px] sm:text-xs mt-1">조건을 만족하는 종목이 발견되지 않았습니다</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-zinc-400">
            <span className="text-zinc-500 text-sm">💡</span>
            <div>
              <p className="mb-1.5 sm:mb-2 font-medium text-zinc-300">박스권 탐지 기준:</p>
              <ul className="space-y-0.5 sm:space-y-1 text-zinc-500">
                <li>• 거래량 상위 300종목 (메이저 제외)</li>
                <li>• 50SMA 위에서 횡보</li>
                <li>• 72개 봉(3일) 레인지 형성</li>
                <li>• 상단/하단 2회 이상 터치</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Chart Modal */}
      {selectedCoin && (
        <BoxChartModal
          isOpen={!!selectedCoin}
          onClose={() => setSelectedCoin(null)}
          symbol={selectedCoin.symbol}
          exchange={selectedCoin.exchange}
          boxData={{
            top: selectedCoin.top || 0,
            bottom: selectedCoin.bottom || 0,
            sma50: selectedCoin.sma50 || 0,
          }}
        />
      )}
    </div>
  );
}
