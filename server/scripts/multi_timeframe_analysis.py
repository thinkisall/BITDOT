#!/usr/bin/env python3
"""
멀티 타임프레임 분석 스크립트

업비트와 빗썸의 모든 코인에 대해:
- 5m, 30m, 1h, 4h, 1d 차트 데이터 수집
- 박스권 탐지
- MA50, 일목구름 분석
- 결과를 JSON으로 출력
"""

import json
import sys
import requests
import time
from datetime import datetime
from typing import List, Dict, Optional, Tuple

# Rate limiting
UPBIT_DELAY = 1.0  # 1초
BITHUMB_DELAY = 0.6  # 0.6초

def fetch_upbit_markets() -> List[str]:
    """업비트 마켓 목록 조회"""
    try:
        url = "https://api.upbit.com/v1/market/all"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        markets = response.json()
        krw_markets = [m['market'] for m in markets if m['market'].startswith('KRW-')]
        return krw_markets
    except Exception as e:
        print(f"Error fetching Upbit markets: {e}", file=sys.stderr)
        return []

def fetch_bithumb_markets() -> List[str]:
    """빗썸 마켓 목록 조회"""
    try:
        url = "https://api.bithumb.com/public/ticker/ALL_KRW"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data['status'] == '0000':
            symbols = [k for k in data['data'].keys() if k != 'date']
            return symbols
        return []
    except Exception as e:
        print(f"Error fetching Bithumb markets: {e}", file=sys.stderr)
        return []

def fetch_upbit_candles(market: str, timeframe: str, count: int = 200) -> List[Dict]:
    """업비트 캔들 데이터 조회"""
    try:
        timeframe_map = {
            '5m': 'minutes/5',
            '30m': 'minutes/30',
            '1h': 'minutes/60',
            '4h': 'minutes/240',
            '1d': 'days'
        }

        tf = timeframe_map.get(timeframe, 'minutes/60')
        url = f"https://api.upbit.com/v1/candles/{tf}"
        params = {'market': market, 'count': count}

        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        candles = response.json()

        # 시간 순서로 정렬 (오래된 것부터)
        candles.reverse()

        return [{
            'timestamp': c['timestamp'],
            'open': c['opening_price'],
            'high': c['high_price'],
            'low': c['low_price'],
            'close': c['trade_price'],
            'volume': c['candle_acc_trade_volume']
        } for c in candles]
    except Exception as e:
        print(f"Error fetching Upbit candles for {market}/{timeframe}: {e}", file=sys.stderr)
        return []

def fetch_bithumb_candles(symbol: str, timeframe: str) -> List[Dict]:
    """빗썸 캔들 데이터 조회"""
    try:
        timeframe_map = {
            '5m': '5m',
            '30m': '30m',
            '1h': '1h',
            '4h': '4h',
            '1d': '24h'
        }

        tf = timeframe_map.get(timeframe, '1h')
        url = f"https://api.bithumb.com/public/candlestick/{symbol}_KRW/{tf}"

        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data['status'] != '0000' or 'data' not in data:
            return []

        candles = []
        for c in data['data']:
            candles.append({
                'timestamp': int(c[0]),
                'open': float(c[1]),
                'close': float(c[2]),
                'high': float(c[3]),
                'low': float(c[4]),
                'volume': float(c[5])
            })

        return candles[-200:]  # 최근 200개만
    except Exception as e:
        print(f"Error fetching Bithumb candles for {symbol}/{timeframe}: {e}", file=sys.stderr)
        return []

