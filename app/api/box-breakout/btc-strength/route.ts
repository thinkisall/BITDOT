import { NextRequest, NextResponse } from "next/server";
import type {
  BTCRelativeStrengthSummary,
  CoinStrengthData,
} from "@/lib/box-breakout/calculators/btc-relative-strength";

const UPBIT_BASE = "https://api.upbit.com/v1";

// ─── Upbit 티커 조회 (1d 변화율) ──────────────────────────────────
async function fetchTickerChanges(
  markets: string[]
): Promise<Record<string, { currentPrice: number; change: number }>> {
  const res = await fetch(
    `${UPBIT_BASE}/ticker?markets=${markets.join(",")}`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error(`Upbit ticker ${res.status}`);
  const data = await res.json();

  const result: Record<string, { currentPrice: number; change: number }> = {};
  for (const item of data) {
    result[item.market] = {
      currentPrice: item.trade_price,
      change: item.signed_change_rate * 100,
    };
  }
  return result;
}

// ─── Upbit 1시간봉 변화율 조회 ────────────────────────────────────
async function fetchHourlyChange(
  market: string
): Promise<{ currentPrice: number; change: number }> {
  const res = await fetch(
    `${UPBIT_BASE}/candles/minutes/60?market=${market}&count=2`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) throw new Error(`Upbit candles ${res.status} for ${market}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length < 2) {
    throw new Error(`Insufficient candle data for ${market}`);
  }
  // data[0] = 최신 캔들, data[1] = 직전 캔들
  const current = data[0].trade_price;
  const prev = data[1].trade_price;
  return {
    currentPrice: current,
    change: ((current - prev) / prev) * 100,
  };
}

// ─── 상대강도 분석 ────────────────────────────────────────────────
function calcStatus(
  coinChange: number,
  btcChange: number,
  relativeStrength: number
): CoinStrengthData["status"] {
  // BTC와 반대 방향으로 움직이는 경우
  if (btcChange * coinChange < 0) return "역행";
  // 같은 방향이지만 코인이 크게 아웃퍼폼
  if (relativeStrength >= 3) return "강한 독립";
  if (relativeStrength >= 1) return "약한 독립";
  return "시장 추종";
}

function calcDecouplingScore(
  coinChange: number,
  btcChange: number,
  relativeStrength: number
): number {
  // 반대 방향이면 기본 점수 40 + 상대강도 절대값으로 추가
  if (btcChange * coinChange < 0) {
    return Math.min(40 + Math.round(Math.abs(relativeStrength) * 6), 100);
  }
  // 같은 방향: 상대강도 크기로 점수
  return Math.min(Math.round(Math.abs(relativeStrength) * 10), 100);
}

// ─── Route Handler ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const timeframe = (searchParams.get("timeframe") || "1h") as "1h" | "1d";
  const symbolsParam = searchParams.get("symbols") || "";

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .filter((s) => s !== "BTC")
    .slice(0, 30);

  if (symbols.length === 0) {
    return NextResponse.json(
      { error: "No symbols provided" },
      { status: 400 }
    );
  }

  const btcMarket = "KRW-BTC";
  const coinMarkets = symbols.map((s) => `KRW-${s}`);
  const allMarkets = [btcMarket, ...coinMarkets];

  try {
    let btcData: { currentPrice: number; change: number };
    let coinDataMap: Record<string, { currentPrice: number; change: number }>;

    if (timeframe === "1d") {
      // 1일 변화율: 티커 API 한 번에 조회
      const tickerMap = await fetchTickerChanges(allMarkets);
      btcData = tickerMap[btcMarket] ?? { currentPrice: 0, change: 0 };
      coinDataMap = Object.fromEntries(
        coinMarkets.map((m) => [m, tickerMap[m] ?? { currentPrice: 0, change: 0 }])
      );
    } else {
      // 1시간 변화율: 각 종목 캔들 병렬 조회
      const [btcResult, ...coinResults] = await Promise.allSettled([
        fetchHourlyChange(btcMarket),
        ...coinMarkets.map((m) => fetchHourlyChange(m)),
      ]);

      btcData =
        btcResult.status === "fulfilled"
          ? btcResult.value
          : { currentPrice: 0, change: 0 };

      coinDataMap = Object.fromEntries(
        coinMarkets.map((market, i) => [
          market,
          coinResults[i].status === "fulfilled"
            ? (coinResults[i] as PromiseFulfilledResult<{ currentPrice: number; change: number }>).value
            : { currentPrice: 0, change: 0 },
        ])
      );
    }

    const btcChange = btcData.change;

    // 각 코인별 상대강도 계산
    const coins: CoinStrengthData[] = symbols.map((symbol) => {
      const market = `KRW-${symbol}`;
      const coinChange = coinDataMap[market]?.change ?? 0;
      const relativeStrength = Math.round((coinChange - btcChange) * 100) / 100;
      const decouplingScore = calcDecouplingScore(coinChange, btcChange, relativeStrength);
      const status = calcStatus(coinChange, btcChange, relativeStrength);

      return {
        symbol,
        coinChange: Math.round(coinChange * 100) / 100,
        relativeStrength,
        decouplingScore,
        status,
      };
    });

    // 독립성 점수 내림차순 정렬
    coins.sort((a, b) => b.decouplingScore - a.decouplingScore);

    const avgDecouplingScore =
      coins.length > 0
        ? Math.round(coins.reduce((sum, c) => sum + c.decouplingScore, 0) / coins.length)
        : 0;

    const summary: BTCRelativeStrengthSummary["summary"] = {
      avgDecouplingScore,
      strongIndependent: coins.filter((c) => c.status === "강한 독립").length,
      weakIndependent: coins.filter((c) => c.status === "약한 독립").length,
      contrarian: coins.filter((c) => c.status === "역행").length,
      marketFollowing: coins.filter((c) => c.status === "시장 추종").length,
    };

    const result: BTCRelativeStrengthSummary = {
      btcCurrentPrice: btcData.currentPrice,
      btcChange: Math.round(btcChange * 100) / 100,
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
