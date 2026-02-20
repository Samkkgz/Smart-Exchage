import { describe, it, expect } from 'vitest';

/**
 * Exchange Rate API验证测试
 * 
 * 验证API密钥是否有效，以及API是否能正常返回数据
 */

describe('Exchange Rate API', () => {
  it('should validate API key and fetch latest rates', async () => {
    const apiKey = process.env.EXPO_PUBLIC_EXCHANGE_RATE_API_KEY;
    
    // 检查API密钥是否已配置
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toEqual('');
    
    // 调用API验证密钥
    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&base=CNY&symbols=AUD`
    );
    
    // 验证响应状态
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    
    // 验证响应数据格式
    const data = await response.json();
    expect(data).toHaveProperty('rates');
    expect(data.rates).toHaveProperty('AUD');
    expect(typeof data.rates.AUD).toBe('number');
    expect(data.rates.AUD).toBeGreaterThan(0);
    
    console.log(`✓ API密钥有效，当前汇率: CNY/AUD = ${data.rates.AUD}`);
  });

  it('should handle invalid API key gracefully', async () => {
    const invalidKey = 'invalid_key_12345';
    
    const response = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${invalidKey}&base=CNY&symbols=AUD`
    );
    
    // 无效密钥应返回错误状态
    expect(response.ok).toBe(false);
    expect([401, 403, 400]).toContain(response.status);
  });
});