def detect_box_range(candles: List[Dict]) -> Optional[Dict]:
    """박스권 탐지 (간단한 버전)"""
    if len(candles) < 20:
        return None

    recent = candles[-20:]  # 최근 20개 캔들

    highs = [c['high'] for c in recent]
    lows = [c['low'] for c in recent]

    # 상단/하단 계산
    top = max(highs)
    bottom = min(lows)

    # 박스권 폭이 너무 크면 무효
    if top == 0:
        return None

    box_range = (top - bottom) / bottom * 100
    if box_range > 30:  # 30% 이상 변동성은 박스권 아님
        return None

    # 현재가 위치
    current_price = candles[-1]['close']

    # 위치 계산
    if current_price > top * 1.03:
        position = 'breakout'
    elif current_price < bottom * 0.97:
        position = 'below'
    else:
        position_pct = (current_price - bottom) / (top - bottom) * 100
        if position_pct >= 66:
            position = 'top'
        elif position_pct >= 33:
            position = 'middle'
        else:
            position = 'bottom'

    return {
        'hasBox': True,
        'top': top,
        'bottom': bottom,
        'position': position,
        'positionPercent': (current_price - bottom) / (top - bottom) * 100 if top != bottom else 50
    }

def calculate_ma50(candles: List[Dict]) -> Optional[float]:
    """MA50 계산"""
    if len(candles) < 50:
        return None

    recent_50 = candles[-50:]
    closes = [c['close'] for c in recent_50]
    return sum(closes) / 50

def calculate_ma110(candles: List[Dict]) -> Optional[float]:
    """MA110 계산"""
    if len(candles) < 110:
        return None
    recent_110 = candles[-110:]
    closes = [c['close'] for c in recent_110]
    return sum(closes) / 110

def calculate_ma180(candles: List[Dict]) -> Optional[float]:
    """MA180 계산"""
    if len(candles) < 180:
        return None
    recent_180 = candles[-180:]
    closes = [c['close'] for c in recent_180]
    return sum(closes) / 180

def calculate_ichimoku_cloud(candles: List[Dict]) -> Optional[Dict]:
    """일목구름 계산 (선행스팬A, 선행스팬B)"""
    if len(candles) < 52:
        return None

    # 전환선 (9일 최고최저 평균)
    conversion_period = candles[-9:]
    conversion = (max(c['high'] for c in conversion_period) + min(c['low'] for c in conversion_period)) / 2

    # 기준선 (26일 최고최저 평균)
    base_period = candles[-26:]
    base = (max(c['high'] for c in base_period) + min(c['low'] for c in base_period)) / 2

    # 선행스팬A (전환선 + 기준선) / 2, 26일 선행
    span_a = (conversion + base) / 2

    # 선행스팬B (52일 최고최저 평균), 26일 선행
    span_b_period = candles[-52:]
    span_b = (max(c['high'] for c in span_b_period) + min(c['low'] for c in span_b_period)) / 2

    return {
        'spanA': span_a,
        'spanB': span_b,
        'cloudTop': max(span_a, span_b),
        'cloudBottom': min(span_a, span_b)
    }

def check_cloud_status(current_price: float, cloud: Optional[Dict]) -> Optional[str]:
    """구름 위치 확인"""
    if not cloud:
        return None

    if current_price > cloud['cloudTop']:
        return 'above'
    elif current_price >= cloud['cloudBottom'] * 0.98:  # 2% 이내
        return 'near'
    return None

def detect_trigger_candle(candles: List[Dict]) -> bool:
    """기준봉 발생 여부 (최근 7일 내 장대양봉: 몸통 7%+, 거래량 10배+)"""
    if len(candles) < 20:
        return False

    recent_7 = candles[-7:]
    avg_volume = sum(c['volume'] for c in candles[-20:-7]) / 13

    for candle in recent_7:
        body_pct = abs(candle['close'] - candle['open']) / candle['open'] * 100
        volume_ratio = candle['volume'] / avg_volume if avg_volume > 0 else 0

        if body_pct >= 7 and volume_ratio >= 10 and candle['close'] > candle['open']:
            return True

    return False

def check_pullback_signal(current_price: float, ma110: Optional[float], ma50: Optional[float], ma180: Optional[float]) -> Optional[str]:
    """눌림목 타점 확인 (110/180일선 ±2% 이내)"""
    if ma110 and abs(current_price - ma110) / ma110 <= 0.02:
        return 'TREND_110'
    if ma50 and abs(current_price - ma50) / ma50 <= 0.02:
        return 'SUPPORT_50'
    if ma180 and abs(current_price - ma180) / ma180 <= 0.02:
        return 'SUPPORT_180'
    return None

