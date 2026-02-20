import React, { useMemo, useState } from "react";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useCurrency } from "@/lib/currency-context";
import {
  addTrackedCurrency,
  SUPPORTED_CURRENCIES,
  TrackedCurrency,
} from "@/lib/services/storage";

export function CurrencySwitcher() {
  const { defaultCurrency, setDefaultCurrency } = useCurrency();
  const [switching, setSwitching] = useState(false);
  const [open, setOpen] = useState(false);

  // 全球前十大可交易货币（本应用的追踪集合）
  const topCurrencies = useMemo(() => SUPPORTED_CURRENCIES, []);

  const onSwitch = async (currency: TrackedCurrency) => {
    if (switching || defaultCurrency?.code === currency.code) {
      setOpen(false);
      return;
    }
    try {
      setSwitching(true);
      await addTrackedCurrency({ ...currency, isDefault: false });
      await setDefaultCurrency(currency);
      setOpen(false);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <View className="bg-white rounded-xl border border-gray-200 p-3 mb-3">
      <Text className="text-gray-700 font-semibold mb-2">多币种选择</Text>

      <TouchableOpacity
        onPress={() => setOpen(true)}
        disabled={switching}
        className="border border-gray-300 rounded-lg px-3 py-3 flex-row items-center justify-between"
      >
        <Text className="text-gray-800 font-semibold">
          {defaultCurrency ? `CNY/${defaultCurrency.code} - ${defaultCurrency.name}` : "请选择币种"}
        </Text>
        <Text className="text-gray-500">▼</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <View className="flex-1 bg-black bg-opacity-40 justify-center px-6">
          <View className="bg-white rounded-xl p-4 max-h-[70%]">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-800">选择币种</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text className="text-xl text-gray-500">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {topCurrencies.map((currency) => {
                const selected = defaultCurrency?.code === currency.code;
                return (
                  <TouchableOpacity
                    key={currency.code}
                    onPress={() => onSwitch(currency)}
                    className={`rounded-lg border p-3 mb-2 ${selected ? "bg-blue-50 border-blue-500" : "bg-white border-gray-300"}`}
                  >
                    <Text className={`font-semibold ${selected ? "text-blue-700" : "text-gray-800"}`}>
                      CNY/{currency.code} - {currency.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
