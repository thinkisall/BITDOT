import { NextRequest, NextResponse } from "next/server";
import type { BTCRelativeStrengthSummary, CoinStrengthData } from "@/lib/box-breakout/calculators/btc-relative-strength";

async function fetchJson(url: string) {
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function getUpbitCandles(market: string, timeframe: string, count = 50) {
  const tfMap: Record<string, string> = {
    "1h": "minutes/60",
    "1d": "days",
  };
  const endpoint = tfMap[timeframe] || "minutes/60";
  const data = await fetchJson(
    `https://api.upbit.com/v1/candles/${endpoint}?market=${market}&count=${count}`
  );
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c: any) => ({
    close: c.trade_price,
    open: c.opening_price,
  }));
}

function calcChange(candles: { close: number; open: number }[]): number {
  if (candles.length < 2) return 0;
  const first = candles[0].close;
  const last = candles[candles.length - 1].close;
  return ((last - first) / first) * 100;
}

function getStatus(relativeStrength: number): CoinStrengthData["status"] {
  if (relativeStrength >= 5) return "강한 독립";
  if (relativeStrength >= 1) return "약한 독립";
  if (relativeStrength <= -5) return "역행";
  return "시장 추종";
}

function calcDecouplingScore(relativeStrength: number): number {
  const score = 50 + relativeStrength * 5;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timeframe = (searchParams.get("timeframe") as "1h" | "1d") || "1h";
  const symbolsParam = searchParams.get("symbols") || "";
  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No symbols provided" }, { status: 400 });
  }

  try {
    // BTC 데이터
    const btcCandles = await getUpbitCandles("KRW-BTC", timeframe, 50);
    const btcChange = calcChange(btcCandles);
    const btcCurrentPrice = btcCandles[btcCandles.length - 1]?.close ?? 0;

    // 각 코인 분석
    const coinResults = await Promise.allSettled(
      symbols.map(async (symbol): Promise<CoinStrengthData> => {
        const market = `KRW-${symbol}`;
        const candles = await getUpbitCandles(market, timeframe, 50);
        const coinChange = calcChange(candles);
        const relativeStrength = coinChange - btcChange;
        const decouplingScore = calcDecouplingScore(relativeStrength);
        return {
          symbol,
          coinChange: parseFloat(coinChange.toFixed(2)),
          relativeStrength: parseFloat(relativeStrength.toFixed(2)),
          decouplingScore,
          status: getStatus(relativeStrength),
        };
      })
    );

    const coins: CoinStrengthData[] = coinResults
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<CoinStrengthData>).value)
      .sort((a, b) => b.decouplingScore - a.decouplingScore);

    const summary = {
      avgDecouplingScore:
        coins.length > 0
          ? Math.round(coins.reduce((s, c) => s + c.decouplingScore, 0) / coins.length)
          : 0,
      strongIndependent: coins.filter((c) => c.status === "강한 독립").length,
      weakIndependent: coins.filter((c) => c.status === "약한 독립").length,
      contrarian: coins.filter((c) => c.status === "역행").length,
      marketFollowing: coins.filter((c) => c.status === "시장 추종").length,
    };

    const result: BTCRelativeStrengthSummary = {
      btcCurrentPrice,
      btcChange: parseFloat(btcChange.toFixed(2)),
      coins,
      summary,
    };

    return NextResponse.json({ data: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
