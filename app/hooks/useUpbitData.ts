'use client';

import { useEffect, useState, useRef } from 'react';
import { UpbitMarket, UpbitTicker } from '../types/market';

const MARKETS_CACHE_KEY = 'upbit_markets';
const MARKETS_CACHE_TTL = 60 * 60 * 1000; // 1시간

function getCachedMarkets(): UpbitMarket[] | null {
  try {
    const raw = localStorage.getItem(MARKETS_CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > MARKETS_CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCachedMarkets(markets: UpbitMarket[]) {
  try {
    localStorage.setItem(MARKETS_CACHE_KEY, JSON.stringify({ data: markets, ts: Date.now() }));
  } catch {}
}

export function useUpbitData() {
  const [data, setData] = useState<Map<string, UpbitTicker>>(new Map());
  const [markets, setMarkets] = useState<UpbitMarket[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // 200ms 배치 처리용 버퍼
  const pendingUpdates = useRef<Map<string, UpbitTicker>>(new Map());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 지수 백오프 재연결용
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    const fetchMarkets = async (): Promise<UpbitMarket[]> => {
      try {
        const response = await fetch('https://api.upbit.com/v1/market/all');
        const allMarkets: UpbitMarket[] = await response.json();
        const krwMarkets = allMarkets.filter(m => m.market.startsWith('KRW-'));
        setCachedMarkets(krwMarkets);
        setMarkets(krwMarkets);
        return krwMarkets;
      } catch (error) {
        console.error('Upbit market fetch error:', error);
        return [];
      }
    };

    const fetchInitialTickers = async (marketList: UpbitMarket[]) => {
      try {
        const marketCodes = marketList.map(m => m.market).join(',');
        const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);
        const tickers: UpbitTicker[] = await response.json();

        const tickerMap = new Map<string, UpbitTicker>();
        tickers.forEach(ticker => {
          const marketCode = ticker.market || ticker.code;
          if (marketCode) {
            const symbol = marketCode.replace('KRW-', '');
            tickerMap.set(symbol, ticker);
          }
        });

        setData(tickerMap);
      } catch (error) {
        console.error('Upbit ticker fetch error:', error);
      }
    };

    const connectWebSocket = (marketList: UpbitMarket[]) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Upbit WebSocket connected');
        reconnectAttempts.current = 0;
        setIsConnected(true);

        ws.send(JSON.stringify([
          { ticket: 'bitdot' },
          { type: 'ticker', codes: marketList.map(m => m.market) },
        ]));
      };

      const processMessage = (text: string) => {
        try {
          const ticker: UpbitTicker = JSON.parse(text);
          if (ticker.type === 'ticker') {
            const marketCode = ticker.code || ticker.market;
            if (marketCode) {
              const symbol = marketCode.replace('KRW-', '');
              pendingUpdates.current.set(symbol, ticker);

              if (!flushTimer.current) {
                flushTimer.current = setTimeout(() => {
                  const batch = new Map(pendingUpdates.current);
                  pendingUpdates.current.clear();
                  flushTimer.current = null;

                  setData(prev => {
                    const next = new Map(prev);
                    batch.forEach((v, k) => next.set(k, v));
                    return next;
                  });
                }, 200);
              }
            }
          }
        } catch {}
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          processMessage(event.data);
        } else {
          (event.data as Blob).text().then(processMessage);
        }
      };

      ws.onerror = (error) => {
        console.error('Upbit WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('Upbit WebSocket disconnected');
        setIsConnected(false);

        if (flushTimer.current) {
          clearTimeout(flushTimer.current);
          flushTimer.current = null;
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        setTimeout(() => {
          if (marketList.length > 0) connectWebSocket(marketList);
        }, delay);
      };
    };

    const initialize = async () => {
      const cached = getCachedMarkets();

      if (cached && cached.length > 0) {
        // 캐시 히트: 즉시 티커 fetch + WebSocket 동시 시작
        setMarkets(cached);
        fetchInitialTickers(cached);   // await 없이 병렬
        connectWebSocket(cached);
        // 백그라운드에서 캐시 갱신
        fetchMarkets();
      } else {
        // 캐시 미스: markets fetch 후 티커 + WebSocket 동시 시작
        const marketList = await fetchMarkets();
        if (marketList.length > 0) {
          fetchInitialTickers(marketList);  // await 없이 병렬
          connectWebSocket(marketList);
        }
      }
    };

    initialize();

    return () => {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { data, markets, isConnected };
}
