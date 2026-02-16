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

      <main className="container mx-auto px-4 py-6">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">박스권 스캐너</h1>
          <p className="text-sm text-zinc-400">
            업비트와 빗썸의 거래량 높은 종목(메이저 코인 제외) 중 50SMA 위에서 박스권을 형성한 종목을 찾습니다
          </p>
        </div>

        {/* Scan Settings Card */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6 mb-6">
          <h2 className="text-lg font-bold text-white mb-4">스캔 설정</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-xs text-zinc-500 mb-1">대상 종목</div>
              <div className="text-xl font-bold text-white">300</div>
              <div className="text-xs text-zinc-400 mt-1">거래량 상위 (메이저 제외)</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-xs text-zinc-500 mb-1">박스권 기준</div>
              <div className="text-xl font-bold text-white">72</div>
              <div className="text-xs text-zinc-400 mt-1">1시간봉 (3일)</div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-xs text-zinc-500 mb-1">SMA 기준</div>
              <div className="text-xl font-bold text-white">50</div>
              <div className="text-xs text-zinc-400 mt-1">이동평균선</div>
            </div>
          </div>

          <button
            onClick={handleScan}
            disabled={isScanning}
            className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-zinc-700 disabled:cursor-not-allowed text-black font-bold py-3 px-6 rounded-lg transition-colors"
          >
            {isScanning ? '스캔 중...' : '박스권 스캔 시작'}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResults && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="p-6 border-b border-zinc-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">스캔 결과</h2>
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-zinc-400">전체: </span>
                    <span className="text-white font-medium">{scanResults.resultsCount}</span>
                  </div>
                  <div className="text-sm">
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
                      <th className="text-left text-xs text-zinc-500 font-medium p-4">종목</th>
                      <th className="text-right text-xs text-zinc-500 font-medium p-4">거래소</th>
                      <th className="text-right text-xs text-zinc-500 font-medium p-4">24h 거래대금</th>
                      <th className="text-right text-xs text-zinc-500 font-medium p-4">50SMA</th>
                      <th className="text-right text-xs text-zinc-500 font-medium p-4">박스 상단</th>
                      <th className="text-right text-xs text-zinc-500 font-medium p-4">박스 하단</th>
                      <th className="text-right text-xs text-zinc-500 font-medium p-4">레인지 폭</th>
                      <th className="text-right text-xs text-zinc-500 font-medium p-4">터치(상/하)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.picked.map((result) => (
                      <tr
                        key={`${result.exchange}-${result.symbol}`}
                        onClick={() => setSelectedCoin(result)}
                        className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-yellow-500">
                                {result.symbol.slice(0, 3)}
                              </span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white flex items-center gap-2">
                                {result.symbol}
                                {result.nearTop && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">
                                    주목
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-green-500">박스권 형성</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right p-4">
                          <span className={`text-xs px-2 py-1 rounded ${
                            result.exchange === 'upbit'
                              ? 'bg-purple-500/10 text-purple-500'
                              : 'bg-blue-500/10 text-blue-500'
                          }`}>
                            {result.exchange === 'upbit' ? '업비트' : '빗썸'}
                          </span>
                        </td>
                        <td className="text-right p-4">
                          <div className="text-sm text-zinc-400">
                            ₩{formatVolume(result.volume)}
                          </div>
                        </td>
                        <td className="text-right p-4">
                          <div className="text-sm text-white font-medium">
                            ₩{formatNumber(result.sma50, 0)}
                          </div>
                        </td>
                        <td className="text-right p-4">
                          <div className="text-sm text-blue-400">
                            ₩{formatNumber(result.top, 0)}
                          </div>
                        </td>
                        <td className="text-right p-4">
                          <div className="text-sm text-orange-400">
                            ₩{formatNumber(result.bottom, 0)}
                          </div>
                        </td>
                        <td className="text-right p-4">
                          <div className="text-sm text-white">
                            {formatPercent(result.rangePct)}
                          </div>
                        </td>
                        <td className="text-right p-4">
                          <div className="text-xs text-zinc-400">
                            {result.touchesTop ?? '-'} / {result.touchesBottom ?? '-'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <div className="text-zinc-500">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm">박스권을 형성한 종목이 없습니다</p>
                  <p className="text-xs mt-1">조건을 만족하는 종목이 발견되지 않았습니다</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
          <div className="flex items-start gap-2 text-xs text-zinc-400">
            <span className="text-zinc-500">💡</span>
            <div>
              <p className="mb-2 font-medium text-zinc-300">박스권 탐지 기준:</p>
              <ul className="space-y-1 text-zinc-500">
                <li>• 업비트/빗썸 거래량 상위 300개 종목 (메이저 코인 제외: BTC, ETH, XRP 등)</li>
                <li>• 종가가 50SMA 위에 위치</li>
                <li>• 최근 72개 봉(약 3일)에서 횡보 레인지 형성</li>
                <li>• 레인지 폭이 15% 이하 또는 ATR의 2배 이하</li>
                <li>• 박스 상단/하단을 최소 2회 이상 터치</li>
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
