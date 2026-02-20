import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAlerts,
  addAlert,
  deleteAlert,
  updateAlert,
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

describe('Alert Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 为了避免类型错误，将AsyncStorage.getItem转换为any类型
  const getItemMock = AsyncStorage.getItem as any;
  const setItemMock = AsyncStorage.setItem as any;

  it('should create a price alert with email notification', async () => {
    const mockAlerts: Alert[] = [];
    
    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockAlerts));
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    const newAlert = await addAlert({
      strategyId: 'test_strategy_1',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      emailNotificationEnabled: true,
      recipientEmail: 'user@example.com',
    });

    expect(newAlert).toBeDefined();
    expect(newAlert.type).toBe('price');
    expect(newAlert.condition).toBe('0.1850');
    expect(newAlert.emailNotificationEnabled).toBe(true);
    expect(newAlert.recipientEmail).toBe('user@example.com');
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('should create a change alert without email notification', async () => {
    const mockAlerts: Alert[] = [];
    
    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockAlerts));
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    const newAlert = await addAlert({
      strategyId: 'test_strategy_2',
      currencyCode: 'USD',
      type: 'change',
      condition: '2%',
      isActive: true,
      emailNotificationEnabled: false,
    });

    expect(newAlert).toBeDefined();
    expect(newAlert.type).toBe('change');
    expect(newAlert.condition).toBe('2%');
    expect(newAlert.emailNotificationEnabled).toBe(false);
    expect(newAlert.recipientEmail).toBeUndefined();
  });

  it('should create a strategy alert', async () => {
    const mockAlerts: Alert[] = [];
    
    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockAlerts));
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    const newAlert = await addAlert({
      strategyId: 'strategy_buy_at_0.18',
      currencyCode: 'AUD',
      type: 'strategy',
      condition: 'auto',
      isActive: true,
      emailNotificationEnabled: true,
      recipientEmail: 'trader@example.com',
    });

    expect(newAlert).toBeDefined();
    expect(newAlert.type).toBe('strategy');
    expect(newAlert.strategyId).toBe('strategy_buy_at_0.18');
    expect(newAlert.emailNotificationEnabled).toBe(true);
  });

  it('should update alert status', async () => {
    const existingAlert: Alert = {
      id: 'alert_123',
      strategyId: 'test_strategy',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      createdAt: Date.now(),
      emailNotificationEnabled: true,
      recipientEmail: 'user@example.com',
    };

    const mockAlerts = [existingAlert];
    
    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockAlerts));
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    await updateAlert('alert_123', { isActive: false });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.ALERTS,
      expect.stringContaining('"isActive":false')
    );
  });

  it('should delete an alert', async () => {
    const alert1: Alert = {
      id: 'alert_1',
      strategyId: 'test_strategy_1',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      createdAt: Date.now(),
    };

    const alert2: Alert = {
      id: 'alert_2',
      strategyId: 'test_strategy_2',
      currencyCode: 'USD',
      type: 'change',
      condition: '2%',
      isActive: true,
      createdAt: Date.now(),
    };

    const mockAlerts = [alert1, alert2];
    
    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockAlerts));
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    await deleteAlert('alert_1');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.ALERTS,
      expect.stringContaining('alert_2')
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEYS.ALERTS,
      expect.not.stringContaining('alert_1')
    );
  });

  it('should filter alerts by currency code', async () => {
    const audAlert: Alert = {
      id: 'alert_aud',
      strategyId: 'test_strategy',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      createdAt: Date.now(),
    };

    const usdAlert: Alert = {
      id: 'alert_usd',
      strategyId: 'test_strategy',
      currencyCode: 'USD',
      type: 'price',
      condition: '6.50',
      isActive: true,
      createdAt: Date.now(),
    };

    const mockAlerts = [audAlert, usdAlert];
    
    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockAlerts));

    const audAlerts = await getAlerts('AUD');

    expect(audAlerts).toHaveLength(1);
    expect(audAlerts[0].currencyCode).toBe('AUD');
  });

  it('should support email notification configuration', async () => {
    const mockAlerts: Alert[] = [];
    
    (AsyncStorage.getItem as any).mockResolvedValue(JSON.stringify(mockAlerts));
    (AsyncStorage.setItem as any).mockResolvedValue(undefined);

    const emailAlert = await addAlert({
      strategyId: 'test_strategy',
      currencyCode: 'AUD',
      type: 'price',
      condition: '0.1850',
      isActive: true,
      emailNotificationEnabled: true,
      recipientEmail: 'important@example.com',
    });

    expect(emailAlert.emailNotificationEnabled).toBe(true);
    expect(emailAlert.recipientEmail).toBe('important@example.com');

    // Test updating email
    await updateAlert(emailAlert.id, {
      recipientEmail: 'newemail@example.com',
    });

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
