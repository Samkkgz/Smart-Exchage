# Open Exchange Rates API 集成指南

本文档说明如何将真实的Open Exchange Rates API密钥集成到应用中。

## 第一步：获取API密钥

### 方式1：使用现有密钥
如果您已有Open Exchange Rates账户，请：
1. 访问 https://openexchangerates.org/
2. 登录您的账户
3. 进入Dashboard
4. 找到您的 **App ID**（这就是API密钥）

### 方式2：创建新账户
如果您还没有账户，请：
1. 访问 https://openexchangerates.org/signup
2. 注册免费账户
3. 验证邮箱
4. 登录后在Dashboard获取App ID

**免费额度说明：**
- 1000请求/月（约33请求/天）
- 足以支持应用开发和测试
- 可随时升级到付费计划

## 第二步：配置API密钥

### 方法A：通过环境变量（推荐）

1. **在Manus UI中配置：**
   - 进入项目的 **Settings** → **Secrets**
   - 添加新的环境变量：
     - 键名：`EXPO_PUBLIC_EXCHANGE_RATE_API_KEY`
     - 值：您的App ID（例如：`dce8a9dfacd9911b42f84ec4`）
   - 保存

2. **或通过命令行：**
   ```bash
   # 在项目根目录创建或编辑 .env 文件
   EXPO_PUBLIC_EXCHANGE_RATE_API_KEY=your_app_id_here
   ```

### 方法B：直接修改代码（仅用于测试）

编辑 `lib/services/exchange-rate.ts`：

```typescript
// 第6行，修改为：
const API_KEY = 'your_app_id_here'; // 替换为您的App ID
```

## 第三步：切换到真实API服务

编辑 `app/(tabs)/index.tsx`，修改第5行的导入：

**当前（使用模拟数据）：**
```typescript
import { getLatestExchangeRate, calculate24hChange, ExchangeRate } from "@/lib/services/mock-exchange-rate";
```

**改为（使用真实API）：**
```typescript
import { getLatestExchangeRate, calculate24hChange, ExchangeRate } from "@/lib/services/exchange-rate";
```

## 第四步：验证配置

### 测试API连接

运行测试验证API密钥是否有效：

```bash
cd /home/ubuntu/cny_aud_exchange_monitor
pnpm test tests/exchange-rate.test.ts
```

**预期输出：**
```
✓ Exchange Rate API > should validate API key and fetch latest rates
✓ Exchange Rate API > should handle invalid API key gracefully
```

### 手动测试

在浏览器中访问（将YOUR_APP_ID替换为您的密钥）：
```
https://openexchangerates.org/api/latest.json?app_id=YOUR_APP_ID&base=CNY&symbols=AUD
```

应该返回类似的JSON响应：
```json
{
  "disclaimer": "...",
  "license": "...",
  "timestamp": 1708329600,
  "base": "CNY",
  "rates": {
    "AUD": 0.1850
  }
}
```

## 第五步：重启应用

配置完成后，重启开发服务器：

```bash
# 停止当前服务
Ctrl + C

# 重启服务
pnpm dev
```

## 常见问题

### Q1: API返回 "invalid_app_id" 错误

**原因：**
- API密钥格式不正确
- 密钥已过期或被禁用
- 复制时包含了额外空格

**解决：**
1. 检查API密钥是否正确复制（不包含空格）
2. 访问 https://openexchangerates.org/ 重新获取
3. 确保环境变量已正确保存

### Q2: API返回 "not_allowed" 错误

**原因：**
- 免费账户不支持该功能
- 请求参数不正确

**解决：**
- 确保使用的是 `/latest.json` 端点
- 检查请求参数是否正确

### Q3: 请求超时或无响应

**原因：**
- 网络连接问题
- API服务暂时不可用

**解决：**
- 检查网络连接
- 稍后重试
- 查看 https://status.openexchangerates.org/ 了解服务状态

### Q4: 如何在生产环境中安全存储API密钥？

**建议：**
1. 使用环境变量（不要提交到Git）
2. 在 `.gitignore` 中添加 `.env`
3. 使用密钥管理服务（如AWS Secrets Manager）
4. 不要在客户端代码中硬编码密钥

## 相关文件

| 文件 | 说明 |
|------|------|
| `lib/services/exchange-rate.ts` | 真实API服务（使用真实API密钥） |
| `lib/services/mock-exchange-rate.ts` | 模拟数据服务（用于开发测试） |
| `app/(tabs)/index.tsx` | 首页（导入切换点） |
| `tests/exchange-rate.test.ts` | API测试文件 |

## API文档参考

- **官方文档：** https://docs.openexchangerates.org/
- **支持的货币：** https://openexchangerates.org/currencies
- **API端点：**
  - `/latest.json` - 最新汇率
  - `/historical/{date}.json` - 历史汇率
  - `/time-series.json` - 时间序列数据

## 下一步

配置完成后，您可以：

1. **测试应用功能**
   - 验证首页汇率显示
   - 测试趋势分析
   - 创建和管理策略

2. **监控API使用**
   - 访问 https://openexchangerates.org/dashboard
   - 查看请求统计
   - 监控配额使用

3. **优化缓存策略**
   - 调整更新频率（当前为5分钟）
   - 优化本地存储
   - 减少API调用

## 支持

如有问题，请：
1. 查看 https://openexchangerates.org/help
2. 联系 support@openexchangerates.org
3. 检查应用日志获取错误信息
