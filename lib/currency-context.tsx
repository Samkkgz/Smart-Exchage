import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getDefaultCurrency, setDefaultCurrency as setDefaultCurrencyStorage, TrackedCurrency } from "./services/storage";

interface CurrencyContextType {
  defaultCurrency: TrackedCurrency | null;
  setDefaultCurrency: (currency: TrackedCurrency | null) => Promise<void>;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [defaultCurrency, setDefaultCurrencyState] = useState<TrackedCurrency | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化加载默认币种
  useEffect(() => {
    const loadDefaultCurrency = async () => {
      try {
        const currency = await getDefaultCurrency();
        setDefaultCurrencyState(currency);
      } catch (error) {
        console.error("Failed to load default currency:", error);
      } finally {
        setLoading(false);
      }
    };

    loadDefaultCurrency();
  }, []);

  // 设置默认币种
  const setDefaultCurrency = async (currency: TrackedCurrency | null) => {
    try {
      if (currency) {
        await setDefaultCurrencyStorage(currency.code);
        setDefaultCurrencyState(currency);
      }
    } catch (error) {
      console.error("Failed to set default currency:", error);
      throw error;
    }
  };

  return (
    <CurrencyContext.Provider value={{ defaultCurrency, setDefaultCurrency, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
