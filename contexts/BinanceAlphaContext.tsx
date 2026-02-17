'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface BinanceAlphaContextType {
  symbols: string[];
  isAlpha: (symbol: string) => boolean;
}

const BinanceAlphaContext = createContext<BinanceAlphaContextType>({
  symbols: [],
  isAlpha: () => false,
});

export const useBinanceAlpha = () => useContext(BinanceAlphaContext);

export function BinanceAlphaProvider({ children }: { children: ReactNode }) {
  const [symbols, setSymbols] = useState<string[]>([]);
  // 대소문자 무관 빠른 검색용 Set
  const [symbolSet, setSymbolSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/api/binance-alpha')
      .then(res => res.json())
      .then(data => {
        if (data.symbols) {
          setSymbols(data.symbols);
          setSymbolSet(new Set(data.symbols.map((s: string) => s.toUpperCase())));
        }
      })
      .catch(err => console.error('Failed to fetch Binance Alpha symbols:', err));
  }, []);

  const isAlpha = (symbol: string) => symbolSet.has(symbol.toUpperCase());

  return (
    <BinanceAlphaContext.Provider value={{ symbols, isAlpha }}>
      {children}
    </BinanceAlphaContext.Provider>
  );
}
