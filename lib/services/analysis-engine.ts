import {
  addExecutionRecord,
  Alert,
  getAlerts,
  getAppSettings,
  getExecutionRecords,
  getStrategies,
  TrackedCurrency,
  updateAlert,
  updateStrategy,
  upsertMonthlyEvaluationByMonth,
} from "@/lib/services/storage";
import {
  calculate24hChange,
  getLatestExchangeRate,
  getRateHistory,
  ensureSufficientHistory,
} from "@/lib/services/exchangerate-api";
import { sendEmailNotification } from "@/lib/services/email-notification";
import { sendInAppAlert } from "@/lib/services/notification-service";

export interface TrendSignal {
  trend: "up" | "down" | "sideways";
  strength: number;
  volatility: number;
  momentum5d: number;
  momentum20d: number;
  zscore20d: number;
}

export interface StrategyDecision {
  shouldBuy: boolean;
  confidence: number;
  reason: string;
}

function mean(sample: number[]): number {
  if (sample.length === 0) return 0;
  return sample.reduce((a, b) => a + b, 0) / sample.length;
}

function stdev(sample: number[]): number {
  if (sample.length < 2) return 0;
  const m = mean(sample);
  const variance = sample.reduce((acc, v) => acc + (v - m) ** 2, 0) / sample.length;
  return Math.sqrt(variance);
}

export async function analyzeForCurrency(currencyCode: string): Promise<{
  latestRate: number;
  trend: TrendSignal;
  decision: StrategyDecision;
}> {
  const latest = await getLatestExchangeRate(currencyCode);
  if (!latest) {
    throw new Error(`无法获取 CNY/${currencyCode} 最新汇率`);
  }

  await ensureSufficientHistory(currencyCode, 60);
  const history = await getRateHistory(currencyCode);
  const rates = history.map((h) => h.rate).filter((v) => Number.isFinite(v));

  if (rates.length < 25) {
    return {
      latestRate: latest.rate,
      trend: {
        trend: "sideways",
        strength: 0,
        volatility: 0,
        momentum5d: 0,
        momentum20d: 0,
        zscore20d: 0,
      },
      decision: {
        shouldBuy: false,
        confidence: 0.2,
        reason: "历史数据不足，继续积累数据",
      },
    };
  }

  const curr = latest.rate;
  const maShort = mean(rates.slice(-5));
  const maLong = mean(rates.slice(-20));
  const strength = maLong === 0 ? 0 : Math.abs((maShort - maLong) / maLong);

  const returns = rates.slice(1).map((v, idx) => (rates[idx] > 0 ? v / rates[idx] - 1 : 0));
  const vol20 = stdev(returns.slice(-20)) * Math.sqrt(252);
  const momentum5 = rates.length > 5 ? curr / rates[rates.length - 6] - 1 : 0;
  const momentum20 = rates.length > 20 ? curr / rates[rates.length - 21] - 1 : 0;

  const longWindow = rates.slice(-20);
  const std20 = stdev(longWindow);
  const zscore20 = std20 > 0 ? (curr - mean(longWindow)) / std20 : 0;

  let trend: TrendSignal["trend"] = "sideways";
  if (maShort > maLong && momentum5 > 0) trend = "up";
  if (maShort < maLong && momentum5 < 0) trend = "down";

  const settings = await getAppSettings();
  const minConfidence = Number(settings.minConfidence || 0.7);

  const shouldBuy = zscore20 <= -1.0 && strength >= 0.0015 && vol20 <= 0.18 && momentum5 >= -0.01;
  const confidence = Math.max(0, Math.min(0.99, 0.38 + Math.abs(Math.min(zscore20, 0)) * 0.16 + (0.18 - vol20) * 1.15));

  return {
    latestRate: curr,
    trend: {
      trend,
      strength,
      volatility: vol20,
      momentum5d: momentum5,
      momentum20d: momentum20,
      zscore20d: zscore20,
    },
    decision: {
      shouldBuy: shouldBuy && confidence >= minConfidence,
      confidence,
      reason: `z=${zscore20.toFixed(2)}, 强度=${strength.toFixed(4)}, 波动率=${(vol20 * 100).toFixed(2)}%`,
    },
  };
}

function parseCondition(condition: string): { operator: "lte" | "gte"; value: number } | null {
  const txt = condition.trim();
  if (!txt) return null;
  if (txt.startsWith("<=")) {
    const n = Number(txt.slice(2));
    return Number.isFinite(n) ? { operator: "lte", value: n } : null;
  }
  if (txt.startsWith(">=")) {
    const n = Number(txt.slice(2));
    return Number.isFinite(n) ? { operator: "gte", value: n } : null;
  }
  const raw = Number(txt);
  if (Number.isFinite(raw)) return { operator: "lte", value: raw };
  return null;
}

