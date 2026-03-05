export interface ScoreDetails {
  totalScore: number;
  volumeScore: number;
  positionScore: number;
  ichimokuScore: number;
  maScore: number;
  passMinScore: boolean;
  rsiValue: number;
  rsiScore: number;
  ichimokuAboveCount: number;
  isBBSqueeze: boolean;
  bbSqueezeScore: number;
  isMA50Support: boolean;
  ma50SupportScore: number;
}

export interface TrendFilter {
  passTrendFilter: boolean;
  dailyAboveMA50: boolean;
  dailyGoldenArrangement: boolean;
  hourlyAboveMA50: boolean;
  hourlyMA50Support: boolean;
}

export interface BoxBreakoutSignal {
  symbol: string;
  exchange: "upbit" | "bithumb";
  currentPrice: number;
  quoteVolume: number;
  isBreakout: boolean;
  positionInBox: number;
  // Box levels
  boxTop: number;
  boxBottom: number;
  resistance: number;
  support: number;
  boxHeight: number;
  consolidationPeriods: number;
  // Trade plan
  buyPrice: number;
  stopLoss: number;
  profitTarget: number;
  targetPrice: number;
  profitPercent: number;
  riskPercent: number;
  // Signals
  volumeSurge: boolean;
  buySignal5m: boolean;
  signalGrade: "A" | "B" | "C";
  scoreDetails: ScoreDetails | null;
  ichimokuAboveCloudCount: number;
  btcDecouplingScore: number;
  // Optional extras
  vwma110_1h?: number;
  trendFilter?: TrendFilter;
  hasUpbitListing?: boolean;
  upbitVolumeRatio?: number;
  btcRelativeStatus?: string;
  multipleTargets?: {
    tp1: number;
    tp2?: number;
    tp3?: number;
    trailingStopBase?: number;
  };
  structuralStopLoss?: {
    maBasedStopLoss?: number;
    bbLowerStopLoss?: number;
    atrBasedStopLoss?: number;
    recommendedStopLoss: number;
  };
  breakoutQuality?: {
    isQualityBreakout: boolean;
    closePosition: number;
    bodyRatio: number;
    relativeVolume: number;
    atrBreakoutRatio: number;
    [key: string]: number | boolean | string;
  };
  retestInfo?: {
    hasRetest: boolean;
    retestPrice?: number;
    retestStrength?: number;
    [key: string]: number | boolean | string | undefined;
  };
  bollingerBands?: {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
    bandwidth?: number;
  };
  atr?: number;
  currentRsi?: number;
  resistanceTouchCount?: number;
  analyzedAt: number;
}

export interface AlphaToken {
  symbol: string;
  name?: string;
}

export interface ApiResponse<T> {
  signals: T[];
  lastUpdated: number;
  isAnalyzing: boolean;
  progress: {
    current: number;
    total: number;
  };
}