def calculate_ma_slope(candles: List[Dict], period: int, lookback: int = 5) -> Optional[float]:
    """MA 기울기 계산 (최근 lookback개 MA 값의 평균 변화율)"""
    if len(candles) < period + lookback:
        return None

    slopes = []
    for i in range(lookback):
        idx = -(i + 1)
        ma_current = calculate_ma_from_slice(candles[:idx], period) if idx < -1 else calculate_ma_from_slice(candles, period)
        ma_prev = calculate_ma_from_slice(candles[:idx - 1], period)

        if ma_current and ma_prev and ma_prev > 0:
            slope = (ma_current - ma_prev) / ma_prev * 100
            slopes.append(slope)

    return sum(slopes) / len(slopes) if slopes else None

def calculate_ma_from_slice(candles: List[Dict], period: int) -> Optional[float]:
    """슬라이스에서 MA 계산"""
    if len(candles) < period:
        return None
    recent = candles[-period:]
    closes = [c['close'] for c in recent]
    return sum(closes) / period

def check_swing_recovery(candles: List[Dict], current_price: float, ma50_1h: Optional[float]) -> Optional[Dict]:
    """스윙 리커버리 확인 (하락 → 횡보 → MA50 위)"""
    if not ma50_1h or current_price <= ma50_1h:
        return None

    slope_old = calculate_ma_slope(candles, 50, lookback=10)  # 10봉 전 기울기
    slope_recent = calculate_ma_slope(candles, 50, lookback=5)  # 최근 5봉 기울기

    if slope_old and slope_recent:
        # 과거 하락 추세 → 현재 횡보/상승
        if slope_old < -0.5 and slope_recent > -0.3:
            return {
                'slopeOld': round(slope_old, 2),
                'slopeRecent': round(slope_recent, 2),
                'ma50Current': ma50_1h
            }

    return None

