# Multi-Timeframe Analysis Script

## 개요
멀티 타임프레임 분석을 수행하는 Python 스크립트입니다.

## 요구사항
```bash
pip install requests
```

## 실행 방법
```bash
python3 multi_timeframe_analysis.py
```

## 출력 형식
```json
{
  "results": [
    {
      "symbol": "BTC",
      "exchange": "upbit",
      "volume": 1234567890,
      "currentPrice": 50000000,
      "timeframes": {
        "5m": {"hasBox": true, "top": 51000000, "bottom": 49000000},
        "30m": {"hasBox": true, "top": 52000000, "bottom": 48000000},
        "1h": {"hasBox": false},
        "4h": {"hasBox": false},
        "1d": {"hasBox": false}
      },
      "boxCount": 2,
      "allTimeframes": false
    }
  ],
  "totalAnalyzed": 687,
  "foundCount": 1,
  "lastUpdated": 1771830336089
}
```

## TODO
현재는 더미 데이터만 반환합니다. 실제 구현이 필요합니다:

1. **차트 데이터 수집**
   - 업비트/빗썸 API에서 5m, 30m, 1h, 4h, 1d 캔들 데이터 가져오기

2. **박스권 탐지**
   - 지지/저항 레벨 계산
   - 박스권 상단/하단 식별
   - 현재 가격 위치 판단

3. **기술적 지표 계산**
   - MA50 (50일 이동평균선)
   - 일목구름 (선행스팬A, 선행스팬B)
   - VWMA110 (거래량 가중 이동평균선)

4. **신호 생성**
   - MA50 우상향 확인
   - 구름 위치 확인
   - 거래량 급증 탐지
   - 기준봉 발생 확인
   - 눌림목 타점 계산

## 성능 최적화
- 병렬 처리 (multiprocessing)
- API 호출 제한 준수 (rate limiting)
- 결과 캐싱
