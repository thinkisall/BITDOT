export interface BithumbTicker {
  opening_price: string;
  closing_price: string;
  min_price: string;
  max_price: string;
  units_traded: string;
  acc_trade_value: string;
  prev_closing_price: string;
  units_traded_24H: string;
  acc_trade_value_24H: string;
  fluctate_24H: string;
  fluctate_rate_24H: string;
}

export interface BithumbResponse {
  status: string;
  data: {
    [key: string]: BithumbTicker | string;
  };
}

export interface UpbitMarket {
  market: string;
  korean_name: string;
  english_name: string;
}

export interface UpbitTicker {
  type?: string;
  code?: string; // WebSocket only
  market?: string; // REST API only
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  prev_closing_price: number;
  acc_trade_price_24h: number;
  change: string;
  change_price: number;
  change_rate: number;
  signed_change_price: number;
  signed_change_rate: number;
  trade_volume: number;
  acc_trade_volume: number;
  acc_trade_volume_24h: number;
  highest_52_week_price: number;
  highest_52_week_date: string;
  lowest_52_week_price: number;
  lowest_52_week_date: string;
  timestamp: number;
}

export interface CoinData {
  symbol: string;
  name: string;
  bithumb: {
    price: number;
    change: number;
    changeRate: number;
    volume: number;
  } | null;
  upbit: {
    price: number;
    change: number;
    changeRate: number;
    volume: number;
  } | null;
  priceDiff: number;
  avgChangeRate: number;
}
