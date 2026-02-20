/**
 * Exchange Rate Service
 * 
 * 负责与Open Exchange Rates API交互，获取CNY/AUD汇率数据
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// API配置
const API_BASE_URL = 'https://openexchangerates.org/api';
const API_KEY = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API_KEY || 'bd575de2682cf6fd74775b13';

// 缓存键
const CACHE_KEYS = {
  LATEST_RATE: 'exchange_rate_latest',
  HISTORICAL_RATES: 'exchange_rate_historical',
  RATE_HISTORY: 'exchange_rate_history',
};

// 缓存过期时间（毫秒）
const CACHE_EXPIRY = {
  LATEST: 5 * 60 * 1000, // 5分钟
  HISTORICAL: 24 * 60 * 60 * 1000, // 24小时
};

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

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * 获取最新汇率
 */
export async function getLatestExchangeRate(): Promise<ExchangeRate | null> {
  try {
    // 尝试从缓存获取
    const cached = await getCachedLatestRate();
    if (cached) {
      return cached;
    }

    // 从API获取
    if (!API_KEY) {
      console.warn('Exchange Rate API key not configured');
      return null;
    }

    const response = await fetch(
      `${API_BASE_URL}/latest.json?app_id=${API_KEY}&base=CNY&symbols=AUD`
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: ExchangeRate = await response.json();

    // 缓存结果
    await cacheLatestRate(data);

    return data;
  } catch (error) {
    console.error('Failed to fetch latest exchange rate:', error);
    return null;
  }
}

/**
 * 获取历史汇率（指定日期）
 */
export async function getHistoricalRate(date: string): Promise<ExchangeRate | null> {
  try {
    // 尝试从缓存获取
    const cached = await getCachedHistoricalRate(date);
    if (cached) {
      return cached;
    }

    if (!API_KEY) {
      console.warn('Exchange Rate API key not configured');
      return null;
    }

    const response = await fetch(
      `${API_BASE_URL}/historical/${date}.json?app_id=${API_KEY}&base=CNY&symbols=AUD`
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data: ExchangeRate = await response.json();

    // 缓存结果
    await cacheHistoricalRate(date, data);

    return data;
  } catch (error) {
    console.error(`Failed to fetch historical rate for ${date}:`, error);
    return null;
  }
}

/**
 * 获取时间序列数据（用于趋势分析）
 */
export async function getTimeSeries(
  startDate: string,
  endDate: string
): Promise<Record<string, ExchangeRate> | null> {
  try {
    if (!API_KEY) {
      console.warn('Exchange Rate API key not configured');
      return null;
    }

    const response = await fetch(
      `${API_BASE_URL}/time-series.json?app_id=${API_KEY}&start_date=${startDate}&end_date=${endDate}&base=CNY&symbols=AUD`
    );

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.rates || null;
  } catch (error) {
    console.error('Failed to fetch time series data:', error);
    return null;
  }
}

/**
 * 计算24小时涨跌幅
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
      CACHE_KEYS.HISTORICAL_RATES,
      CACHE_KEYS.RATE_HISTORY,
    ]);
  } catch (error) {
    console.error('Failed to clear cache:', error);
  }
}

// ============ 私有辅助函数 ============

async function getCachedLatestRate(): Promise<ExchangeRate | null> {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEYS.LATEST_RATE);
    if (!data) return null;

    const cached: CachedData<ExchangeRate> = JSON.parse(data);
    const isExpired = Date.now() - cached.timestamp > CACHE_EXPIRY.LATEST;

    if (isExpired) {
      await AsyncStorage.removeItem(CACHE_KEYS.LATEST_RATE);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('Failed to get cached latest rate:', error);
    return null;
  }
}

async function cacheLatestRate(rate: ExchangeRate): Promise<void> {
  try {
    const cached: CachedData<ExchangeRate> = {
      data: rate,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEYS.LATEST_RATE, JSON.stringify(cached));
  } catch (error) {
    console.error('Failed to cache latest rate:', error);
  }
}

async function getCachedHistoricalRate(date: string): Promise<ExchangeRate | null> {
  try {
    const data = await AsyncStorage.getItem(
      `${CACHE_KEYS.HISTORICAL_RATES}_${date}`
    );
    if (!data) return null;

    const cached: CachedData<ExchangeRate> = JSON.parse(data);
    const isExpired = Date.now() - cached.timestamp > CACHE_EXPIRY.HISTORICAL;

    if (isExpired) {
      await AsyncStorage.removeItem(`${CACHE_KEYS.HISTORICAL_RATES}_${date}`);
      return null;
    }

    return cached.data;
  } catch (error) {
    console.error('Failed to get cached historical rate:', error);
    return null;
  }
}

async function cacheHistoricalRate(date: string, rate: ExchangeRate): Promise<void> {
  try {
    const cached: CachedData<ExchangeRate> = {
      data: rate,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(
      `${CACHE_KEYS.HISTORICAL_RATES}_${date}`,
      JSON.stringify(cached)
    );
  } catch (error) {
    console.error('Failed to cache historical rate:', error);
  }
}