function checkAlertTriggered(
  alert: Alert,
  currentRate: number,
  dailyChange: number,
  strategyTriggeredIds: Set<string>,
): { triggered: boolean; message: string } {
  if (alert.type === "strategy") {
    const hit = strategyTriggeredIds.has(alert.strategyId);
    return { triggered: hit, message: hit ? "策略触发提醒" : "" };
  }

  if (alert.type === "change") {
    const threshold = Math.abs(Number(alert.condition));
    const hit = Number.isFinite(threshold) && Math.abs(dailyChange) >= threshold;
    return {
      triggered: hit,
      message: hit ? `24h涨跌幅 ${dailyChange.toFixed(2)}% 超过阈值 ${threshold.toFixed(2)}%` : "",
    };
  }

  const parsed = parseCondition(alert.condition);
  if (!parsed) return { triggered: false, message: "" };
  const hit = parsed.operator === "lte" ? currentRate <= parsed.value : currentRate >= parsed.value;
  return {
    triggered: hit,
    message: hit ? `价格条件触发: 当前 ${currentRate.toFixed(4)}, 条件 ${alert.condition}` : "",
  };
}

export async function runMonitoringCycle(currency: TrackedCurrency): Promise<void> {
  const settings = await getAppSettings();
  const { latestRate, trend, decision } = await analyzeForCurrency(currency.code);
  const [strategies, alerts, dailyChange] = await Promise.all([
    getStrategies(currency.code),
    getAlerts(currency.code),
    calculate24hChange(currency.code),
  ]);

  const monitoringStrategies = strategies.filter((s) => s.status === "monitoring");
  const strategyTriggeredIds = new Set<string>();

  for (const strategy of monitoringStrategies) {
    const targetReached = latestRate <= strategy.targetRate;
    const shouldTrigger = targetReached || decision.shouldBuy;
    if (!shouldTrigger) continue;

    strategyTriggeredIds.add(strategy.id);
    await updateStrategy(strategy.id, {
      status: "triggered",
      triggeredAt: Date.now(),
      description: `${strategy.description || ""}\n自动分析触发: ${decision.reason}`.trim(),
    });

    await addExecutionRecord({
      strategyId: strategy.id,
      currencyCode: currency.code,
      executedAt: Date.now(),
      rate: latestRate,
      quantity: strategy.quantity || 0,
      result: "success",
      notes: `auto-trigger confidence=${decision.confidence.toFixed(2)} trend=${trend.trend}`,
    });

    await sendInAppAlert(
      `${currency.code} 策略触发`,
      `${strategy.name} 已触发，当前 ${latestRate.toFixed(4)}，置信度 ${(decision.confidence * 100).toFixed(1)}%`,
    );
  }

  const activeAlerts = alerts.filter((a) => a.isActive);
  for (const alert of activeAlerts) {
    const checked = checkAlertTriggered(alert, latestRate, dailyChange, strategyTriggeredIds);
    if (!checked.triggered) continue;

    await updateAlert(alert.id, { triggeredAt: Date.now() });

    const title = `${currency.code} 提醒`;
    await sendInAppAlert(title, checked.message);

    const emailTo = alert.recipientEmail || settings.emailAddress;
    if (settings.emailNotificationsEnabled && alert.emailNotificationEnabled && emailTo) {
      await sendEmailNotification({
        recipientEmail: emailTo,
        subject: `[FX提醒] CNY/${currency.code}`,
        message: `${checked.message}\n当前汇率: ${latestRate.toFixed(4)}\n分析: ${decision.reason}`,
      });
    }
  }

  await recomputeMonthlyEvaluation(currency.code, settings.autoCalibrateEnabled);
}

async function recomputeMonthlyEvaluation(currencyCode: string, autoCalibrate: boolean): Promise<void> {
  const records = (await getExecutionRecords(currencyCode)).sort((a, b) => a.executedAt - b.executedAt);
  if (records.length === 0) return;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthRecords = records.filter((r) => {
    const d = new Date(r.executedAt);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return k === month;
  });

  if (monthRecords.length === 0) return;

  const success = monthRecords.filter((r) => r.result === "success").length;
  const accuracy = monthRecords.length > 0 ? (success / monthRecords.length) * 100 : 0;
  const averageReturn = accuracy >= 50 ? Math.min(3, accuracy / 30) : -Math.min(3, (50 - accuracy) / 15);

  const recommendations: string[] = [];
  if (accuracy < 50) recommendations.push("准确率偏低，建议提高买入阈值并降低频率");
  if (accuracy >= 70) recommendations.push("策略表现稳定，可适度放宽入场条件");

  await upsertMonthlyEvaluationByMonth(month, currencyCode, {
    totalStrategies: monthRecords.length,
    successfulTriggers: success,
    accuracy,
    averageReturn,
    recommendations,
  });

  if (!autoCalibrate) return;

  const strategyList = await getStrategies(currencyCode);
  const monitoring = strategyList.filter((s) => s.status === "monitoring");
  for (const s of monitoring) {
    const calibratedTarget = accuracy < 50 ? s.targetRate * 0.997 : accuracy >= 70 ? s.targetRate * 1.001 : s.targetRate;
    if (Math.abs(calibratedTarget - s.targetRate) > 0.000001) {
      await updateStrategy(s.id, {
        targetRate: Number(calibratedTarget.toFixed(4)),
      });
    }
  }
}
