# 汇率API调研报告

## 项目需求

开发人民币兑澳币（CNY/AUD）汇率监控应用，需要：
- 实时汇率数据
- 历史数据支持
- 技术指标计算（MA、RSI、MACD等）
- 可靠的API服务

---

## API方案对比

### 1. Open Exchange Rates（推荐）

**优点：**
- 支持CNY和AUD货币对
- 免费额度：1000请求/月（约33请求/天）
- 简单易用的JSON API
- 支持历史数据（end-of-day）
- 支持时间序列数据
- 超过7年的可靠性记录
- 被100,000+开发者使用

**缺点：**
- 免费额度有限（1000请求/月）
- 无实时K线数据（仅end-of-day）
- 需要API密钥

**定价：**
- 免费层：1000请求/月
- 付费层：从$12/月开始

**支持的货币：**
- CNY（中国人民币）✓
- AUD（澳大利亚元）✓

**API端点：**
```
GET https://openexchangerates.org/api/latest.json
  ?app_id=YOUR_APP_ID
  &base=CNY
  &symbols=AUD

GET https://openexchangerates.org/api/historical/2024-02-20.json
  ?app_id=YOUR_APP_ID
  &base=CNY
  &symbols=AUD

GET https://openexchangerates.org/api/time-series.json
  ?app_id=YOUR_APP_ID
  &start_date=2024-02-01
  &end_date=2024-02-20
  &base=CNY
  &symbols=AUD
```

**响应示例：**
```json
{
  "disclaimer": "https://openexchangerates.org/terms/",
  "license": "https://openexchangerates.org/license/",
  "timestamp": 1708420800,
  "base": "CNY",
  "rates": {
    "AUD": 0.1850
  }
}
```

---

### 2. Alpha Vantage

**优点：**
- 支持外汇（Forex）数据
- 免费API密钥
- 支持实时和历史数据
- 支持技术指标
- 被NASDAQ认可

**缺点：**
- 免费额度限制（5请求/分钟）
- 文档相对复杂
- 需要验证免费额度是否支持CNY/AUD

**定价：**
- 免费层：5请求/分钟

**API端点：**
```
https://www.alphavantage.co/query
  ?function=CURRENCY_EXCHANGE_RATE
  &from_currency=CNY
  &to_currency=AUD
  &apikey=YOUR_API_KEY

https://www.alphavantage.co/query
  ?function=FX_DAILY
  &from_symbol=CNY
  &to_symbol=AUD
  &apikey=YOUR_API_KEY
```

---

### 3. ExchangeRate-API

**优点：**
- 支持165种货币
- 免费无需API密钥（有限制）
- 简单易用

**缺点：**
- 免费额度非常有限
- 无历史数据支持
- 更新频率较低

---

## 推荐方案

**选择：Open Exchange Rates**

**理由：**
1. 明确支持CNY和AUD货币对
2. 免费额度虽然有限，但足以支持应用开发和测试
3. API设计简洁，易于集成
4. 支持历史数据和时间序列，满足趋势分析需求
5. 可靠性高，被大量生产应用使用

**使用策略：**
1. 开发阶段使用免费API密钥
2. 实现本地缓存机制，减少API调用
3. 设置合理的更新频率（例如每5分钟更新一次）
4. 后期如需更高频率更新，可升级到付费计划

---

## 数据更新策略

### 缓存机制

```
- 实时汇率：缓存5分钟
- 历史数据：缓存24小时
- 时间序列：缓存1小时
```

### 更新频率

```
- 首页实时汇率：5分钟更新一次
- 趋势图表：用户打开时获取最新数据
- 后台策略检查：每分钟检查一次（本地计算，无API调用）
```

---

## 技术实现

### 前端集成

```typescript
// 获取最新汇率
const fetchLatestRate = async (appId: string) => {
  const response = await fetch(
    `https://openexchangerates.org/api/latest.json?app_id=${appId}&base=CNY&symbols=AUD`
  );
  return response.json();
};

// 获取历史数据
const fetchHistoricalRates = async (appId: string, date: string) => {
  const response = await fetch(
    `https://openexchangerates.org/api/historical/${date}.json?app_id=${appId}&base=CNY&symbols=AUD`
  );
  return response.json();
};

// 获取时间序列数据
const fetchTimeSeries = async (appId: string, startDate: string, endDate: string) => {
  const response = await fetch(
    `https://openexchangerates.org/api/time-series.json?app_id=${appId}&start_date=${startDate}&end_date=${endDate}&base=CNY&symbols=AUD`
  );
  return response.json();
};
```

### 后端集成（可选）

如果使用后端服务器，可在服务器端调用API并缓存结果，减少前端API调用。

---

## 后续步骤

1. 获取Open Exchange Rates免费API密钥
2. 在项目中配置API密钥（环境变量）
3. 实现数据获取服务
4. 实现本地缓存机制
5. 实现数据模型和存储
6. 开发UI组件展示数据
