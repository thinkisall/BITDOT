import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") || "";
  const interval = searchParams.get("interval") || "1h";
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  const tfMap: Record<string, string> = {
    "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1d": "24h",
  };
  const tf = tfMap[interval] || "1h";
  const cleanSymbol = symbol.replace("KRW", "").replace("/", "");

  try {
    const res = await fetch(
      `https://api.bithumb.com/public/candlestick/${cleanSymbol}_KRW/${tf}`,
      { next: { revalidate: 30 } }
    );
    const data = await res.json();

    if (data.status !== "0000" || !Array.isArray(data.data)) {
      return NextResponse.json([]);
    }

    const candles = data.data.slice(-limit).map((c: any[]) => ({
      time: Number(c[0]),
      open: parseFloat(c[1]),
      close: parseFloat(c[2]),
      high: parseFloat(c[3]),
      low: parseFloat(c[4]),
      volume: parseFloat(c[5]),
    }));

    return NextResponse.json(candles);
  } catch {
    return NextResponse.json([]);
  }
}
