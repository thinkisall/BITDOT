import { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import { BoxBreakoutSignal, AlphaToken, ApiResponse } from "@/shared/types";
import { getHomeServerUrl } from "@/lib/home-server";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const homeServerFetcher = (url: string) => fetch(getHomeServerUrl(url)).then((r) => r.json());

export function useBoxBreakoutData() {
  const [signals, setSignals] = useState<BoxBreakoutSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [exchange, setExchange] = useState<'bithumb' | 'bybit'>('bithumb');

  const { data: alphaData } = useSWR<AlphaToken[]>(
    "/api/binance-alpha",
    fetcher,
    {
      refreshInterval: 0,
      dedupingInterval: 300000,
      revalidateOnFocus: false, // 탭 전환 시 불필요한 재요청 방지
      revalidateOnReconnect: false,
    }
  );

  const fetchData = useCallback(async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) setLoading(true);

      // 홈서버에서 무거운 연산 처리
      const res = await fetch(getHomeServerUrl(`/api/box-breakout?timeframe=${timeframe}&exchange=${exchange}`));
      const data: ApiResponse<BoxBreakoutSignal> = await res.json();

      if (data.signals) setSignals(data.signals);
      setLastUpdated(data.lastUpdated || 0);
      setIsAnalyzing(data.isAnalyzing || false);
      setProgress(data.progress || { current: 0, total: 0 });
    } catch (error) {
      console.error("Failed to fetch box breakout data:", error);
    } finally {
      if (isInitialLoad) setLoading(false);
      setIsRefreshing(false);
    }
  }, [timeframe, exchange]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchData(false);
  }, [fetchData]);

  // 알파 토큰 체크 함수
  const alphaSymbolSet = useMemo(() => {
    if (!alphaData) return new Set<string>();
    return new Set(
      alphaData.map((t) => t.symbol.replace("USDT", "").toUpperCase())
    );
  }, [alphaData]);

  const isAlphaToken = useCallback(
    (symbol: string) => {
      const clean = symbol.replace("USDT", "").toUpperCase();
      return alphaSymbolSet.has(clean);
    },
    [alphaSymbolSet]
  );

  return {
    signals,
    loading,
    isRefreshing,
    isAnalyzing,
    progress,
    lastUpdated,
    timeframe,
    setTimeframe,
    exchange,
    setExchange,
    setSignals,
    fetchData,
    handleRefresh,
    isAlphaToken,
  };
}
