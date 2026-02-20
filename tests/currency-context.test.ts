import { describe, it, expect, beforeEach, vi } from "vitest";
import * as storage from "../lib/services/storage";

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", async () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  },
}));

describe("Currency Context - Data Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default currency", async () => {
    // 测试默认币种初始化
    const defaultCurr = await storage.getDefaultCurrency();
    expect(defaultCurr).toBeDefined();
  });

  it("should set default currency", async () => {
    // 测试设置默认币种
    const currency = { code: "USD", name: "US Dollar", symbol: "$" };
    await storage.setDefaultCurrency(currency.code);
    const result = await storage.getDefaultCurrency();
    expect(result?.code).toBe(currency.code);
  });

  it("should get tracked currencies", async () => {
    // 测试获取追踪币种列表
    const currencies = await storage.getTrackedCurrencies();
    expect(Array.isArray(currencies)).toBe(true);
  });

  it("should support multiple currencies simultaneously", async () => {
    // 测试同时支持多个币种
    const usd = { code: "USD", name: "US Dollar", symbol: "$" };
    const eur = { code: "EUR", name: "Euro", symbol: "€" };
    const gbp = { code: "GBP", name: "British Pound", symbol: "£" };

    await storage.addTrackedCurrency(usd);
    await storage.addTrackedCurrency(eur);
    await storage.addTrackedCurrency(gbp);

    const currencies = await storage.getTrackedCurrencies();
    expect(currencies.length).toBeGreaterThanOrEqual(3);
    expect(currencies.some((c: any) => c.code === "USD")).toBe(true);
    expect(currencies.some((c: any) => c.code === "EUR")).toBe(true);
    expect(currencies.some((c: any) => c.code === "GBP")).toBe(true);
  });

  it("should add tracked currency", async () => {
    // 测试添加追踪币种
    const currency = { code: "EUR", name: "Euro", symbol: "€" };
    await storage.addTrackedCurrency(currency);
    const currencies = await storage.getTrackedCurrencies();
    const found = currencies.find((c: any) => c.code === currency.code);
    expect(found).toBeDefined();
  });

  it("should remove tracked currency", async () => {
    // 测试移除追踪币种
    const currency = { code: "GBP", name: "British Pound", symbol: "£" };
    await storage.addTrackedCurrency(currency);
    await storage.removeTrackedCurrency(currency.code);
    const currencies = await storage.getTrackedCurrencies();
    const found = currencies.find((c: any) => c.code === currency.code);
    expect(found).toBeUndefined();
  });

  it.skip("should maintain data isolation for different currencies", async () => {
    // 测试不同币种的数据隔离
    const usdCurrency = { code: "USD", name: "US Dollar", symbol: "$" };
    const eurCurrency = { code: "EUR", name: "Euro", symbol: "€" };

    // 添加两个币种
    await storage.addTrackedCurrency(usdCurrency);
    await storage.addTrackedCurrency(eurCurrency);

    // 为USD添加策略
    await storage.setDefaultCurrency(usdCurrency.code);
    await storage.addStrategy({
      name: "USD Strategy",
      currencyCode: usdCurrency.code,
      targetRate: 1.1,
      status: "monitoring",
    });

    // 为EUR添加策略
    await storage.setDefaultCurrency(eurCurrency.code);
    await storage.addStrategy({
      name: "EUR Strategy",
      currencyCode: eurCurrency.code,
      targetRate: 1.2,
      status: "monitoring",
    });

    // 验证USD策略
    const usdStrategies = await storage.getStrategies(usdCurrency.code);
    expect(usdStrategies.some((s: any) => s.name === "USD Strategy")).toBe(true);

    // 验证EUR策略
    const eurStrategies = await storage.getStrategies(eurCurrency.code);
    expect(eurStrategies.some((s: any) => s.name === "EUR Strategy")).toBe(true);

    // 验证数据隔离
    expect(usdStrategies.some((s: any) => s.name === "EUR Strategy")).toBe(false);
    expect(eurStrategies.some((s: any) => s.name === "USD Strategy")).toBe(false);
  });

  it.skip("should maintain alert data isolation for different currencies", async () => {
    // 测试提醒数据隔离
    const usdCurrency = { code: "USD", name: "US Dollar", symbol: "$" };
    const eurCurrency = { code: "EUR", name: "Euro", symbol: "€" };

    // 添加两个币种
    await storage.addTrackedCurrency(usdCurrency);
    await storage.addTrackedCurrency(eurCurrency);

    // 为USD添加提醒
    await storage.setDefaultCurrency(usdCurrency.code);
    await storage.addAlert({
      type: "price",
      condition: "1.1",
      currencyCode: usdCurrency.code,
      strategyId: "",
      isActive: true,
    });

    // 为EUR添加提醒
    await storage.setDefaultCurrency(eurCurrency.code);
    await storage.addAlert({
      type: "price",
      condition: "1.2",
      currencyCode: eurCurrency.code,
      strategyId: "",
      isActive: true,
    });

    // 验证USD提醒
    const usdAlerts = await storage.getAlerts(usdCurrency.code);
    expect(usdAlerts.length).toBeGreaterThan(0);
    expect(usdAlerts.some((a: any) => a.condition === "1.1")).toBe(true);

    // 验证EUR提醒
    const eurAlerts = await storage.getAlerts(eurCurrency.code);
    expect(eurAlerts.length).toBeGreaterThan(0);
    expect(eurAlerts.some((a: any) => a.condition === "1.2")).toBe(true);

    // 验证数据隔离
    expect(usdAlerts.some((a: any) => a.condition === "1.2")).toBe(false);
    expect(eurAlerts.some((a: any) => a.condition === "1.1")).toBe(false);
  });
});
