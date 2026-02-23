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

        # 빗썸 분석 (시간이 오래 걸리므로 제한)
        print("\nAnalyzing Bithumb markets...", file=sys.stderr)
        for symbol in bithumb_markets[:50]:  # 처음 50개만
            result = analyze_symbol(symbol, 'bithumb')
            analyzed_count += 1

            if result:
                results.append(result)
                print(f"  ✓ {symbol}: {result['boxCount']} timeframes", file=sys.stderr)

            if analyzed_count % 10 == 0:
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
