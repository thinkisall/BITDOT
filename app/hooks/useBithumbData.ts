'use client';

import { useEffect, useState } from 'react';
import { BithumbResponse, BithumbTicker } from '../types/market';

export function useBithumbData() {
  const [data, setData] = useState<Map<string, BithumbTicker>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Fetch initial data
    const fetchInitialData = async () => {
      try {
        const response = await fetch('https://api.bithumb.com/public/ticker/ALL_KRW');
        const json: BithumbResponse = await response.json();

        if (json.status === '0000' && json.data) {
          const tickerMap = new Map<string, BithumbTicker>();

          Object.entries(json.data).forEach(([symbol, ticker]) => {
            if (symbol !== 'date' && typeof ticker === 'object') {
              tickerMap.set(symbol, ticker as BithumbTicker);
            }
          });

          setData(tickerMap);
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Bithumb API error:', error);
      }
    };

    fetchInitialData();

    // Update every 5 seconds
    const interval = setInterval(fetchInitialData, 5000);

    return () => clearInterval(interval);
  }, []);

  return { data, isConnected };
}
