'use client';

import { useState, useEffect } from 'react';
import Header from '../components/Header';

interface FundingData {
  symbol: string;
  exchange: 'binance' | 'bybit' | 'okx';
  fundingRate: number;
  fundingRatePercent: number;
  nextFundingTime: number;
  markPrice?: number;
}

interface FundingResponse {
  data: FundingData[];
  timestamp: number;
  count: number;
}

type ExchangeFilter = 'all' | 'binance' | 'bybit' | 'okx';
type SortType = 'highest' | 'lowest' | 'positive' | 'negative';

// 브라우저에서 직접 Binance API 호출
async function fetchBinanceFunding(): Promise<FundingData[]> {
  try {
    const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
    const data = await response.json();

    return data
      .filter((item: any) => item.symbol.endsWith('USDT'))
      .map((item: any) => {
        const fundingRate = parseFloat(item.lastFundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'binance' as const,
          fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('Binance funding error:', error);
    return [];
  }
}

// 브라우저에서 직접 Bybit API 호출
async function fetchBybitFunding(): Promise<FundingData[]> {
  try {
    const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
    const data = await response.json();

    if (data.retCode !== 0 || !data.result?.list) {
      console.error('Bybit API error:', data);
      return [];
    }

    return data.result.list
      .filter((item: any) => item.symbol.endsWith('USDT'))
      .map((item: any) => {
        const fundingRate = parseFloat(item.fundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'bybit' as const,
          fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('Bybit funding error:', error);
    return [];
  }
}

export default function FundingPage() {
  const [fundingData, setFundingData] = useState<FundingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<ExchangeFilter>('all');
  const [sortType, setSortType] = useState<SortType>('highest');

  useEffect(() => {
    fetchFundingData();
    // 1분마다 자동 갱신
    const interval = setInterval(fetchFundingData, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchFundingData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [binanceData, bybitData] = await Promise.all([
        fetchBinanceFunding(),
        fetchBybitFunding(),
      ]);

      const allData = [...binanceData, ...bybitData];
      allData.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

      setFundingData({
        data: allData,
        timestamp: Date.now(),
        count: allData.length,
      });
    } catch (err: any) {
      console.error('Funding fetch error:', err);
      setError(err.message || 'Failed to fetch funding data');
    } finally {
      setIsLoading(false);
    }
  };

  const getExchangeColor = (exchange: string) => {
    switch (exchange) {
      case 'binance': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'bybit': return 'bg-orange-500/20 text-orange-500 border-orange-500/30';
      case 'okx': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      default: return 'bg-zinc-500/20 text-zinc-500 border-zinc-500/30';
    }
  };

  const getExchangeName = (exchange: string) => {
    switch (exchange) {
      case 'binance': return 'Binance';
      case 'bybit': return 'Bybit';
      case 'okx': return 'OKX';
      default: return exchange;
    }
  };

  const getFundingRateColor = (rate: number) => {
    const absRate = Math.abs(rate * 100);

    if (rate > 0) {
      // 양수 (롱 과열) - 빨강
      if (absRate >= 0.1) return 'text-red-500 bg-red-500/10';
      if (absRate >= 0.05) return 'text-orange-500 bg-orange-500/10';
      return 'text-yellow-500 bg-yellow-500/10';
    } else {
      // 음수 (숏 과열) - 초록
      if (absRate >= 0.1) return 'text-green-500 bg-green-500/10';
      if (absRate >= 0.05) return 'text-emerald-500 bg-emerald-500/10';
      return 'text-teal-500 bg-teal-500/10';
    }
  };

  const formatNextFundingTime = (timestamp: number) => {
    const now = Date.now();
    const diff = timestamp - now;

    if (diff <= 0) return '곧';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${minutes}분`;
  };

  // Filter and sort data
  const getFilteredAndSortedData = () => {
    if (!fundingData) return [];

    let filtered = fundingData.data;

    // Exchange filter
    if (exchangeFilter !== 'all') {
      filtered = filtered.filter(item => item.exchange === exchangeFilter);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    const sorted = [...filtered];
    switch (sortType) {
      case 'highest':
        sorted.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
        break;
      case 'lowest':
        sorted.sort((a, b) => Math.abs(a.fundingRate) - Math.abs(b.fundingRate));
        break;
      case 'positive':
        sorted.sort((a, b) => b.fundingRate - a.fundingRate);
        break;
      case 'negative':
        sorted.sort((a, b) => a.fundingRate - b.fundingRate);
        break;
    }

    return sorted;
  };

  const filteredData = getFilteredAndSortedData();

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-lg sm:text-2xl font-bold text-white mb-1 sm:mb-2">
            실시간 펀딩비 (Funding Rate)
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Binance, Bybit의 실시간 선물 펀딩비를 확인하세요
          </p>
        </div>

        {/* Info Card */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4 mb-4 sm:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-500 font-bold">양수(+)</span>
                <span className="text-zinc-400">롱 포지션 → 숏 포지션 지불</span>
              </div>
              <p className="text-zinc-500 text-[10px] sm:text-xs">
                시장이 과열되어 롱 포지션이 많을 때
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-500 font-bold">음수(-)</span>
                <span className="text-zinc-400">숏 포지션 → 롱 포지션 지불</span>
              </div>
              <p className="text-zinc-500 text-[10px] sm:text-xs">
                시장이 과매도되어 숏 포지션이 많을 때
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {fundingData && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">총 종목</div>
              <div className="text-base sm:text-xl font-bold text-white">{fundingData.count}</div>
            </div>
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">Binance</div>
              <div className="text-base sm:text-xl font-bold text-yellow-500">
                {fundingData.data.filter(d => d.exchange === 'binance').length}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4">
              <div className="text-[10px] sm:text-xs text-zinc-500 mb-1">Bybit</div>
              <div className="text-base sm:text-xl font-bold text-orange-500">
                {fundingData.data.filter(d => d.exchange === 'bybit').length}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 sm:p-4 mb-4 sm:mb-6">
          {/* Search */}
          <div className="mb-3 sm:mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="종목 검색... (예: BTC, ETH)"
              className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
            />
          </div>

          {/* Exchange Filter */}
          <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto scrollbar-hide">
            {(['all', 'binance', 'bybit'] as ExchangeFilter[]).map((exchange) => (
              <button
                key={exchange}
                onClick={() => setExchangeFilter(exchange)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  exchangeFilter === exchange
                    ? 'bg-yellow-500 text-black'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {exchange === 'all' ? '전체' : getExchangeName(exchange)}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {([
              { value: 'highest', label: '높은 순' },
              { value: 'lowest', label: '낮은 순' },
              { value: 'positive', label: '양수 높은 순' },
              { value: 'negative', label: '음수 높은 순' },
            ] as { value: SortType; label: string }[]).map((sort) => (
              <button
                key={sort.value}
                onClick={() => setSortType(sort.value)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                  sortType === sort.value
                    ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {sort.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-zinc-400 text-sm">펀딩비 데이터 로딩 중...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={fetchFundingData}
              className="mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* Data Table */}
        {!isLoading && !error && fundingData && (
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/50">
                    <th className="text-left text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">종목</th>
                    <th className="text-center text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">거래소</th>
                    <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4">펀딩비</th>
                    <th className="text-right text-[10px] sm:text-xs text-zinc-500 font-medium p-2 sm:p-4 hidden sm:table-cell">다음 정산</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length > 0 ? (
                    filteredData.map((item, index) => (
                      <tr
                        key={`${item.exchange}-${item.symbol}-${index}`}
                        className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                      >
                        <td className="p-2 sm:p-4">
                          <div className="font-medium text-white text-xs sm:text-sm">{item.symbol}</div>
                        </td>
                        <td className="p-2 sm:p-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded text-[9px] sm:text-xs font-bold border ${getExchangeColor(item.exchange)}`}>
                            {getExchangeName(item.exchange)}
                          </span>
                        </td>
                        <td className="p-2 sm:p-4 text-right">
                          <div className={`inline-block px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold text-xs sm:text-sm ${getFundingRateColor(item.fundingRate)}`}>
                            {item.fundingRate > 0 ? '+' : ''}{item.fundingRatePercent.toFixed(4)}%
                          </div>
                        </td>
                        <td className="p-2 sm:p-4 text-right text-xs sm:text-sm text-zinc-400 hidden sm:table-cell">
                          {formatNextFundingTime(item.nextFundingTime)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-zinc-500 text-sm">
                        검색 결과가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Showing count */}
            {filteredData.length > 0 && (
              <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-900/50">
                <p className="text-xs sm:text-sm text-zinc-400 text-center">
                  총 <span className="text-yellow-500 font-medium">{filteredData.length}</span>개 종목 표시 중
                </p>
              </div>
            )}
          </div>
        )}

        {/* Last Updated */}
        {fundingData && (
          <div className="mt-4 text-center">
            <button
              onClick={fetchFundingData}
              disabled={isLoading}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800 disabled:cursor-not-allowed text-white text-xs sm:text-sm rounded-lg transition-colors"
            >
              {isLoading ? '갱신 중...' : '수동 갱신'}
            </button>
            <p className="text-xs text-zinc-500 mt-2">
              마지막 업데이트: {new Date(fundingData.timestamp).toLocaleTimeString('ko-KR')}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
