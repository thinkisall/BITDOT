'use client';

import { useState, useEffect, useRef, useMemo, Fragment, memo } from 'react';
import { CoinData } from '../types/market';
import { useBinanceAlpha } from '@/contexts/BinanceAlphaContext';

type FlashDirection = 'up' | 'down';
interface FlashState {
  bithumb?: FlashDirection;
  upbit?: FlashDirection;
}

// 모듈 레벨 순수 함수 (렌더링마다 재생성 방지)
function formatPrice(price: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(price));
}
function formatVolume(volume: number) {
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(2)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(2)}K`;
  return volume.toFixed(2);
}
function formatChangeRate(rate: number) {
  const sign = rate >= 0 ? '+' : '';
  return `${sign}${rate.toFixed(2)}%`;
}
function formatPriceDiff(diff: number) {
  if (diff === 0) return '-';
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${formatPrice(Math.abs(diff))}`;
}

// 메모이즈된 행 컴포넌트 — flashMap 변경 시 해당 행만 재렌더링
const CoinRow = memo(function CoinRow({
  coin,
  rank,
  flash,
  swapped,
}: {
  coin: CoinData;
  rank: number;
  flash?: FlashState;
  swapped?: boolean;
}) {
  const { isAlpha: isBinanceAlpha } = useBinanceAlpha();

  const fc = (exchange: 'bithumb' | 'upbit') => {
    if (!flash) return '';
    const dir = flash[exchange];
    if (dir === 'up') return 'flash-up';
    if (dir === 'down') return 'flash-down';
    return '';
  };

  const leftExch = (swapped ? 'upbit' : 'bithumb') as 'bithumb' | 'upbit';
  const rightExch = (swapped ? 'bithumb' : 'upbit') as 'bithumb' | 'upbit';
  const leftData = swapped ? coin.upbit : coin.bithumb;
  const rightData = swapped ? coin.bithumb : coin.upbit;

  return (
    <Fragment>
      {/* Desktop Row */}
      <tr className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors hidden sm:table-row">
        <td className="p-4">
          <div className="text-sm font-medium text-zinc-400">#{rank}</div>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-yellow-500">{coin.symbol.slice(0, 3)}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-white">{coin.name}</div>
                {isBinanceAlpha(coin.symbol) && (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded">
                    ALPHA
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-500">{coin.symbol}</div>
            </div>
          </div>
        </td>
        {/* Left exchange */}
        <td className={`text-right p-4 border-l border-zinc-800/50 ${fc(leftExch)}`}>
          {leftData ? (
            <div className="text-sm text-white font-medium">₩{formatPrice(leftData.price)}</div>
          ) : (
            <div className="text-xs text-zinc-600">-</div>
          )}
        </td>
        <td className={`text-right p-4 ${fc(leftExch)}`}>
          {leftData ? (
            <div className={`text-sm font-medium ${leftData.changeRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatChangeRate(leftData.changeRate)}
            </div>
          ) : (
            <div className="text-xs text-zinc-600">-</div>
          )}
        </td>
        <td className="text-right p-4">
          {leftData ? (
            <div className="text-xs text-zinc-400">{formatVolume(leftData.volume)}</div>
          ) : (
            <div className="text-xs text-zinc-600">-</div>
          )}
        </td>
        {/* Right exchange */}
        <td className={`text-right p-4 border-l border-zinc-800/50 ${fc(rightExch)}`}>
          {rightData ? (
            <div className="text-sm text-white font-medium">₩{formatPrice(rightData.price)}</div>
          ) : (
            <div className="text-xs text-zinc-600">-</div>
          )}
        </td>
        <td className={`text-right p-4 ${fc(rightExch)}`}>
          {rightData ? (
            <div className={`text-sm font-medium ${rightData.changeRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatChangeRate(rightData.changeRate)}
            </div>
          ) : (
            <div className="text-xs text-zinc-600">-</div>
          )}
        </td>
        <td className="text-right p-4">
          {rightData ? (
            <div className="text-xs text-zinc-400">{formatVolume(rightData.volume)}</div>
          ) : (
            <div className="text-xs text-zinc-600">-</div>
          )}
        </td>
        {/* Price Difference */}
        <td className="text-right p-4 border-l border-zinc-800/50">
          {coin.bithumb && coin.upbit ? (
            <div className={`text-sm font-medium ${coin.priceDiff >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              {formatPriceDiff(coin.priceDiff)}
            </div>
          ) : (
            <div className="text-xs text-zinc-600">-</div>
          )}
        </td>
      </tr>

      {/* Mobile Row */}
      <tr className="border-b border-zinc-800 sm:hidden">
        <td className="p-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
              <span className="text-[8px] font-bold text-yellow-500">{coin.symbol.slice(0, 2)}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <div className="text-[10px] font-medium text-white truncate">{coin.name}</div>
                {isBinanceAlpha(coin.symbol) && (
                  <span className="px-1 py-0.5 text-[7px] font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 rounded whitespace-nowrap">
                    α
                  </span>
                )}
              </div>
              <div className="text-[8px] text-zinc-500">#{rank}</div>
            </div>
          </div>
        </td>
        {/* Left exchange */}
        <td className={`text-right p-1.5 ${fc(leftExch)}`}>
          {leftData ? (
            <>
              <div className="text-[11px] text-white font-medium">₩{formatPrice(leftData.price)}</div>
              <div className={`text-[9px] font-medium ${leftData.changeRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatChangeRate(leftData.changeRate)}
              </div>
            </>
          ) : (
            <div className="text-[8px] text-zinc-600">-</div>
          )}
        </td>
        <td className="text-center p-1.5">
          {coin.bithumb && coin.upbit ? (
            <div className={`text-[9px] font-medium ${coin.priceDiff >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
              {coin.priceDiff >= 0 ? '+' : ''}{Math.round(coin.priceDiff)}
            </div>
          ) : (
            <div className="text-[8px] text-zinc-600">-</div>
          )}
        </td>
        {/* Right exchange */}
        <td className={`text-right p-1.5 ${fc(rightExch)}`}>
          {rightData ? (
            <>
              <div className="text-[11px] text-white font-medium">₩{formatPrice(rightData.price)}</div>
              <div className={`text-[9px] font-medium ${rightData.changeRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {formatChangeRate(rightData.changeRate)}
              </div>
            </>
          ) : (
            <div className="text-[8px] text-zinc-600">-</div>
          )}
        </td>
        <td className="text-right p-1.5">
          {rightData ? (
            <div className="text-[9px] text-zinc-400">{formatVolume(rightData.volume)}</div>
          ) : (
            <div className="text-[8px] text-zinc-600">-</div>
          )}
        </td>
      </tr>
    </Fragment>
  );
}, (prev, next) =>
  prev.rank === next.rank &&
  prev.flash === next.flash &&
  prev.swapped === next.swapped &&
  prev.coin.bithumb?.price === next.coin.bithumb?.price &&
  prev.coin.upbit?.price === next.coin.upbit?.price &&
  prev.coin.bithumb?.changeRate === next.coin.bithumb?.changeRate &&
  prev.coin.upbit?.changeRate === next.coin.upbit?.changeRate &&
  prev.coin.priceDiff === next.coin.priceDiff
);

interface MarketTableProps {
  data: CoinData[];
  isConnected: boolean;
}

const ITEMS_PER_PAGE = 20;

export default function MarketTable({ data, isConnected }: MarketTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [swapped, setSwapped] = useState(false);
  const tableTopRef = useRef<HTMLDivElement>(null);
  const prevPricesRef = useRef<Map<string, { bithumb: number; upbit: number }>>(new Map());
  const [flashMap, setFlashMap] = useState<Map<string, FlashState>>(new Map());
  const flashTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Track price changes and trigger flash effects
  useEffect(() => {
    const prevPrices = prevPricesRef.current;
    const newFlashes = new Map<string, FlashState>();

    data.forEach((coin) => {
      const prev = prevPrices.get(coin.symbol);
      const flash: FlashState = {};

      if (prev) {
        if (coin.bithumb && prev.bithumb !== 0 && coin.bithumb.price !== prev.bithumb) {
          flash.bithumb = coin.bithumb.price > prev.bithumb ? 'up' : 'down';
        }
        if (coin.upbit && prev.upbit !== 0 && coin.upbit.price !== prev.upbit) {
          flash.upbit = coin.upbit.price > prev.upbit ? 'up' : 'down';
        }
      }

      if (flash.bithumb || flash.upbit) {
        newFlashes.set(coin.symbol, flash);
      }

      // Update prev prices
      prevPrices.set(coin.symbol, {
        bithumb: coin.bithumb?.price ?? 0,
        upbit: coin.upbit?.price ?? 0,
      });
    });

    if (newFlashes.size > 0) {
      setFlashMap(prev => {
        const merged = new Map(prev);
        newFlashes.forEach((v, k) => merged.set(k, v));
        return merged;
      });

      // Clear flashes after animation
      newFlashes.forEach((_, symbol) => {
        const existing = flashTimersRef.current.get(symbol);
        if (existing) clearTimeout(existing);

        const timer = setTimeout(() => {
          setFlashMap(prev => {
            const next = new Map(prev);
            next.delete(symbol);
            return next;
          });
          flashTimersRef.current.delete(symbol);
        }, 700);
        flashTimersRef.current.set(symbol, timer);
      });
    }
  }, [data]);

  // Filter data based on search query
  const filteredData = searchQuery
    ? data.filter(coin =>
        coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : data;

  // rank Map 사전 계산 — O(n²) getRank 제거
  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach((coin, idx) => map.set(coin.symbol, idx + 1));
    return map;
  }, [data]);

  // Reset to page 1 when search query or data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Reset to page 1 when data changes significantly
  useEffect(() => {
    const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [filteredData.length, currentPage]);

  // Scroll to top when page changes
  useEffect(() => {
    if (tableTopRef.current) {
      tableTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentData = filteredData.slice(startIndex, endIndex);

  const getRank = (coin: CoinData) => rankMap.get(coin.symbol) ?? 0;

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div>
      <div ref={tableTopRef} className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <h2 className="text-base sm:text-lg font-bold text-white">거래소 시세 비교</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
              <span className="text-[10px] sm:text-xs text-zinc-500">
                {isConnected ? '실시간' : '연결 중'}
              </span>
            </div>
            <span className="text-[10px] sm:text-xs text-zinc-500">
              {searchQuery ? `${filteredData.length}개` : `${data.length}개`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${swapped ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
            <span className="text-zinc-400">{swapped ? '업비트' : '빗썸'}</span>
          </div>
          <button
            onClick={() => setSwapped(v => !v)}
            className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="거래소 순서 바꾸기"
          >
            ⇄
          </button>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${swapped ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
            <span className="text-zinc-400">{swapped ? '빗썸' : '업비트'}</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-3 sm:mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="코인 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 pl-8 sm:pl-10 bg-zinc-900 border border-zinc-800 rounded-lg text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-yellow-500 transition-colors"
          />
          <svg
            className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <table className="w-full">
          <thead>
            {/* Desktop Header */}
            <tr className="border-b border-zinc-800 bg-zinc-900/50 hidden sm:table-row">
              <th className="text-left text-xs text-zinc-500 font-medium p-4" rowSpan={2}>순위</th>
              <th className="text-left text-xs text-zinc-500 font-medium p-4" rowSpan={2}>코인</th>
              <th className="text-center text-xs text-zinc-500 font-medium p-4 border-l border-zinc-800" colSpan={3}>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${swapped ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                  {swapped ? '업비트' : '빗썸'}
                </div>
              </th>
              <th className="text-center text-xs text-zinc-500 font-medium p-4 border-l border-zinc-800" colSpan={3}>
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${swapped ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                  {swapped ? '빗썸' : '업비트'}
                </div>
              </th>
              <th className="text-center text-xs text-zinc-500 font-medium p-4 border-l border-zinc-800" rowSpan={2}>차액</th>
            </tr>
            <tr className="border-b border-zinc-800 bg-zinc-900/50 hidden sm:table-row">
              <th className="text-right text-xs text-zinc-500 font-medium p-4 border-l border-zinc-800">현재가</th>
              <th className="text-right text-xs text-zinc-500 font-medium p-4">변동률</th>
              <th className="text-right text-xs text-zinc-500 font-medium p-4">거래량</th>
              <th className="text-right text-xs text-zinc-500 font-medium p-4 border-l border-zinc-800">현재가</th>
              <th className="text-right text-xs text-zinc-500 font-medium p-4">변동률</th>
              <th className="text-right text-xs text-zinc-500 font-medium p-4">거래량</th>
            </tr>

            {/* Mobile Header */}
            <tr className="border-b border-zinc-800 bg-zinc-900/50 sm:hidden">
              <th className="text-left text-[9px] text-zinc-500 font-medium p-1.5">코인</th>
              <th className="text-center text-[9px] text-zinc-500 font-medium p-1.5" colSpan={2}>
                <div className="flex items-center justify-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${swapped ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                  {swapped ? '업비트' : '빗썸'}
                </div>
              </th>
              <th className="text-center text-[9px] text-zinc-500 font-medium p-1.5" colSpan={2}>
                <div className="flex items-center justify-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${swapped ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                  {swapped ? '빗썸' : '업비트'}
                </div>
              </th>
            </tr>
          </thead>
            <tbody>
              {currentData.length > 0 ? (
                currentData.map((coin) => (
                  <CoinRow
                    key={coin.symbol}
                    coin={coin}
                    rank={getRank(coin)}
                    flash={flashMap.get(coin.symbol)}
                    swapped={swapped}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="p-6 sm:p-8 text-center">
                    <div className="text-zinc-500">
                      <svg className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <p className="text-xs sm:text-sm">검색 결과가 없습니다</p>
                      <p className="text-[10px] sm:text-xs mt-1">다른 검색어를 입력해보세요</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="text-[11px] sm:text-sm text-zinc-400 order-2 sm:order-1">
            {startIndex + 1}-{Math.min(endIndex, filteredData.length)} / {filteredData.length}개
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 order-1 sm:order-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-sm bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              이전
            </button>

            <div className="flex items-center gap-0.5 sm:gap-1">
              {getPageNumbers().map((page, idx) => (
                typeof page === 'number' ? (
                  <button
                    key={idx}
                    onClick={() => goToPage(page)}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-sm rounded transition-colors ${
                      currentPage === page
                        ? 'bg-yellow-500 text-black font-medium'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={idx} className="px-1 sm:px-2 text-[11px] sm:text-sm text-zinc-600">
                    {page}
                  </span>
                )
              ))}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-sm bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              다음
            </button>
          </div>

          <div className="text-[11px] sm:text-sm text-zinc-400 order-3">
            {currentPage} / {totalPages}
          </div>
        </div>
      )}

      <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-zinc-900/50 rounded-lg border border-zinc-800">
        <div className="flex items-start gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-zinc-400">
          <span className="text-zinc-500 text-sm sm:text-base">💡</span>
          <div>
            <p className="mb-1">
              <span className="text-blue-400 font-medium">+</span>: 빗썸 비쌈 /
              <span className="text-orange-400 font-medium ml-1 sm:ml-2">-</span>: 업비트 비쌈
            </p>
            <p className="text-zinc-500">상승률 순 정렬, 실시간 업데이트</p>
          </div>
        </div>
      </div>
    </div>
  );
}
