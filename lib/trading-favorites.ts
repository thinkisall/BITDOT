const STORAGE_KEY = "trading_favorites";

export interface TradingFavorite {
  symbol: string;
  source: string;
  entryPrice?: number;
  stopLoss?: number;
  addedAt: number;
}

function dispatch() {
  window.dispatchEvent(new Event("trading-favorites-changed"));
}

export function getTradingFavorites(): TradingFavorite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addTradingFavorite(fav: TradingFavorite): void {
  const favs = getTradingFavorites();
  const exists = favs.some((f) => f.symbol === fav.symbol);
  if (!exists) {
    favs.push(fav);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
    dispatch();
  }
}

export function removeTradingFavorite(symbol: string): void {
  const favs = getTradingFavorites().filter((f) => f.symbol !== symbol);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  dispatch();
}

export function isTradingFavorite(symbol: string): boolean {
  return getTradingFavorites().some((f) => f.symbol === symbol);
}
