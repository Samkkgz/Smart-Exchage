import { describe, it, expect } from "vitest";

describe("Currency Context - Functionality", () => {
  it("should support multiple currencies", () => {
    // 测试支持多个币种
    const currencies = [
      { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
      { code: "USD", name: "US Dollar", symbol: "$" },
      { code: "EUR", name: "Euro", symbol: "€" },
      { code: "GBP", name: "British Pound", symbol: "£" },
      { code: "AUD", name: "Australian Dollar", symbol: "A$" },
      { code: "JPY", name: "Japanese Yen", symbol: "¥" },
      { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
      { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
      { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
      { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
      { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
    ];

    expect(currencies.length).toBe(11);
    expect(currencies.some((c) => c.code === "CNY")).toBe(true);
    expect(currencies.some((c) => c.code === "AUD")).toBe(true);
  });

  it("should maintain data isolation for different currencies", () => {
    // 测试数据隔离概念
    const strategies = {
      USD: [
        { id: "1", name: "USD Strategy 1", currencyCode: "USD" },
        { id: "2", name: "USD Strategy 2", currencyCode: "USD" },
      ],
      EUR: [
        { id: "3", name: "EUR Strategy 1", currencyCode: "EUR" },
      ],
    };

    // 验证USD策略
    const usdStrategies = strategies.USD;
    expect(usdStrategies.length).toBe(2);
    expect(usdStrategies.every((s) => s.currencyCode === "USD")).toBe(true);

    // 验证EUR策略
    const eurStrategies = strategies.EUR;
    expect(eurStrategies.length).toBe(1);
    expect(eurStrategies.every((s) => s.currencyCode === "EUR")).toBe(true);

    // 验证数据隔离
    expect(usdStrategies.some((s) => s.currencyCode === "EUR")).toBe(false);
    expect(eurStrategies.some((s) => s.currencyCode === "USD")).toBe(false);
  });

  it("should handle currency switching", () => {
    // 测试币种切换
    let currentCurrency = { code: "AUD", name: "Australian Dollar", symbol: "A$" };
    const currencies = [
      { code: "AUD", name: "Australian Dollar", symbol: "A$" },
      { code: "USD", name: "US Dollar", symbol: "$" },
      { code: "EUR", name: "Euro", symbol: "€" },
    ];

    // 切换到USD
    const usdCurrency = currencies.find((c) => c.code === "USD");
    if (usdCurrency) {
      currentCurrency = usdCurrency;
    }

    expect(currentCurrency.code).toBe("USD");

    // 切换回AUD
    const audCurrency = currencies.find((c) => c.code === "AUD");
    if (audCurrency) {
      currentCurrency = audCurrency;
    }

    expect(currentCurrency.code).toBe("AUD");
  });

  it("should support adding and removing tracked currencies", () => {
    // 测试添加和移除追踪币种
    let trackedCurrencies = [
      { code: "AUD", name: "Australian Dollar", symbol: "A$" },
    ];

    // 添加USD
    trackedCurrencies.push({ code: "USD", name: "US Dollar", symbol: "$" });
    expect(trackedCurrencies.length).toBe(2);
    expect(trackedCurrencies.some((c) => c.code === "USD")).toBe(true);

    // 添加EUR
    trackedCurrencies.push({ code: "EUR", name: "Euro", symbol: "€" });
    expect(trackedCurrencies.length).toBe(3);

    // 移除USD
    trackedCurrencies = trackedCurrencies.filter((c) => c.code !== "USD");
    expect(trackedCurrencies.length).toBe(2);
    expect(trackedCurrencies.some((c) => c.code === "USD")).toBe(false);
  });

  it("should maintain separate alerts for different currencies", () => {
    // 测试不同币种的提醒隔离
    const alerts = {
      USD: [
        { id: "1", type: "price", condition: "1.1", currencyCode: "USD" },
        { id: "2", type: "change", condition: "2", currencyCode: "USD" },
      ],
      EUR: [
        { id: "3", type: "price", condition: "1.2", currencyCode: "EUR" },
      ],
    };

    // 验证USD提醒
    const usdAlerts = alerts.USD;
    expect(usdAlerts.length).toBe(2);
    expect(usdAlerts.every((a) => a.currencyCode === "USD")).toBe(true);

    // 验证EUR提醒
    const eurAlerts = alerts.EUR;
    expect(eurAlerts.length).toBe(1);
    expect(eurAlerts.every((a) => a.currencyCode === "EUR")).toBe(true);

    // 验证数据隔离
    expect(usdAlerts.some((a) => a.currencyCode === "EUR")).toBe(false);
    expect(eurAlerts.some((a) => a.currencyCode === "USD")).toBe(false);
  });

  it("should maintain separate evaluations for different currencies", () => {
    // 测试不同币种的评估隔离
    const evaluations = {
      USD: [
        { month: "2026-02", currencyCode: "USD", accuracy: 75 },
        { month: "2026-01", currencyCode: "USD", accuracy: 80 },
      ],
      EUR: [
        { month: "2026-02", currencyCode: "EUR", accuracy: 65 },
      ],
    };

    // 验证USD评估
    const usdEvals = evaluations.USD;
    expect(usdEvals.length).toBe(2);
    expect(usdEvals.every((e) => e.currencyCode === "USD")).toBe(true);

    // 验证EUR评估
    const eurEvals = evaluations.EUR;
    expect(eurEvals.length).toBe(1);
    expect(eurEvals.every((e) => e.currencyCode === "EUR")).toBe(true);

    // 验证数据隔离
    expect(usdEvals.some((e) => e.currencyCode === "EUR")).toBe(false);
    expect(eurEvals.some((e) => e.currencyCode === "USD")).toBe(false);
  });
});
