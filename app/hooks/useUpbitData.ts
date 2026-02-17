'use client';

import { useEffect, useState, useRef } from 'react';
import { UpbitMarket, UpbitTicker } from '../types/market';

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
    const fetchMarkets = async () => {
      try {
        const response = await fetch('https://api.upbit.com/v1/market/all');
        const allMarkets: UpbitMarket[] = await response.json();
        const krwMarkets = allMarkets.filter(m => m.market.startsWith('KRW-'));
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
      // 이미 열려있는 소켓이 있으면 닫기
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }

      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Upbit WebSocket connected');
        reconnectAttempts.current = 0; // 성공 시 카운터 리셋
        setIsConnected(true);

        const subscribeMessage = [
          { ticket: 'bitdot' },
          {
            type: 'ticker',
            codes: marketList.map(m => m.market),
          },
        ];

        ws.send(JSON.stringify(subscribeMessage));
      };

      ws.onmessage = async (event) => {
        const blob = event.data;
        const text = await blob.text();
        const ticker: UpbitTicker = JSON.parse(text);

        if (ticker.type === 'ticker') {
          const marketCode = ticker.code || ticker.market;
          if (marketCode) {
            const symbol = marketCode.replace('KRW-', '');

            // 버퍼에 적재
            pendingUpdates.current.set(symbol, ticker);

            // 타이머가 없으면 200ms 뒤 일괄 flush
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

        // 지수 백오프: 1s → 2s → 4s → 8s → 16s → 30s(max)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;

        setTimeout(() => {
          if (marketList.length > 0) {
            connectWebSocket(marketList);
          }
        }, delay);
      };
    };

    const initialize = async () => {
      const marketList = await fetchMarkets();
      if (marketList.length > 0) {
        await fetchInitialTickers(marketList);
        connectWebSocket(marketList);
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