def analyze_symbol(symbol: str, exchange: str) -> Optional[Dict]:
    """단일 심볼 분석"""
    try:
        print(f"Analyzing {exchange.upper()}: {symbol}", file=sys.stderr)

        # 차트 데이터 수집
        timeframes = ['5m', '30m', '1h', '4h', '1d']
        candles_data = {}

        for tf in timeframes:
            if exchange == 'upbit':
                market = f'KRW-{symbol}'
                candles_data[tf] = fetch_upbit_candles(market, tf)
                time.sleep(UPBIT_DELAY)
            else:  # bithumb
                candles_data[tf] = fetch_bithumb_candles(symbol, tf)
                time.sleep(BITHUMB_DELAY)

        # 현재가 가져오기
        candles_1h = candles_data.get('1h', [])
        if not candles_1h:
            return None

        current_price = candles_1h[-1]['close']
        volume = candles_1h[-1]['volume']

        # 각 타임프레임 분석
        tf_results = {}
        box_count = 0

        for tf in timeframes:
            candles = candles_data.get(tf, [])
            if candles:
                box = detect_box_range(candles)
                if box and box['hasBox']:
                    tf_results[tf] = box
                    box_count += 1
                else:
                    tf_results[tf] = {'hasBox': False}
            else:
                tf_results[tf] = {'hasBox': False}

        # 박스권이 없으면 스킵
        if box_count == 0:
            return None

        # MA50 체크
        ma50_1h = calculate_ma50(candles_1h)
        above_1h_ma50 = current_price > ma50_1h if ma50_1h else False

        ma50_5m = calculate_ma50(candles_data.get('5m', []))
        above_5m_ma50 = current_price > ma50_5m if ma50_5m else False

        # 일목구름 체크
        cloud_5m = calculate_ichimoku_cloud(candles_data.get('5m', []))
        cloud_30m = calculate_ichimoku_cloud(candles_data.get('30m', []))
        cloud_1h = calculate_ichimoku_cloud(candles_1h)
        cloud_4h = calculate_ichimoku_cloud(candles_data.get('4h', []))

        cloud_status_5m = check_cloud_status(current_price, cloud_5m)
        cloud_status_30m = check_cloud_status(current_price, cloud_30m)
        cloud_status_1h = check_cloud_status(current_price, cloud_1h)
        cloud_status_4h = check_cloud_status(current_price, cloud_4h)

        # 기준봉 & 눌림목
        candles_1d = candles_data.get('1d', [])
        is_triggered = detect_trigger_candle(candles_1d) if candles_1d else False

        ma110 = calculate_ma110(candles_1d) if candles_1d else None
        ma180 = calculate_ma180(candles_1d) if candles_1d else None
        pullback_signal = check_pullback_signal(current_price, ma110, ma50_1h, ma180) if is_triggered else None

        # 스윙 리커버리
        swing_recovery = check_swing_recovery(candles_1h, current_price, ma50_1h)

        result = {
            'symbol': symbol,
            'exchange': exchange,
            'volume': volume,
            'currentPrice': current_price,
            'timeframes': tf_results,
            'boxCount': box_count,
            'allTimeframes': box_count == 5,
            'above1hMA50': above_1h_ma50,
            'above5mMA50': above_5m_ma50,
        }

        # 조건부 필드 추가
        if cloud_status_5m:
            result['cloudStatus5m'] = cloud_status_5m
        if cloud_status_30m:
            result['cloudStatus30m'] = cloud_status_30m
        if cloud_status_1h:
            result['cloudStatus'] = cloud_status_1h
        if cloud_status_4h:
            result['cloudStatus4h'] = cloud_status_4h
        if is_triggered:
            result['isTriggered'] = True
        if pullback_signal:
            result['pullbackSignal'] = pullback_signal
        if swing_recovery:
            result['swingRecovery'] = swing_recovery

        return result

    except Exception as e:
        print(f"Error analyzing {exchange}/{symbol}: {e}", file=sys.stderr)
        return None

def main():
    """메인 분석 함수"""
    try:
        print("=" * 60, file=sys.stderr)
        print("Multi-Timeframe Analysis Started", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

        # 마켓 목록 조회
        print("Fetching market lists...", file=sys.stderr)
        upbit_markets = fetch_upbit_markets()
        bithumb_markets = fetch_bithumb_markets()

        total_markets = len(upbit_markets) + len(bithumb_markets)
        print(f"Total markets: {total_markets} (Upbit: {len(upbit_markets)}, Bithumb: {len(bithumb_markets)})", file=sys.stderr)

        results = []
        analyzed_count = 0

        # 빗썸 분석 (300개 제한)
        print("\nAnalyzing Bithumb markets...", file=sys.stderr)
        for symbol in bithumb_markets[:300]:  # 300개
            result = analyze_symbol(symbol, 'bithumb')
            analyzed_count += 1

            if result:
                results.append(result)
                print(f"  ✓ {symbol}: {result['boxCount']} timeframes", file=sys.stderr)

            if analyzed_count % 50 == 0:
                print(f"Progress: {analyzed_count} analyzed, {len(results)} found", file=sys.stderr)

        # 결과 정렬 (거래량 기준)
        results.sort(key=lambda x: x['volume'], reverse=True)

        # 결과 출력
        output = {
            'results': results,
            'totalAnalyzed': analyzed_count,
            'foundCount': len(results),
            'lastUpdated': int(datetime.now().timestamp() * 1000)
        }

        print("\n" + "=" * 60, file=sys.stderr)
        print(f"Analysis Complete: {len(results)} results found", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

        print(json.dumps(output, ensure_ascii=False))

    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)

        output = {
            'results': [],
            'totalAnalyzed': 0,
            'foundCount': 0,
            'lastUpdated': int(datetime.now().timestamp() * 1000),
            'error': str(e)
        }
        print(json.dumps(output, ensure_ascii=False))
        sys.exit(1)

if __name__ == "__main__":
    main()
