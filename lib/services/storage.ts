/**
 * Local Storage Service
 * 
 * 负责应用数据的本地存储和管理
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// 存储键
export const STORAGE_KEYS = {
  STRATEGIES: 'app_strategies',
  ALERTS: 'app_alerts',
  MONTHLY_EVALUATIONS: 'app_monthly_evaluations',
  EXECUTION_RECORDS: 'app_execution_records',
  APP_SETTINGS: 'app_settings',
  TRACKED_CURRENCIES: 'app_tracked_currencies',
};

// 支持的目标币种
export const SUPPORTED_CURRENCIES = [
  { code: 'AUD', name: '澳元', symbol: 'A$' },
  { code: 'USD', name: '美元', symbol: '$' },
  { code: 'EUR', name: '欧元', symbol: '€' },
  { code: 'GBP', name: '英镑', symbol: '£' },
  { code: 'JPY', name: '日元', symbol: '¥' },
  { code: 'SGD', name: '新加坡元', symbol: 'S$' },
  { code: 'HKD', name: '港元', symbol: 'HK$' },
  { code: 'CAD', name: '加元', symbol: 'C$' },
  { code: 'NZD', name: '新西兰元', symbol: 'NZ$' },
  { code: 'CHF', name: '瑞士法郎', symbol: 'CHF' },
];

// ============ 币种追踪 ============

export interface TrackedCurrency {
  code: string;
  name: string;
  symbol: string;
  isDefault?: boolean;
}

export async function getTrackedCurrencies(): Promise<TrackedCurrency[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TRACKED_CURRENCIES);
    if (data) {
      return JSON.parse(data);
    }
    // 默认追踪澳元
    const defaultCurrencies: TrackedCurrency[] = [
      { code: 'AUD', name: '澳元', symbol: 'A$', isDefault: true },
    ];
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_CURRENCIES, JSON.stringify(defaultCurrencies));
    return defaultCurrencies;
  } catch (error) {
    console.error('Failed to get tracked currencies:', error);
    return [];
  }
}

export async function addTrackedCurrency(currency: TrackedCurrency): Promise<void> {
  try {
    const currencies = await getTrackedCurrencies();
    // 检查是否已存在
    if (!currencies.find((c) => c.code === currency.code)) {
      currencies.push(currency);
      await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_CURRENCIES, JSON.stringify(currencies));
    }
  } catch (error) {
    console.error('Failed to add tracked currency:', error);
  }
}

export async function removeTrackedCurrency(currencyCode: string): Promise<void> {
  try {
    const currencies = await getTrackedCurrencies();
    const filtered = currencies.filter((c) => c.code !== currencyCode);
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_CURRENCIES, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to remove tracked currency:', error);
  }
}

export async function setDefaultCurrency(currencyCode: string): Promise<void> {
  try {
    const currencies = await getTrackedCurrencies();
    const updated = currencies.map((c) => ({
      ...c,
      isDefault: c.code === currencyCode,
    }));
    await AsyncStorage.setItem(STORAGE_KEYS.TRACKED_CURRENCIES, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to set default currency:', error);
  }
}

export async function getDefaultCurrency(): Promise<TrackedCurrency | null> {
  try {
    const currencies = await getTrackedCurrencies();
    return currencies.find((c) => c.isDefault) || currencies[0] || null;
  } catch (error) {
    console.error('Failed to get default currency:', error);
    return null;
  }
}

// ============ 策略管理 ============

export interface Strategy {
  id: string;
  name: string;
  currencyCode: string; // 新增：目标币种代码
  targetRate: number;
  quantity?: number;
  status: 'monitoring' | 'triggered' | 'completed' | 'cancelled';
  createdAt: number;
  triggeredAt?: number;
  completedAt?: number;
  description?: string;
}

export async function getStrategies(currencyCode?: string): Promise<Strategy[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.STRATEGIES);
    let strategies = data ? JSON.parse(data) : [];
    
    // 如果指定了币种，则过滤
    if (currencyCode) {
      strategies = strategies.filter((s: Strategy) => s.currencyCode === currencyCode);
    }
    
    return strategies;
  } catch (error) {
    console.error('Failed to get strategies:', error);
    return [];
  }
}

export async function addStrategy(strategy: Omit<Strategy, 'id' | 'createdAt'>): Promise<Strategy> {
  try {
    const strategies = await getStrategies();
    const newStrategy: Strategy = {
      ...strategy,
      id: `strategy_${Date.now()}`,
      createdAt: Date.now(),
    };
    strategies.push(newStrategy);
    await AsyncStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify(strategies));
    return newStrategy;
  } catch (error) {
    console.error('Failed to add strategy:', error);
    throw error;
  }
}

export async function updateStrategy(id: string, updates: Partial<Strategy>): Promise<void> {
  try {
    const strategies = await getStrategies();
    const index = strategies.findIndex((s) => s.id === id);
    if (index !== -1) {
      strategies[index] = { ...strategies[index], ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify(strategies));
    }
  } catch (error) {
    console.error('Failed to update strategy:', error);
  }
}

export async function deleteStrategy(id: string): Promise<void> {
  try {
    const strategies = await getStrategies();
    const filtered = strategies.filter((s) => s.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.STRATEGIES, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete strategy:', error);
  }
}

// ============ 提醒管理 ============

export interface Alert {
  id: string;
  strategyId: string;
  currencyCode: string; // 新增：目标币种代码
  type: 'price' | 'change' | 'strategy';
  condition: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  triggeredAt?: number;
  emailNotificationEnabled?: boolean; // 是否启用邮件提醒
  recipientEmail?: string; // 接收邮件的地址
}

export async function getAlerts(currencyCode?: string): Promise<Alert[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ALERTS);
    let alerts = data ? JSON.parse(data) : [];
    
    if (currencyCode) {
      alerts = alerts.filter((a: Alert) => a.currencyCode === currencyCode);
    }
    
    return alerts;
  } catch (error) {
    console.error('Failed to get alerts:', error);
    return [];
  }
}

export async function addAlert(alert: Omit<Alert, 'id' | 'createdAt'>): Promise<Alert> {
  try {
    const alerts = await getAlerts();
    const newAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}`,
      createdAt: Date.now(),
    };
    alerts.push(newAlert);
    await AsyncStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
    return newAlert;
  } catch (error) {
    console.error('Failed to add alert:', error);
    throw error;
  }
}

export async function updateAlert(id: string, updates: Partial<Alert>): Promise<void> {
  try {
    const alerts = await getAlerts();
    const index = alerts.findIndex((a) => a.id === id);
    if (index !== -1) {
      alerts[index] = { ...alerts[index], ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(alerts));
    }
  } catch (error) {
    console.error('Failed to update alert:', error);
  }
}

export async function deleteAlert(id: string): Promise<void> {
  try {
    const alerts = await getAlerts();
    const filtered = alerts.filter((a) => a.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete alert:', error);
  }
}

// ============ 月度评估 ============

export interface MonthlyEvaluation {
  id: string;
  month: string;
  currencyCode: string; // 新增：目标币种代码
  totalStrategies: number;
  successfulTriggers: number;
  accuracy: number;
  averageReturn: number;
  recommendations: string[];
  createdAt: number;
}

export async function getMonthlyEvaluations(currencyCode?: string): Promise<MonthlyEvaluation[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.MONTHLY_EVALUATIONS);
    let evaluations = data ? JSON.parse(data) : [];
    
    if (currencyCode) {
      evaluations = evaluations.filter((e: MonthlyEvaluation) => e.currencyCode === currencyCode);
    }
    
    return evaluations;
  } catch (error) {
    console.error('Failed to get monthly evaluations:', error);
    return [];
  }
}

export async function addMonthlyEvaluation(
  evaluation: Omit<MonthlyEvaluation, 'id' | 'createdAt'>
): Promise<MonthlyEvaluation> {
  try {
    const evaluations = await getMonthlyEvaluations();
    const newEvaluation: MonthlyEvaluation = {
      ...evaluation,
      id: `evaluation_${Date.now()}`,
      createdAt: Date.now(),
    };
    evaluations.push(newEvaluation);
    await AsyncStorage.setItem(STORAGE_KEYS.MONTHLY_EVALUATIONS, JSON.stringify(evaluations));
    return newEvaluation;
  } catch (error) {
    console.error('Failed to add monthly evaluation:', error);
    throw error;
  }
}

export async function updateMonthlyEvaluation(
  id: string,
  updates: Partial<MonthlyEvaluation>
): Promise<void> {
  try {
    const evaluations = await getMonthlyEvaluations();
    const index = evaluations.findIndex((e) => e.id === id);
    if (index !== -1) {
      evaluations[index] = { ...evaluations[index], ...updates };
      await AsyncStorage.setItem(STORAGE_KEYS.MONTHLY_EVALUATIONS, JSON.stringify(evaluations));
    }
  } catch (error) {
    console.error('Failed to update monthly evaluation:', error);
  }
}

// ============ 执行记录 ============

export interface ExecutionRecord {
  id: string;
  strategyId: string;
  currencyCode: string; // 新增：目标币种代码
  executedAt: number;
  rate: number;
  quantity: number;
  result: 'success' | 'partial' | 'failed';
  notes?: string;
}

export async function getExecutionRecords(currencyCode?: string): Promise<ExecutionRecord[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EXECUTION_RECORDS);
    let records = data ? JSON.parse(data) : [];
    
    if (currencyCode) {
      records = records.filter((r: ExecutionRecord) => r.currencyCode === currencyCode);
    }
    
    return records;
  } catch (error) {
    console.error('Failed to get execution records:', error);
    return [];
  }
}

export async function addExecutionRecord(
  record: Omit<ExecutionRecord, 'id'>
): Promise<ExecutionRecord> {
  try {
    const records = await getExecutionRecords();
    const newRecord: ExecutionRecord = {
      ...record,
      id: `record_${Date.now()}`,
    };
    records.push(newRecord);
    await AsyncStorage.setItem(STORAGE_KEYS.EXECUTION_RECORDS, JSON.stringify(records));
    return newRecord;
  } catch (error) {
    console.error('Failed to add execution record:', error);
    throw error;
  }
}

// ============ 应用设置 ============

export interface AppSettings {
  defaultCurrency: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: boolean;
  updateFrequency: number; // 分钟
  autoAnalyzeEnabled: boolean;
  autoCalibrateEnabled: boolean;
  minConfidence: number;
  emailNotificationsEnabled: boolean;
  emailProvider: 'resend';
  exchangeRateApiKey?: string;
  emailAddress?: string;
}

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.APP_SETTINGS);
    return data
      ? JSON.parse(data)
      : {
          defaultCurrency: 'AUD',
          theme: 'auto',
          notifications: true,
          updateFrequency: 5,
          autoAnalyzeEnabled: true,
          autoCalibrateEnabled: true,
          minConfidence: 0.7,
          emailNotificationsEnabled: false,
          emailProvider: 'resend',
          exchangeRateApiKey: 'bd575de2682cf6fd74775b13',
          emailAddress: '',
        };
  } catch (error) {
    console.error('Failed to get app settings:', error);
    return {
      defaultCurrency: 'AUD',
      theme: 'auto',
      notifications: true,
      updateFrequency: 5,
      autoAnalyzeEnabled: true,
      autoCalibrateEnabled: true,
      minConfidence: 0.7,
      emailNotificationsEnabled: false,
      emailProvider: 'resend',
      exchangeRateApiKey: 'bd575de2682cf6fd74775b13',
      emailAddress: '',
    };
  }
}

export async function updateAppSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    const currentSettings = await getAppSettings();
    const updated = { ...currentSettings, ...settings };
    await AsyncStorage.setItem(STORAGE_KEYS.APP_SETTINGS, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update app settings:', error);
  }
}

export async function upsertMonthlyEvaluationByMonth(
  month: string,
  currencyCode: string,
  updates: Omit<MonthlyEvaluation, 'id' | 'createdAt' | 'month' | 'currencyCode'>
): Promise<MonthlyEvaluation> {
  const evaluations = await getMonthlyEvaluations();
  const found = evaluations.find((e) => e.month === month && e.currencyCode === currencyCode);
  if (found) {
    await updateMonthlyEvaluation(found.id, {
      ...updates,
      month,
      currencyCode,
    });
    return {
      ...found,
      ...updates,
      month,
      currencyCode,
    };
  }
  return addMonthlyEvaluation({
    month,
    currencyCode,
    ...updates,
  });
}
