import { describe, it, expect } from 'vitest';

/**
 * ExchangeRate API验证测试
 * 
 * 验证API密钥是否有效，以及API是否能正常返回数据
 */

describe('ExchangeRate API', () => {
  it('should validate API key and fetch latest rates', async () => {
    const apiKey = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API_KEY;
    
    // 检查API密钥是否已配置
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toEqual('');
    
    // 调用API验证密钥
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/CNY`
    );
    
    // 验证响应状态
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    // 验证响应数据格式
    const data = await response.json();
    expect(data.result).toBe('success');
    expect(data).toHaveProperty('conversion_rates');
    expect(data.conversion_rates).toHaveProperty('AUD');
    expect(typeof data.conversion_rates.AUD).toBe('number');
    expect(data.conversion_rates.AUD).toBeGreaterThan(0);
    
    console.log(`✓ API密钥有效，当前汇率: CNY/AUD = ${data.conversion_rates.AUD}`);
  });

  it('should handle invalid API key gracefully', async () => {
    const invalidKey = 'invalid_key_12345';
    
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${invalidKey}/latest/CNY`
    );
    
    // 无效密钥应返回错误状态
    expect(response.ok).toBe(false);
    expect([401, 403, 400, 404]).toContain(response.status);
  });

  it('should support CNY to AUD conversion', async () => {
    const apiKey = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API_KEY;
    
    if (!apiKey) {
      console.warn('API key not configured, skipping test');
      return;
    }

    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/CNY`
    );

    expect(response.ok).toBe(true);

    const data = await response.json();
    expect(data.base_code).toBe('CNY');
    expect(data.conversion_rates.AUD).toBeGreaterThan(0);
    expect(data.conversion_rates.AUD).toBeLessThan(1);
  });
});
