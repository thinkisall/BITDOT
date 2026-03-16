'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';

// API 응답 데이터 타입을 정의합니다.
interface SurgeResult {
  exchange: string;
  market: string;
  korean_name: string;
  surgeFactor: string;
  currentPrice: number;
  volume: number;
  averageVolume: number;
}

interface SurgeResponse {
  lastUpdated: string;
  results: SurgeResult[];
}

export default function VolumeScannerPage() {
  const [data, setData] = useState<SurgeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const API_URL = '/api/volume-surge';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(API_URL);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const result: SurgeResponse = await response.json();
        setData(result);
        if (result.lastUpdated) {
            setLastUpdated(new Date(result.lastUpdated).toLocaleString());
        }
      } catch (e: any) {
        setError(e.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 1분마다 데이터 갱신
    const intervalId = setInterval(fetchData, 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);
  
  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return '-';
    return new Intl.NumberFormat('ko-KR').format(num);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Header />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">거래량 급등 스캐너</h1>
          <p className="text-sm text-zinc-400">
            최근 5분 거래량이 이전 100분(5분봉 20개) 평균 거래량보다 급증한 종목을 실시간으로 보여줍니다.
          </p>
           {lastUpdated && (
            <p className="text-xs text-zinc-500 mt-2">마지막 업데이트: {lastUpdated}</p>
          )}
        </div>

        {loading && !data && (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg">데이터를 불러오는 중입니다...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-center">
            <p className="text-red-400">오류: {error}</p>
          </div>
        )}

        {data && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-800">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">종목</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">거래소</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">급등 배수</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">현재가</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">현재 거래량</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">평균 거래량</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.results.length > 0 ? (
                    data.results.map((item) => (
                      <tr key={`${item.exchange}-${item.market}`} className="hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium">{item.korean_name}</div>
                          <div className="text-xs text-zinc-500">{item.market}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                item.exchange === 'Upbit' ? 'bg-blue-900 text-blue-300' : 'bg-zinc-700 text-zinc-300'
                            }`}>
                                {item.exchange}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-lg font-bold text-red-500">{item.surgeFactor}배</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">₩{formatNumber(item.currentPrice)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">{formatNumber(Math.round(item.volume))}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-zinc-400">{formatNumber(Math.round(item.averageVolume))}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-zinc-500">
                        현재 거래량 급등 종목이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
