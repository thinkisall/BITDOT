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
import numpy as np
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

def detect_box_range(candles: List[Dict], timeframe: str) -> Optional[Dict]:
    """
    매물대 기반 박스권 탐지 로직 (장대양봉 기준).
    1. 기준 캔들(장대양봉) 탐색 (1h, 4h, 1d 봉만 해당)
    2. 기준 캔들의 시가/종가를 기준으로 지지/저항 점수 계산
    3. 가장 점수가 높은 가격대를 '키 레벨'로 설정
    4. 키 레벨을 중심으로 박스권 형성
    """
    # 이 로직은 1시간봉, 4시간봉, 일봉에 대해서만 의미가 있음
    if timeframe not in ['1h', '4h', '1d']:
        return None

    if len(candles) < 150:
        return None

    # 1. 기준 캔들 탐색
    lookback_candles = candles[-150:]
    
    volumes = [c['volume'] for c in lookback_candles if c['volume'] > 0]

    if not volumes:
        return None

    # 거래량 임계값 설정 (상위 5%)
    volume_threshold = np.percentile(volumes, 95)

    anchor_candle = None
    anchor_candle_index = -1

    # 가장 최근의 기준 캔들을 찾음 (뒤에서부터)
    for i in range(len(lookback_candles) - 1, -1, -1):
        c = lookback_candles[i]
        if c['open'] == 0: continue
        body_size = abs(c['close'] - c['open'])
        body_pct = body_size / c['open']

        # 조건: 장대양봉(상승) + 거래량 임계값 초과 + 몸통크기 10% 이상
        if c['close'] > c['open'] and c['volume'] > volume_threshold and body_pct >= 0.10:
            anchor_candle = c
            anchor_candle_index = i
            break
    
    if not anchor_candle:
        return None

    # 2. 기준 캔들의 시가/종가를 후보로 지지/저항 점수 계산
    candidate_levels = {
        'open': anchor_candle['open'],
        'close': anchor_candle['close']
    }
    
    # 기준 캔들 이전의 100개 캔들로 점수 계산
    history_candles = lookback_candles[max(0, anchor_candle_index - 100) : anchor_candle_index]
    if len(history_candles) < 20: # 최소 20개는 있어야 의미있음
        return None

    scores = {'open': 0, 'close': 0}

    for name, level in candidate_levels.items():
        # 가격대에 따른 허용 오차 (0.3%)
        tolerance = level * 0.003
        for c in history_candles:
            # 캔들(고가~저가)이 레벨의 오차범위 내에 닿으면 점수 부여
            if c['low'] <= level + tolerance and c['high'] >= level - tolerance:
                scores[name] += 1
    
    # 3. 가장 점수가 높은 가격대를 '키 레벨'로 설정
    # 점수가 3번 미만으로 나온 레벨은 신뢰도 낮음
    if max(scores.values()) < 3:
        return None

    best_level_name = max(scores, key=scores.get)
    key_level = candidate_levels[best_level_name]

    # 4. 키 레벨 중심으로 박스권 형성
    # 최근 20개 캔들의 평균 변동폭(고가-저가)을 박스 높이로 활용
    recent_ranges = [c['high'] - c['low'] for c in candles[-20:] if c['low'] > 0]
    if not recent_ranges: return None
    avg_range = sum(recent_ranges) / len(recent_ranges)

    box_top = key_level + (avg_range / 2)
    box_bottom = key_level - (avg_range / 2)

    # 현재가 위치 계산
    current_price = candles[-1]['close']
    position = 'middle'
    position_percent = 50

    if box_top > box_bottom:
        position_percent = (current_price - box_bottom) / (box_top - box_bottom) * 100
        if current_price > box_top * 1.005: # 0.5% 이상 돌파
            position = 'breakout'
        elif current_price < box_bottom * 0.995: # 0.5% 이상 이탈
            position = 'below'
        elif position_percent >= 70:
            position = 'top'
        elif position_percent <= 30:
            position = 'bottom'

    return {
        'hasBox': True,
        'top': box_top,
        'bottom': box_bottom,
        'position': position,
        'positionPercent': position_percent,
        'keyLevel': key_level
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

def calculate_ma_slope(candles: List[Dict], period: int, lookback: int = 10, offset: int = 0) -> Optional[float]:
    """MA 기울기 계산 (offset으로부터 lookback 기간 동안의 전체 변화율)"""
    # 필요한 최소 캔들 수: MA 기간 + 기울기 계산 기간 + 오프셋
    if len(candles) < period + lookback + offset:
        return None

    # 기울기 시작점의 MA 계산
    start_ma_end_idx = len(candles) - (lookback + offset)
    start_ma_start_idx = start_ma_end_idx - period
    if start_ma_start_idx < 0:
        return None
    
    start_chunk = candles[start_ma_start_idx:start_ma_end_idx]
    if not start_chunk: return None
    
    start_ma = sum(c['close'] for c in start_chunk) / len(start_chunk)

    # 기울기 끝점의 MA 계산
    end_ma_end_idx = len(candles) - offset
    end_ma_start_idx = end_ma_end_idx - period
    if end_ma_start_idx < 0:
        return None

    end_chunk = candles[end_ma_start_idx:end_ma_end_idx]
    if not end_chunk: return None

    end_ma = sum(c['close'] for c in end_chunk) / len(end_chunk)

    if start_ma == 0:
        return None

    # 시작 MA 대비 끝 MA의 변화율을 기울기로 반환
    slope = (end_ma - start_ma) / start_ma * 100
    return slope

def calculate_ma_from_slice(candles: List[Dict], period: int) -> Optional[float]:
    """슬라이스에서 MA 계산"""
    if len(candles) < period:
        return None
    recent = candles[-period:]
    closes = [c['close'] for c in recent]
    return sum(closes) / period



def calculate_position_in_box(current_price: float, box: Dict) -> Dict:
    """박스권 내에서 현재 가격의 위치를 계산"""
    box_top = box['top']
    box_bottom = box['bottom']
    
    position = 'middle'
    position_percent = 50

    if box_top > box_bottom:
        position_percent = (current_price - box_bottom) / (box_top - box_bottom) * 100
        if current_price > box_top * 1.005: # 0.5% 이상 돌파
            position = 'breakout'
        elif current_price < box_bottom * 0.995: # 0.5% 이상 이탈
            position = 'below'
        elif position_percent >= 70:
            position = 'top'
        elif position_percent <= 30:
            position = 'bottom'
    
    result_box = box.copy()
    result_box['position'] = position
    result_box['positionPercent'] = position_percent
    return result_box


def analyze_symbol(symbol: str, exchange: str) -> Optional[Dict]:
    """단일 심볼 분석 (하락 후 횡보 필터링 및 마스터 박스권 적용)"""
    try:
        print(f"Analyzing {exchange.upper()}: {symbol}", file=sys.stderr)

        # 차트 데이터 수집
        timeframes = ['5m', '30m', '1h', '4h', '1d']
        candles_data = {}
        for tf in timeframes:
            count = 200
            if tf in ['1h', '4h', '1d']:
                count = 250 # 박스권 분석을 위해 더 많은 캔들 확보
            
            if exchange == 'upbit':
                market = f'KRW-{symbol}'
                candles_data[tf] = fetch_upbit_candles(market, tf, count=count)
                time.sleep(UPBIT_DELAY)
            else:
                candles_data[tf] = fetch_bithumb_candles(symbol, tf)
                time.sleep(BITHUMB_DELAY)

        # 1. 하락 후 횡보 패턴 확인 (1시간봉 MA50 기준)
        candles_1h = candles_data.get('1h', [])
        if len(candles_1h) < 70:
            return None

        past_slope = calculate_ma_slope(candles_1h, period=50, lookback=10, offset=10)
        recent_slope = calculate_ma_slope(candles_1h, period=50, lookback=10, offset=0)

        if past_slope is None or recent_slope is None:
            return None
            
        is_downtrend_then_sideways = past_slope < -4.0 and abs(recent_slope) < 2.0
        
        if not is_downtrend_then_sideways:
            return None

        # 2. 마스터 박스권 탐지 (4h -> 1h 순으로)
        master_box = None
        master_box_tf = None
        for tf in ['4h', '1h', '1d']:
            candles = candles_data.get(tf, [])
            if candles:
                box = detect_box_range(candles, tf)
                if box and box.get('hasBox'):
                    master_box = box
                    master_box_tf = tf
                    break 
        
        if not master_box:
            return None

        # 3. 모든 타임프레임에 마스터 박스권 적용 및 현재가 위치 계산
        tf_results = {}
        for tf in timeframes:
            candles = candles_data.get(tf, [])
            if candles and candles[-1]['close'] > 0:
                current_price = candles[-1]['close']
                box_with_position = calculate_position_in_box(current_price, master_box)
                tf_results[tf] = box_with_position
            else:
                tf_results[tf] = {'hasBox': False}

        # 최종 결과 구성
        final_1h_candles = candles_data.get('1h', [])
        current_price = final_1h_candles[-1]['close']
        volume = final_1h_candles[-1]['volume']
        ma50_1h = calculate_ma50(final_1h_candles)
        above_1h_ma50 = current_price > ma50_1h if ma50_1h else False
        
        result = {
            'symbol': symbol,
            'exchange': exchange,
            'volume': volume,
            'currentPrice': current_price,
            'timeframes': tf_results,
            'boxCount': 5,
            'above1hMA50': above_1h_ma50,
            'trendInfo': {
                'pastSlope': round(past_slope, 2),
                'recentSlope': round(recent_slope, 2),
            },
            'masterBoxInfo': {
                't': master_box['top'],
                'b': master_box['bottom'],
                'kl': master_box.get('keyLevel'),
                'tf': master_box_tf
            }
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
