'use client';

import { useEffect, useState, useRef } from 'react';
import { UpbitMarket, UpbitTicker } from '../types/market';

export function useUpbitData() {
  const [data, setData] = useState<Map<string, UpbitTicker>>(new Map());
  const [markets, setMarkets] = useState<UpbitMarket[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Fetch market list
    const fetchMarkets = async () => {
      try {
        const response = await fetch('https://api.upbit.com/v1/market/all');
        const allMarkets: UpbitMarket[] = await response.json();

        // Filter only KRW markets
        const krwMarkets = allMarkets.filter(m => m.market.startsWith('KRW-'));
        setMarkets(krwMarkets);

        return krwMarkets;
      } catch (error) {
        console.error('Upbit market fetch error:', error);
        return [];
      }
    };

    // Fetch initial ticker data
    const fetchInitialTickers = async (marketList: UpbitMarket[]) => {
      try {
        const marketCodes = marketList.map(m => m.market).join(',');
        const response = await fetch(`https://api.upbit.com/v1/ticker?markets=${marketCodes}`);
        const tickers: UpbitTicker[] = await response.json();

        const tickerMap = new Map<string, UpbitTicker>();
        tickers.forEach(ticker => {
          // REST API uses 'market' field
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

    // Connect to WebSocket
    const connectWebSocket = (marketList: UpbitMarket[]) => {
      const ws = new WebSocket('wss://api.upbit.com/websocket/v1');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Upbit WebSocket connected');
        setIsConnected(true);

        // Subscribe to all KRW markets
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
          // WebSocket uses 'code' field
          const marketCode = ticker.code || ticker.market;
          if (marketCode) {
            const symbol = marketCode.replace('KRW-', '');
            setData(prev => new Map(prev).set(symbol, ticker));
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

        // Reconnect after 5 seconds
        setTimeout(() => {
          if (marketList.length > 0) {
            connectWebSocket(marketList);
          }
        }, 5000);
      };
    };

    // Initialize
    const initialize = async () => {
      const marketList = await fetchMarkets();
      if (marketList.length > 0) {
        await fetchInitialTickers(marketList);
        connectWebSocket(marketList);
      }
    };

    initialize();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return { data, markets, isConnected };
}
