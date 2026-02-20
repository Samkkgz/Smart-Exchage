/**
 * ExchangeRate API Service
 * 拉取实时与历史汇率，并缓存到本地用于策略分析。
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAppSettings } from "@/lib/services/storage";

const API_BASE_URL = "https://v6.exchangerate-api.com/v6";
const DEFAULT_API_KEY = "bd575de2682cf6fd74775b13";

const CACHE_KEYS = {
  LATEST_RATE: "exchangerate_api_latest",
  HISTORICAL_RATES: "exchangerate_api_historical",
  RATE_HISTORY: "exchangerate_api_history",
};

const CACHE_EXPIRY = {
  LATEST: 5 * 60 * 1000,
  HISTORICAL: 12 * 60 * 60 * 1000,
};

export interface ExchangeRate {
  timestamp: number;
  base: string;
  target: string;
  rate: number;
  rates?: {
    [key: string]: number;
  };
}

export interface RateHistory {
  date: string;
  rate: number;
  timestamp: number;
  currencyCode: string;
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().split("T")[0];
}

async function resolveApiKey(): Promise<string> {
  const settings = await getAppSettings();
  return settings.exchangeRateApiKey || process.env.EXPO_PUBLIC_EXCHANGE_RATE_API_KEY || DEFAULT_API_KEY;
}

function normalizeHistory(rows: RateHistory[], currencyCode: string): RateHistory[] {
  const byDay = new Map<string, RateHistory>();
  rows
    .filter((r) => Number.isFinite(r.rate) && Number.isFinite(r.timestamp))
    .forEach((row) => {
      const key = dayKey(row.timestamp);
      const existing = byDay.get(key);
      if (!existing || row.timestamp >= existing.timestamp) {
        byDay.set(key, {
          date: new Date(row.timestamp).toISOString(),
          rate: Number(row.rate),
          timestamp: Number(row.timestamp),
          currencyCode,
        });
      }
    });

  return Array.from(byDay.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function parseHistoryPayload(payload: any, targetCurrency: string): RateHistory[] {
  const candidates = [payload?.conversion_rates, payload?.rates, payload?.time_series, payload?.history];
  const out: RateHistory[] = [];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;

    for (const [key, value] of Object.entries(candidate as Record<string, any>)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
      if (!value || typeof value !== "object") continue;

      const rate = Number((value as Record<string, unknown>)[targetCurrency]);
      if (!Number.isFinite(rate)) continue;

      out.push({
        date: `${key}T23:59:59.000Z`,
        timestamp: new Date(`${key}T23:59:59.000Z`).getTime(),
        rate,
        currencyCode: targetCurrency,
      });
    }
  }

  return out;
}

async function fetchHistoryFromExchangeRateApi(targetCurrency: string): Promise<RateHistory[]> {
  const apiKey = await resolveApiKey();
  if (!apiKey) return [];

  try {
    const response = await fetch(`${API_BASE_URL}/${apiKey}/history/CNY`);
    if (!response.ok) return [];

    const payload = await response.json();
    if (payload?.result && payload.result !== "success") return [];

    return parseHistoryPayload(payload, targetCurrency);
  } catch {
    return [];
  }
}

async function fetchHistoryFromFrankfurter(targetCurrency: string, days = 365): Promise<RateHistory[]> {
  try {
    const end = new Date();
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const startDate = start.toISOString().split("T")[0];
    const endDate = end.toISOString().split("T")[0];

    const response = await fetch(
      `https://api.frankfurter.app/${startDate}..${endDate}?from=CNY&to=${targetCurrency}`,
    );
    if (!response.ok) return [];

    const payload = await response.json();
    const rates = payload?.rates || {};
    const out: RateHistory[] = [];

    for (const [date, value] of Object.entries(rates as Record<string, any>)) {
      const rate = Number(value?.[targetCurrency]);
      if (!Number.isFinite(rate)) continue;
      out.push({
        date: `${date}T23:59:59.000Z`,
        timestamp: new Date(`${date}T23:59:59.000Z`).getTime(),
        rate,
        currencyCode: targetCurrency,
      });
    }

    return out;
  } catch {
    return [];
  }
}

async function loadCachedHistorical(targetCurrency: string): Promise<RateHistory[] | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_KEYS.HISTORICAL_RATES}_${targetCurrency}`);
    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedData<RateHistory[]>;
    if (Date.now() - cached.timestamp > CACHE_EXPIRY.HISTORICAL) return null;
    return normalizeHistory(cached.data || [], targetCurrency);
  } catch {
    return null;
  }
}

async function saveCachedHistorical(targetCurrency: string, rows: RateHistory[]): Promise<void> {
  await AsyncStorage.setItem(
    `${CACHE_KEYS.HISTORICAL_RATES}_${targetCurrency}`,
    JSON.stringify({ data: rows, timestamp: Date.now() }),
  );
}

export async function ensureSufficientHistory(targetCurrency: string = "AUD", minPoints = 30): Promise<RateHistory[]> {
  const existing = normalizeHistory(await getRateHistory(targetCurrency), targetCurrency);
  if (existing.length >= minPoints) return existing;

  const cached = await loadCachedHistorical(targetCurrency);
  if (cached && cached.length >= minPoints) {
    await AsyncStorage.setItem(`${CACHE_KEYS.RATE_HISTORY}_${targetCurrency}`, JSON.stringify(cached));
    return cached;
  }

  const apiRows = await fetchHistoryFromExchangeRateApi(targetCurrency);
  const fallbackRows = apiRows.length >= minPoints ? [] : await fetchHistoryFromFrankfurter(targetCurrency, 365);
  const merged = normalizeHistory([...existing, ...apiRows, ...fallbackRows], targetCurrency);

  if (merged.length > 0) {
    await saveCachedHistorical(targetCurrency, merged);
    await AsyncStorage.setItem(`${CACHE_KEYS.RATE_HISTORY}_${targetCurrency}`, JSON.stringify(merged));
  }

  return merged;
}

export async function getLatestExchangeRate(targetCurrency: string = "AUD"): Promise<ExchangeRate | null> {
  try {
    const cached = await getCachedLatestRate(targetCurrency);
    if (cached) return cached;

    const apiKey = await resolveApiKey();
    if (!apiKey) return null;

    const response = await fetch(`${API_BASE_URL}/${apiKey}/latest/CNY`);
    if (!response.ok) throw new Error(`API Error: ${response.status}`);

    const data = await response.json();
    if (data.result !== "success") throw new Error(`API Error: ${data["error-type"]}`);

    const rateValue = Number(data.conversion_rates?.[targetCurrency]);
    if (!Number.isFinite(rateValue)) throw new Error(`Target currency ${targetCurrency} not found in response`);

    const exchangeRate: ExchangeRate = {
      timestamp: Math.floor(Date.now() / 1000),
      base: "CNY",
      target: targetCurrency,
      rate: rateValue,
      rates: { [targetCurrency]: rateValue },
    };

    await AsyncStorage.setItem(
      `${CACHE_KEYS.LATEST_RATE}_${targetCurrency}`,
      JSON.stringify({ data: exchangeRate, timestamp: Date.now() }),
    );

    await saveRateToHistory(rateValue, targetCurrency);
    return exchangeRate;
  } catch (error) {
    console.error("Failed to fetch latest exchange rate:", error);
    return null;
  }
}

export async function getHistoricalRate(date: string, targetCurrency: string = "AUD"): Promise<ExchangeRate | null> {
  try {
    const history = await ensureSufficientHistory(targetCurrency, 20);
    const day = history.find((h) => h.date.startsWith(date));
    if (!day) return getLatestExchangeRate(targetCurrency);

    return {
      timestamp: Math.floor(day.timestamp / 1000),
      base: "CNY",
      target: targetCurrency,
      rate: day.rate,
      rates: { [targetCurrency]: day.rate },
    };
  } catch {
    return null;
  }
}

export async function getTimeSeries(
  startDate: string,
  endDate: string,
  targetCurrency: string = "AUD",
): Promise<Record<string, ExchangeRate> | null> {
  try {
    const history = await ensureSufficientHistory(targetCurrency, 30);
    const result: Record<string, ExchangeRate> = {};

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime() + 24 * 60 * 60 * 1000;

    history.forEach((entry) => {
      if (entry.timestamp < startTime || entry.timestamp > endTime) return;
      const dateStr = entry.date.split("T")[0];
      result[dateStr] = {
        timestamp: Math.floor(entry.timestamp / 1000),
        base: "CNY",
        target: targetCurrency,
        rate: entry.rate,
        rates: { [targetCurrency]: entry.rate },
      };
    });

    if (Object.keys(result).length === 0) {
      const latest = await getLatestExchangeRate(targetCurrency);
      if (latest) {
        const dateStr = new Date().toISOString().split("T")[0];
        result[dateStr] = latest;
      }
    }

    return result;
  } catch (error) {
    console.error("Failed to get time series data:", error);
    return null;
  }
}

export async function calculate24hChange(targetCurrency: string = "AUD"): Promise<number> {
  try {
    const history = await ensureSufficientHistory(targetCurrency, 10);
    if (history.length < 2) return 0;

    const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
    const current = sorted[sorted.length - 1];
    const oneDayAgo = current.timestamp - 24 * 60 * 60 * 1000;

    const baseline = [...sorted].reverse().find((h) => h.timestamp <= oneDayAgo) || sorted[0];
    if (!baseline || baseline.rate <= 0) return 0;

    const change = ((current.rate - baseline.rate) / baseline.rate) * 100;
    return Number(change.toFixed(4));
  } catch (error) {
    console.error("Failed to calculate 24h change:", error);
    return 0;
  }
}

export async function saveRateToHistory(rate: number, currencyCode: string = "AUD"): Promise<void> {
  try {
    const history = await getRateHistory(currencyCode);
    const newEntry: RateHistory = {
      date: new Date().toISOString(),
      rate,
      timestamp: Date.now(),
      currencyCode,
    };

    const merged = normalizeHistory([...history, newEntry], currencyCode);
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const filtered = merged.filter((h) => h.timestamp > oneYearAgo);

    await AsyncStorage.setItem(`${CACHE_KEYS.RATE_HISTORY}_${currencyCode}`, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to save rate to history:", error);
  }
}

export async function getRateHistory(currencyCode: string = "AUD"): Promise<RateHistory[]> {
  try {
    const data = await AsyncStorage.getItem(`${CACHE_KEYS.RATE_HISTORY}_${currencyCode}`);
    const rows = data ? (JSON.parse(data) as RateHistory[]) : [];
    return normalizeHistory(rows, currencyCode);
  } catch (error) {
    console.error("Failed to get rate history:", error);
    return [];
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(
      (key) =>
        key.startsWith(CACHE_KEYS.LATEST_RATE) ||
        key.startsWith(CACHE_KEYS.HISTORICAL_RATES) ||
        key.startsWith(CACHE_KEYS.RATE_HISTORY),
    );
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

async function getCachedLatestRate(targetCurrency: string): Promise<ExchangeRate | null> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_KEYS.LATEST_RATE}_${targetCurrency}`);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached) as CachedData<ExchangeRate>;
    if (Date.now() - timestamp > CACHE_EXPIRY.LATEST) return null;
    return data;
  } catch (error) {
    console.error("Failed to get cached latest rate:", error);
    return null;
  }
}
