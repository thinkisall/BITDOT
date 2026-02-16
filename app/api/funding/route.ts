// app/api/funding/route.ts
import { NextResponse } from 'next/server';

interface FundingData {
  symbol: string;
  exchange: 'binance' | 'bybit' | 'okx';
  fundingRate: number;
  fundingRatePercent: number;
  nextFundingTime: number;
  markPrice?: number;
}

export async function GET() {
  try {
    // OKX는 API 제한으로 임시 제외
    const [binanceData, bybitData] = await Promise.all([
      fetchBinanceFunding(),
      fetchBybitFunding(),
    ]);

    console.log('Data counts - Binance:', binanceData.length, 'Bybit:', bybitData.length);

    const allData: FundingData[] = [
      ...binanceData,
      ...bybitData,
    ];

    // 디버깅: 샘플 데이터 출력
    if (allData.length > 0) {
      console.log('Sample final data:', JSON.stringify(allData[0]));
      console.log('fundingRate:', allData[0].fundingRate);
      console.log('fundingRatePercent:', allData[0].fundingRatePercent);
    }

    // 펀딩비 절대값 기준으로 정렬 (높은 순)
    allData.sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));

    return NextResponse.json({
      data: allData,
      timestamp: Date.now(),
      count: allData.length,
    });
  } catch (error: any) {
    console.error('Funding API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch funding rates' },
      { status: 500 }
    );
  }
}

// Binance Futures Funding Rate
async function fetchBinanceFunding(): Promise<FundingData[]> {
  try {
    const response = await fetch('https://fapi.binance.com/fapi/v1/premiumIndex');
    const data = await response.json();

    // 디버깅: 첫 번째 항목 로깅
    if (data.length > 0) {
      console.log('Binance sample data:', JSON.stringify(data[0]));
    }

    return data
      .filter((item: any) => item.symbol.endsWith('USDT'))
      .map((item: any) => {
        const fundingRate = parseFloat(item.lastFundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'binance' as const,
          fundingRate: fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('Binance funding error:', error);
    return [];
  }
}

// Bybit Funding Rate
async function fetchBybitFunding(): Promise<FundingData[]> {
  try {
    const response = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
    const data = await response.json();

    if (data.retCode !== 0 || !data.result?.list) {
      console.error('Bybit API error:', data);
      return [];
    }

    // 디버깅: 첫 번째 항목 로깅
    if (data.result.list.length > 0) {
      console.log('Bybit sample data:', JSON.stringify(data.result.list[0]));
    }

    return data.result.list
      .filter((item: any) => item.symbol.endsWith('USDT'))
      .map((item: any) => {
        const fundingRate = parseFloat(item.fundingRate || '0');
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'bybit' as const,
          fundingRate: fundingRate,
          fundingRatePercent: fundingRate * 100,
          nextFundingTime: parseInt(item.nextFundingTime || '0'),
          markPrice: parseFloat(item.markPrice || '0'),
        };
      });
  } catch (error) {
    console.error('Bybit funding error:', error);
    return [];
  }
}

// OKX Funding Rate - 별도 API 사용
async function fetchOKXFunding(): Promise<FundingData[]> {
  try {
    // OKX는 펀딩비를 별도 API로 가져와야 함
    const fundingResponse = await fetch('https://www.okx.com/api/v5/public/funding-rate-history?instType=SWAP&limit=100');
    const fundingData = await fundingResponse.json();

    if (fundingData.code !== '0' || !fundingData.data) {
      console.error('OKX Funding API response:', fundingData);
      return [];
    }

    // 디버깅: 첫 번째 항목 로깅
    if (fundingData.data.length > 0) {
      console.log('OKX funding sample data:', JSON.stringify(fundingData.data[0]));
    }

    // 각 심볼의 최신 펀딩비 추출
    const latestRates = new Map<string, any>();
    fundingData.data.forEach((item: any) => {
      if (item.instId.endsWith('-USDT-SWAP')) {
        const symbol = item.instId.replace('-USDT-SWAP', '');
        if (!latestRates.has(symbol)) {
          latestRates.set(symbol, item);
        }
      }
    });

    return Array.from(latestRates.values()).map((item: any) => {
      const fundingRate = parseFloat(item.fundingRate || '0');
      const nextFundingTime = parseInt(item.fundingTime || '0');

      return {
        symbol: item.instId.replace('-USDT-SWAP', ''),
        exchange: 'okx' as const,
        fundingRate: fundingRate,
        fundingRatePercent: fundingRate * 100,
        nextFundingTime: nextFundingTime,
        markPrice: 0, // 별도로 가져와야 함
      };
    });
  } catch (error) {
    console.error('OKX funding error:', error);
    return [];
  }
}
