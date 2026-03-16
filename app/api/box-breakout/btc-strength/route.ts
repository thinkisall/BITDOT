import { NextRequest, NextResponse } from "next/server";

// ─── 상수 ─────────────────────────────────────────────────────────
const SMA_PERIOD = 50;
const SMA_CONSECUTIVE = 1;

const WINDOW_30M = 96;
const SLOPE_TH_30M = 0.004;

const WINDOW_1H = 96;
const SLOPE_TH_1H = 0.003;

const WINDOW_4H = 60;
const SLOPE_TH_4H = 0.002;

const ATR_PERIOD = 14;
const PIVOT_LOOKBACK = 2;
const CLUSTER_ATR_MULT = 0.8;
const TOUCH_ATR_MULT = 0.4;
const OUTSIDE_ATR_MULT = 1.0;
const MIN_INSIDE_RATIO = 0.75;

const BREAKOUT_SKIP_CANDLES = [1, 3, 5, 8];
const MIN_BREAKOUT_PCT = 0.3;

const WIDTH_THRESHOLD = 0.12;
const MIN_UPPER_TOUCHES = 2;
const MIN_LOWER_TOUCHES = 2;

// ─── 타입 ─────────────────────────────────────────────────────────
interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface BoxResult {
  upper_close: number;
  lower_open: number;
  lower_low: number;
  lower_close: number;
  width_open_pct: number;
  width_low_pct: number;
  width_close_pct: number;
  upper_touches: number;
  lower_open_touches: number;
  lower_low_touches: number;
  lower_close_touches: number;
  slope: number;
  inside_ratio_open: number;
  inside_ratio_low: number;
  inside_ratio_close: number;
  score_open: number;
  score_low: number;
  score_close: number;
  rep_score: number;
  breakout_pct?: number;
}

export interface ScanResult {
  market: string;
  selected_tf: string;
  rep_score: number;
  score_open: number;
  score_low: number;
  upper_close: number;
  lower_open: number;
  lower_low: number;
  width_open_pct: number;
  width_low_pct: number;
  upper_touches: number;
  lower_open_touches: number;
  lower_low_touches: number;
  sma50_value: number;
  sma50_consecutive: number;
  slope: number;
  reason: string;
}

