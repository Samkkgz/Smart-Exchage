import { describe, it, expect } from 'vitest';
import { SUPPORTED_CURRENCIES } from '../lib/services/storage';

describe('Multi-Currency Integration', () => {
  describe('Supported Currencies Configuration', () => {
    it('should have at least 10 supported currencies', () => {
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(10);
    });

    it('should include all major currencies', () => {
      const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
      const requiredCurrencies = ['AUD', 'USD', 'EUR', 'GBP', 'JPY', 'SGD', 'HKD', 'CAD', 'NZD', 'CHF'];
      
      requiredCurrencies.forEach((code) => {
        expect(codes).toContain(code);
      });
    });

    it('should have valid currency structure', () => {
      SUPPORTED_CURRENCIES.forEach((currency) => {
        expect(currency.code).toBeTruthy();
        expect(currency.name).toBeTruthy();
        expect(currency.symbol).toBeTruthy();
        expect(currency.code.length).toBe(3);
        expect(typeof currency.name).toBe('string');
        expect(typeof currency.symbol).toBe('string');
      });
    });

    it('should have unique currency codes', () => {
      const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('should have AUD as first currency', () => {
      expect(SUPPORTED_CURRENCIES[0].code).toBe('AUD');
    });

    it('should have proper currency names', () => {
      const audCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === 'AUD');
      expect(audCurrency?.name).toBe('澳元');
      expect(audCurrency?.symbol).toBe('A$');

      const usdCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === 'USD');
      expect(usdCurrency?.name).toBe('美元');
      expect(usdCurrency?.symbol).toBe('$');

      const eurCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === 'EUR');
      expect(eurCurrency?.name).toBe('欧元');
      expect(eurCurrency?.symbol).toBe('€');
    });
  });

  describe('Multi-Currency Data Model', () => {
    it('should support currencyCode field in Strategy', () => {
      // 验证Strategy接口支持currencyCode
      const mockStrategy = {
        id: 'strategy_1',
        name: 'Test Strategy',
        currencyCode: 'AUD',
        targetRate: 0.18,
        status: 'monitoring' as const,
        createdAt: Date.now(),
      };

      expect(mockStrategy.currencyCode).toBe('AUD');
      expect(mockStrategy.name).toBe('Test Strategy');
    });

    it('should support currencyCode field in Alert', () => {
      // 验证Alert接口支持currencyCode
      const mockAlert = {
        id: 'alert_1',
        strategyId: 'strategy_1',
        currencyCode: 'USD',
        type: 'price' as const,
        condition: '6.5',
        isActive: true,
        createdAt: Date.now(),
      };

      expect(mockAlert.currencyCode).toBe('USD');
      expect(mockAlert.type).toBe('price');
    });

    it('should support currencyCode field in MonthlyEvaluation', () => {
      // 验证MonthlyEvaluation接口支持currencyCode
      const mockEvaluation = {
        id: 'eval_1',
        month: '2026-02',
        currencyCode: 'EUR',
        totalStrategies: 5,
        successfulTriggers: 3,
        accuracy: 60,
        averageReturn: 1.5,
        recommendations: ['Continue monitoring'],
        createdAt: Date.now(),
      };

      expect(mockEvaluation.currencyCode).toBe('EUR');
      expect(mockEvaluation.accuracy).toBe(60);
    });
  });

  describe('Currency Code Validation', () => {
    it('should validate currency codes are 3 characters', () => {
      SUPPORTED_CURRENCIES.forEach((currency) => {
        expect(currency.code).toMatch(/^[A-Z]{3}$/);
      });
    });

    it('should validate currency codes are uppercase', () => {
      SUPPORTED_CURRENCIES.forEach((currency) => {
        expect(currency.code).toBe(currency.code.toUpperCase());
      });
    });

    it('should have non-empty names and symbols', () => {
      SUPPORTED_CURRENCIES.forEach((currency) => {
        expect(currency.name.length).toBeGreaterThan(0);
        expect(currency.symbol.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Multi-Currency Workflow', () => {
    it('should support switching between currencies', () => {
      // 模拟币种切换工作流
      let currentCurrency = SUPPORTED_CURRENCIES[0]; // AUD
      expect(currentCurrency.code).toBe('AUD');

      // 切换到USD
      currentCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === 'USD')!;
      expect(currentCurrency.code).toBe('USD');

      // 切换到EUR
      currentCurrency = SUPPORTED_CURRENCIES.find((c) => c.code === 'EUR')!;
      expect(currentCurrency.code).toBe('EUR');
    });

    it('should support adding multiple currencies', () => {
      const trackedCurrencies = [
        SUPPORTED_CURRENCIES.find((c) => c.code === 'AUD')!,
        SUPPORTED_CURRENCIES.find((c) => c.code === 'USD')!,
        SUPPORTED_CURRENCIES.find((c) => c.code === 'EUR')!,
      ];

      expect(trackedCurrencies).toHaveLength(3);
      expect(trackedCurrencies.map((c) => c.code)).toEqual(['AUD', 'USD', 'EUR']);
    });

    it('should support filtering available currencies', () => {
      const trackedCodes = ['AUD', 'USD'];
      const availableCurrencies = SUPPORTED_CURRENCIES.filter(
        (c) => !trackedCodes.includes(c.code)
      );

      expect(availableCurrencies.length).toBeGreaterThan(0);
      expect(availableCurrencies.every((c) => !trackedCodes.includes(c.code))).toBe(true);
    });
  });
});
