import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAlerts,
  addAlert,
  STORAGE_KEYS,
  Alert,
} from '../lib/services/storage';

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('Alert Save Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should save and retrieve alert correctly', async () => {
    // Initialize empty alerts list
    (AsyncStorage.getItem as any).mockResolvedValue(null);
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    // Create alert
    const newAlert = await addAlert({
      strategyId: 'test_strategy',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      emailNotificationEnabled: true,
      recipientEmail: 'test@example.com',
    });

    // Verify alert created
    expect(newAlert).toBeDefined();
    expect(newAlert.id).toBeDefined();
    expect(newAlert.createdAt).toBeDefined();
    expect(newAlert.type).toBe('price');
    expect(newAlert.condition).toBe('0.1850');
    expect(newAlert.currencyCode).toBe('AUD');
    expect(newAlert.emailNotificationEnabled).toBe(true);
    expect(newAlert.recipientEmail).toBe('test@example.com');

    // Verify AsyncStorage.setItem called
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.ALERTS,
      expect.any(String)
    );

    // Verify saved data contains new alert
    const callArgs = (AsyncStorage.setItem as any).mock.calls[0];
    const savedData = JSON.parse(callArgs[1]);
    expect(savedData).toHaveLength(1);
    expect(savedData[0].id).toBe(newAlert.id);
    expect(savedData[0].type).toBe('price');
  });

  it('should save alert with email notification enabled', async () => {
    (AsyncStorage.getItem as any).mockResolvedValue(null);
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    const emailAlert = await addAlert({
      strategyId: 'test_strategy',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      emailNotificationEnabled: true,
      recipientEmail: 'user@example.com',
    });

    // Verify email notification config saved
    const callArgs = (AsyncStorage.setItem as any).mock.calls[0];
    const savedData = JSON.parse(callArgs[1]);
    expect(savedData[0].emailNotificationEnabled).toBe(true);
    expect(savedData[0].recipientEmail).toBe('user@example.com');
  });

  it('should filter alerts by currency when retrieving', async () => {
    const audAlert: Alert = {
      id: 'alert_aud',
      strategyId: 'strategy_aud',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      createdAt: 1000000,
    };

    const usdAlert: Alert = {
      id: 'alert_usd',
      strategyId: 'strategy_usd',
      currencyCode: 'USD',
      type: 'price',
      condition: '6.50',
      isActive: true,
      createdAt: 1000001,
    };

    const allAlerts = [audAlert, usdAlert];

    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(allAlerts));

    // Get AUD alerts
    const audAlerts = await getAlerts('AUD');
    expect(audAlerts).toHaveLength(1);
    expect(audAlerts[0].currencyCode).toBe('AUD');

    // Get USD alerts
    const usdAlerts = await getAlerts('USD');
    expect(usdAlerts).toHaveLength(1);
    expect(usdAlerts[0].currencyCode).toBe('USD');
  });

  it('should handle alert creation with different types', async () => {
    (AsyncStorage.getItem as any).mockResolvedValue(null);
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    // Create price alert
    const priceAlert = await addAlert({
      strategyId: 'strategy_price',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
    });

    expect(priceAlert.type).toBe('price');

    // Reset mock
    vi.clearAllMocks();
    (AsyncStorage.getItem as any).mockResolvedValue(null);
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    // Create change alert
    const changeAlert = await addAlert({
      strategyId: 'strategy_change',
      currencyCode: 'USD',
      type: 'change',
      condition: '2%',
      isActive: true,
    });

    expect(changeAlert.type).toBe('change');

    // Reset mock
    vi.clearAllMocks();
    (AsyncStorage.getItem as any).mockResolvedValue(null);
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    // Create strategy alert
    const strategyAlert = await addAlert({
      strategyId: 'strategy_buy_at_0.18',
      currencyCode: 'AUD',
      type: 'strategy',
      condition: 'auto',
      isActive: true,
    });

    expect(strategyAlert.type).toBe('strategy');
  });
});