// ─── Upbit 캔들 조회 ──────────────────────────────────────────────
async function fetchCandles(
  market: string,
  interval: string,
  count: number,
): Promise<Candle[]> {
  const url = `https://api.upbit.com/v1/candles/${interval}?market=${market}&count=${count}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Upbit HTTP ${res.status} for ${market}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.reverse().map((c: any) => ({
    open: c.opening_price,
    high: c.high_price,
    low: c.low_price,
    close: c.trade_price,
  }));
}

// ─── ATR (Wilder) ─────────────────────────────────────────────────
function calcAtr(candles: Candle[], period = ATR_PERIOD): number {
  if (candles.length < period + 1) return 0;

  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    tr.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close),
      ),
    );
  }

  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < tr.length; i++) {
    atr = (atr * (period - 1) + tr[i]) / period;
  }
  return atr;
}

// ─── 피봇 추출 ────────────────────────────────────────────────────
function extractPivotsHigh(
  prices: number[],
  lookback = PIVOT_LOOKBACK,
): number[] {
  const pivots: number[] = [];
  for (let i = lookback; i < prices.length - lookback; i++) {
    let ok = true;
    for (let k = 1; k <= lookback; k++) {
      if (prices[i - k] >= prices[i] || prices[i + k] >= prices[i]) {
        ok = false;
        break;
      }
    }
    if (ok) pivots.push(prices[i]);
  }
  return pivots;
}

function extractPivotsLow(
  prices: number[],
  lookback = PIVOT_LOOKBACK,
): number[] {
  const pivots: number[] = [];
  for (let i = lookback; i < prices.length - lookback; i++) {
    let ok = true;
    for (let k = 1; k <= lookback; k++) {
      if (prices[i - k] <= prices[i] || prices[i + k] <= prices[i]) {
        ok = false;
        break;
      }
    }
    if (ok) pivots.push(prices[i]);
  }
  return pivots;
}

// ─── ATR 기반 클러스터링 ──────────────────────────────────────────
function clusterLevels(
  values: number[],
  dist: number,
): Array<{ level: number; count: number }> {
  if (values.length === 0) return [];

  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const cur = clusters[clusters.length - 1];
    if (sorted[i] - cur[cur.length - 1] <= dist) {
      cur.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  return clusters
    .map((c) => ({
      level: c.reduce((a, b) => a + b, 0) / c.length,
      count: c.length,
    }))
    .sort((a, b) => b.count - a.count);
}

// ─── SMA50 필터 ───────────────────────────────────────────────────
function checkSma50Filter(
  candles: Candle[],
  period = SMA_PERIOD,
  k = SMA_CONSECUTIVE,
): { pass: boolean; sma50Value: number; consecutive: number } {
  const closes = candles.map((c) => c.close);
  if (closes.length < period + k) return { pass: false, sma50Value: 0, consecutive: 0 };

  // rolling SMA
  const sma: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += closes[j];
    sma.push(sum / period);
  }
  if (sma.length < k) return { pass: false, sma50Value: 0, consecutive: 0 };

  const sma50Value = sma[sma.length - 1];

  // k연속 상회 확인
  for (let i = 1; i <= k; i++) {
    if (closes[closes.length - i] <= sma[sma.length - i]) {
      return { pass: false, sma50Value, consecutive: 0 };
    }
  }

  // 총 연속 상회 횟수
  let consecutive = 0;
  for (let i = 1; i <= sma.length; i++) {
    if (closes[closes.length - i] > sma[sma.length - i]) {
      consecutive++;
    } else {
      break;
    }
  }

  return { pass: true, sma50Value, consecutive };
}

// ─── 박스권 판정 (ATR + 피봇 + 클러스터링) ───────────────────────
function detectBox(
  candles: Candle[],
  window: number,
  widthThreshold: number,
  slopeThreshold: number,
  minUpperTouches = MIN_UPPER_TOUCHES,
  minLowerTouches = MIN_LOWER_TOUCHES,
): BoxResult | null {
  if (candles.length < window) return null;

  const seg = candles.slice(-window);
  const closes = seg.map((c) => c.close);
  const opens = seg.map((c) => c.open);
  const lows = seg.map((c) => c.low);
  const highs = seg.map((c) => c.high);
  const n = closes.length;

  const atr = calcAtr(seg);
  if (atr <= 0) return null;

  const clusterDist = atr * CLUSTER_ATR_MULT;
  const touchTol = atr * TOUCH_ATR_MULT;
  const outsideTol = atr * OUTSIDE_ATR_MULT;

  // 피봇 추출
  const pivotHighs = extractPivotsHigh(closes);
  const pivotLowsOpen = extractPivotsLow(opens);
  const pivotLowsLow = extractPivotsLow(lows);
  const pivotLowsClose = extractPivotsLow(closes);

  if (pivotHighs.length < 2) return null;

  // 클러스터링
  const resClusters = clusterLevels(pivotHighs, clusterDist);
  const supOpenClusters = clusterLevels(pivotLowsOpen, clusterDist);
  const supLowClusters = clusterLevels(pivotLowsLow, clusterDist);
  const supCloseClusters = clusterLevels(pivotLowsClose, clusterDist);

  if (resClusters.length === 0) return null;

  const upperClose = resClusters[0].level;
  let lowerOpen: number | null = supOpenClusters[0]?.level ?? null;
  let lowerLow: number | null = supLowClusters[0]?.level ?? null;
  let lowerClose: number | null = supCloseClusters[0]?.level ?? null;

  if (lowerOpen === null && lowerLow === null && lowerClose === null) return null;

  // 상단 < 하단 무효처리
  if (lowerOpen !== null && upperClose <= lowerOpen) lowerOpen = null;
  if (lowerLow !== null && upperClose <= lowerLow) lowerLow = null;
  if (lowerClose !== null && upperClose <= lowerClose) lowerClose = null;

  if (lowerOpen === null && lowerLow === null && lowerClose === null) return null;

  // 박스폭 검증 (12% 이내)
  const widthOpenPct =
    lowerOpen !== null && lowerOpen > 0 ? (upperClose - lowerOpen) / lowerOpen : 0;
  const widthLowPct =
    lowerLow !== null && lowerLow > 0 ? (upperClose - lowerLow) / lowerLow : 0;
  const widthClosePct =
    lowerClose !== null && lowerClose > 0 ? (upperClose - lowerClose) / lowerClose : 0;

  const openWidthOk = lowerOpen !== null && widthOpenPct <= widthThreshold;
  const lowWidthOk = lowerLow !== null && widthLowPct <= widthThreshold;
  const closeWidthOk = lowerClose !== null && widthClosePct <= widthThreshold;

  if (!openWidthOk && !lowWidthOk && !closeWidthOk) return null;

  // 기울기 검증 (선형회귀)
  const xMean = (n - 1) / 2;
  const yMean = closes.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (closes[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const rawSlope = den !== 0 ? num / den : 0;
  const normalizedSlope = yMean > 0 ? rawSlope / yMean : 0;

  if (Math.abs(normalizedSlope) > slopeThreshold) return null;

  // 터치 카운트
  const upperTouches = closes.filter((c) => Math.abs(c - upperClose) <= touchTol).length;
  const lowerOpenTouches =
    lowerOpen !== null
      ? opens.filter((o) => Math.abs(o - lowerOpen!) <= touchTol).length
      : 0;
  const lowerLowTouches =
    lowerLow !== null
      ? lows.filter((l) => Math.abs(l - lowerLow!) <= touchTol).length
      : 0;
  const lowerCloseTouches =
    lowerClose !== null
      ? closes.filter((c) => Math.abs(c - lowerClose!) <= touchTol).length
      : 0;

  const openTouchesOk =
    lowerOpen !== null &&
    upperTouches >= minUpperTouches &&
    lowerOpenTouches >= minLowerTouches;
  const lowTouchesOk =
    lowerLow !== null &&
    upperTouches >= minUpperTouches &&
    lowerLowTouches >= minLowerTouches;
  const closeTouchesOk =
    lowerClose !== null &&
    upperTouches >= minUpperTouches &&
    lowerCloseTouches >= minLowerTouches;

  if (!openTouchesOk && !lowTouchesOk && !closeTouchesOk) return null;

  // 내부 비율 검증 (ATR 기반, 75%+)
  const insideRatioOpen =
    lowerOpen !== null
      ? opens.filter((o, i) => o >= lowerOpen! - outsideTol && closes[i] <= upperClose + outsideTol)
          .length / n
      : 0;
  const insideRatioLow =
    lowerLow !== null
      ? lows.filter((l, i) => l >= lowerLow! - outsideTol && highs[i] <= upperClose + outsideTol)
          .length / n
      : 0;
  const insideRatioClose =
    lowerClose !== null
      ? closes.filter((c) => c >= lowerClose! - outsideTol && c <= upperClose + outsideTol).length /
        n
      : 0;

  // 점수 산출
  const slopeBonus =
    slopeThreshold > 0 ? 1.0 - Math.abs(normalizedSlope) / slopeThreshold : 0;

  let scoreOpen = 0;
  if (openWidthOk && openTouchesOk && insideRatioOpen >= MIN_INSIDE_RATIO) {
    const ts = Math.min((upperTouches + lowerOpenTouches) / 8, 1);
    scoreOpen =
      Math.round((ts * 40 + insideRatioOpen * 40 + slopeBonus * 20) * 100) / 100;
  }

  let scoreLow = 0;
  if (lowWidthOk && lowTouchesOk && insideRatioLow >= MIN_INSIDE_RATIO) {
    const ts = Math.min((upperTouches + lowerLowTouches) / 8, 1);
    scoreLow =
      Math.round((ts * 40 + insideRatioLow * 40 + slopeBonus * 20) * 100) / 100;
  }

  let scoreClose = 0;
  if (closeWidthOk && closeTouchesOk && insideRatioClose >= MIN_INSIDE_RATIO) {
    const ts = Math.min((upperTouches + lowerCloseTouches) / 8, 1);
    scoreClose =
      Math.round((ts * 40 + insideRatioClose * 40 + slopeBonus * 20) * 100) / 100;
  }

  if (scoreOpen <= 0 && scoreLow <= 0 && scoreClose <= 0) return null;

  // rep_score = 유효 점수 중 최소값 (보수적 기준)
  const validScores = [scoreOpen, scoreLow, scoreClose].filter((s) => s > 0);
  const repScore = Math.min(...validScores);

  // None → 다른 값으로 채움 (DB 스키마 호환)
  const finalLowerOpen = lowerOpen ?? lowerClose ?? lowerLow!;
  const finalLowerLow = lowerLow ?? lowerClose ?? lowerOpen!;
  const finalLowerClose = lowerClose ?? lowerOpen ?? lowerLow!;

  return {
    upper_close: upperClose,
    lower_open: finalLowerOpen,
    lower_low: finalLowerLow,
    lower_close: finalLowerClose,
    width_open_pct: Math.round(widthOpenPct * 100 * 10000) / 10000,
    width_low_pct: Math.round(widthLowPct * 100 * 10000) / 10000,
    width_close_pct: Math.round(widthClosePct * 100 * 10000) / 10000,
    upper_touches: upperTouches,
    lower_open_touches: lowerOpenTouches,
    lower_low_touches: lowerLowTouches,
    lower_close_touches: lowerCloseTouches,
    slope: Math.round(normalizedSlope * 1e6) / 1e6,
    inside_ratio_open: Math.round(insideRatioOpen * 10000) / 10000,
    inside_ratio_low: Math.round(insideRatioLow * 10000) / 10000,
    inside_ratio_close: Math.round(insideRatioClose * 10000) / 10000,
    score_open: scoreOpen,
    score_low: scoreLow,
    score_close: scoreClose,
    rep_score: repScore,
  };
}

// ─── 돌파 감지 ────────────────────────────────────────────────────
function detectBreakout(
  candles: Candle[],
  window: number,
  widthThreshold: number,
  slopeThreshold: number,
): BoxResult | null {
  const currentClose = candles[candles.length - 1].close;

  for (const skip of BREAKOUT_SKIP_CANDLES) {
    if (candles.length < window + skip) continue;

    const hist = candles.slice(0, -skip);
    const box = detectBox(hist, window, widthThreshold, slopeThreshold);

    if (box && currentClose > box.upper_close) {
      const breakoutPct = ((currentClose - box.upper_close) / box.upper_close) * 100;
      if (breakoutPct >= MIN_BREAKOUT_PCT) {
        return { ...box, breakout_pct: Math.round(breakoutPct * 100) / 100 };
      }
    }
  }

  return null;
}

// ─── 결과 빌더 ────────────────────────────────────────────────────
function buildResult(
  market: string,
  selectedTf: string,
  box: BoxResult,
  sma50Value: number,
  sma50Consecutive: number,
  reason: string,
): ScanResult {
  return {
    market,
    selected_tf: selectedTf,
    rep_score: box.rep_score,
    score_open: box.score_open,
    score_low: box.score_low,
    upper_close: box.upper_close,
    lower_open: box.lower_open,
    lower_low: box.lower_low,
    width_open_pct: box.width_open_pct,
    width_low_pct: box.width_low_pct,
    upper_touches: box.upper_touches,
    lower_open_touches: box.lower_open_touches,
    lower_low_touches: box.lower_low_touches,
    sma50_value: sma50Value,
    sma50_consecutive: sma50Consecutive,
    slope: box.slope,
    reason,
  };
}

// ─── 종목 평가 파이프라인 ─────────────────────────────────────────
function evaluateCoin(
  candles30m: Candle[],
  candles1h: Candle[],
  candles4h: Candle[],
  market: string,
): ScanResult | null {
  // Step 1: SMA50 필터 (1h)
  if (candles1h.length < SMA_PERIOD + SMA_CONSECUTIVE + WINDOW_1H) return null;

  const { pass, sma50Value, consecutive } = checkSma50Filter(candles1h);
  if (!pass) return null;

  const currentClose = candles1h[candles1h.length - 1].close;
  const has30m = candles30m.length >= SMA_PERIOD + WINDOW_30M;
  const has4h = candles4h.length >= SMA_PERIOD + WINDOW_4H;

  // Step 2: 30m 박스 판정
  if (has30m) {
    const box30m = detectBox(candles30m, WINDOW_30M, WIDTH_THRESHOLD, SLOPE_TH_30M);
    if (box30m && box30m.rep_score > 0) {
      const last30m = candles30m[candles30m.length - 1].close;
      if (last30m > box30m.upper_close) {
        const bp = ((last30m - box30m.upper_close) / box30m.upper_close) * 100;
        if (bp >= MIN_BREAKOUT_PCT) {
          return buildResult(market, "30m", box30m, sma50Value, consecutive, "30m_breakout");
        }
      } else {
        return buildResult(market, "30m", box30m, sma50Value, consecutive, "30m_pass");
      }
    }
  }

  // Step 3: 1h 박스 판정
  const box1h = detectBox(candles1h, WINDOW_1H, WIDTH_THRESHOLD, SLOPE_TH_1H);
  if (box1h && box1h.rep_score > 0) {
    if (currentClose > box1h.upper_close) {
      const bp = ((currentClose - box1h.upper_close) / box1h.upper_close) * 100;
      if (bp >= MIN_BREAKOUT_PCT) {
        return buildResult(market, "1h", box1h, sma50Value, consecutive, "1h_breakout");
      }
    } else {
      return buildResult(market, "1h", box1h, sma50Value, consecutive, "1h_pass");
    }
  }

  // Step 4: 4h 박스 폴백
  if (has4h) {
    const box4h = detectBox(candles4h, WINDOW_4H, WIDTH_THRESHOLD, SLOPE_TH_4H);
    if (box4h && box4h.rep_score > 0) {
      if (currentClose > box4h.upper_close) {
        const bp = ((currentClose - box4h.upper_close) / box4h.upper_close) * 100;
        if (bp >= MIN_BREAKOUT_PCT) {
          return buildResult(market, "4h", box4h, sma50Value, consecutive, "4h_breakout");
        }
      } else {
        return buildResult(market, "4h", box4h, sma50Value, consecutive, "4h_pass");
      }
    }
  }

  // Step 5: 30m 돌파 감지
  if (has30m) {
    const brk30m = detectBreakout(candles30m, WINDOW_30M, WIDTH_THRESHOLD, SLOPE_TH_30M);
    if (brk30m && brk30m.rep_score > 0) {
      return buildResult(market, "30m", brk30m, sma50Value, consecutive, "30m_breakout");
    }
  }

  // Step 6: 1h 돌파 감지
  const brk1h = detectBreakout(candles1h, WINDOW_1H, WIDTH_THRESHOLD, SLOPE_TH_1H);
  if (brk1h && brk1h.rep_score > 0) {
    return buildResult(market, "1h", brk1h, sma50Value, consecutive, "1h_breakout");
  }

  // Step 7: 4h 돌파 폴백
  if (has4h) {
    const brk4h = detectBreakout(candles4h, WINDOW_4H, WIDTH_THRESHOLD, SLOPE_TH_4H);
    if (brk4h && brk4h.rep_score > 0) {
      return buildResult(market, "4h", brk4h, sma50Value, consecutive, "4h_breakout");
    }
  }

  return null;
}

// ─── Route Handler ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
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
    const results = await Promise.allSettled(
      symbols.map(async (symbol): Promise<ScanResult | null> => {
        const market = `KRW-${symbol}`;
        const [candles30m, candles1h, candles4h] = await Promise.all([
          fetchCandles(market, "minutes/30", 200),
          fetchCandles(market, "minutes/60", 200),
          fetchCandles(market, "minutes/240", 120),
        ]);
        return evaluateCoin(candles30m, candles1h, candles4h, market);
      }),
    );

    const data: ScanResult[] = results
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<ScanResult>).value!)
      .sort((a, b) => b.sma50_consecutive - a.sma50_consecutive);

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
