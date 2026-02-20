/**
 * Mock Exchange Rate Service
 * 
 * 提供模拟的汇率数据用于开发和测试
 * 当真实API可用时，可以轻松替换为真实服务
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ExchangeRate {
  timestamp: number;
  base: string;
  rates: {
    AUD: number;
  };
}

export interface RateHistory {
  date: string;
  rate: number;
  timestamp: number;
}

// 模拟数据缓存键
const CACHE_KEYS = {
  LATEST_RATE: 'mock_exchange_rate_latest',
  RATE_HISTORY: 'mock_exchange_rate_history',
};

// 基础汇率（模拟值）
const BASE_RATE = 0.1850;

/**
 * 生成模拟汇率数据（带有随机波动）
 */
function generateMockRate(): number {
  // 模拟±0.5%的日常波动
  const volatility = (Math.random() - 0.5) * 0.01;
  return BASE_RATE + volatility;
}

/**
 * 获取最新汇率（模拟）
 */
export async function getLatestExchangeRate(): Promise<ExchangeRate | null> {
  try {
    const rate = generateMockRate();
    const data: ExchangeRate = {
      timestamp: Math.floor(Date.now() / 1000),
      base: 'CNY',
      rates: {
        AUD: parseFloat(rate.toFixed(4)),
      },
    };

    // 保存到本地历史
    await saveRateToHistory(data.rates.AUD);

    return data;
  } catch (error) {
    console.error('Failed to get mock exchange rate:', error);
    return null;
  }
}

/**
 * 获取历史汇率（模拟）
 */
export async function getHistoricalRate(date: string): Promise<ExchangeRate | null> {
  try {
    // 基于日期生成确定性的模拟数据
    const dateNum = new Date(date).getTime();
    const seed = dateNum % 1000;
    const rate = BASE_RATE + (seed - 500) / 10000;

    const data: ExchangeRate = {
      timestamp: Math.floor(new Date(date).getTime() / 1000),
      base: 'CNY',
      rates: {
        AUD: parseFloat(rate.toFixed(4)),
      },
    };

    return data;
  } catch (error) {
    console.error(`Failed to get mock historical rate for ${date}:`, error);
    return null;
  }
}

/**
 * 获取时间序列数据（模拟）
 */
export async function getTimeSeries(
  startDate: string,
  endDate: string
): Promise<Record<string, ExchangeRate> | null> {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const result: Record<string, ExchangeRate> = {};

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dateNum = d.getTime();
      const seed = dateNum % 1000;
      const rate = BASE_RATE + (seed - 500) / 10000;

      result[dateStr] = {
        timestamp: Math.floor(d.getTime() / 1000),
        base: 'CNY',
        rates: {
          AUD: parseFloat(rate.toFixed(4)),
        },
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to get mock time series data:', error);
    return null;
  }
}

/**
 * 计算24小时涨跌幅（模拟）
 */
export async function calculate24hChange(): Promise<number | null> {
  try {
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

    const todayRate = await getLatestExchangeRate();
    const yesterdayRate = await getHistoricalRate(
      yesterday.toISOString().split('T')[0]
    );

    if (!todayRate || !yesterdayRate) {
      return null;
    }

    const change =
      ((todayRate.rates.AUD - yesterdayRate.rates.AUD) / yesterdayRate.rates.AUD) * 100;

    return parseFloat(change.toFixed(4));
  } catch (error) {
    console.error('Failed to calculate 24h change:', error);
    return null;
  }
}

/**
 * 保存汇率到本地历史记录
 */
export async function saveRateToHistory(rate: number): Promise<void> {
  try {
    const history = await getRateHistory();
    const newEntry: RateHistory = {
      date: new Date().toISOString(),
      rate,
      timestamp: Date.now(),
    };

    history.push(newEntry);

    // 只保留最近30天的数据
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const filtered = history.filter((h) => h.timestamp > thirtyDaysAgo);

    await AsyncStorage.setItem(
      CACHE_KEYS.RATE_HISTORY,
      JSON.stringify(filtered)
    );
  } catch (error) {
    console.error('Failed to save rate to history:', error);
  }
}

/**
 * 获取汇率历史记录
 */
export async function getRateHistory(): Promise<RateHistory[]> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.RATE_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get rate history:', error);
    return [];
  }
}

/**
 * 清除所有缓存
 */
export async function clearCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      CACHE_KEYS.LATEST_RATE,
      CACHE_KEYS.RATE_HISTORY,
    ]);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}
