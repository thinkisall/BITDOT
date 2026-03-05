export interface CoinStrengthData {
  symbol: string;
  coinChange: number;
  relativeStrength: number;
  decouplingScore: number;
  status: "강한 독립" | "약한 독립" | "역행" | "시장 추종";
}

export interface BTCRelativeStrengthSummary {
  btcCurrentPrice: number;
  btcChange: number;
  coins: CoinStrengthData[];
  summary: {
    avgDecouplingScore: number;
    strongIndependent: number;
    weakIndependent: number;
    contrarian: number;
    marketFollowing: number;
  };
}
