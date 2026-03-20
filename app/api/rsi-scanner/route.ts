// app/api/rsi-scanner/route.ts
// 타입 정의만 유지 (실제 스캔은 홈서버 /api/ma-trend 에서 처리)

export interface MaTrendScanItem {
  symbol: string;
  market: string;
  exchange: "upbit" | "bithumb";
  currentPrice: number;
  volume: number;
  ma50_1h: number;
  ma110_1h: number;
  ma180_1h: number;
  ma50_4h: number;
  ma110_4h: number;
  ma180_4h: number;
  cloudTop_4h: number;
  cloudBottom_4h: number;
}

export interface MaTrendScanResponse {
  items: MaTrendScanItem[];
  scannedCount: number;
  matchedCount: number;
  scannedAt: string;
  fromCache?: boolean;
  isAnalyzing?: boolean;
}
