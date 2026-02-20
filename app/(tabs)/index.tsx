import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { useCurrency } from "@/lib/currency-context";
import { analyzeForCurrency, runMonitoringCycle } from "@/lib/services/analysis-engine";
import { calculate24hChange } from "@/lib/services/exchangerate-api";

export default function HomeScreen() {
  const { defaultCurrency } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [latestRate, setLatestRate] = useState<number>(0);
  const [change24h, setChange24h] = useState<number>(0);
  const [trend, setTrend] = useState("-");
  const [confidence, setConfidence] = useState(0);
  const [reason, setReason] = useState("等待分析");
  const [lastRunAt, setLastRunAt] = useState<string>("");
  const [lastError, setLastError] = useState<string>("");

  const load = useCallback(async () => {
    if (!defaultCurrency) return;
    setLoading(true);
    setLastError("");
    try {
      await runMonitoringCycle(defaultCurrency);
      const [analyzed, dailyChange] = await Promise.all([
        analyzeForCurrency(defaultCurrency.code),
        calculate24hChange(defaultCurrency.code),
      ]);
      setLatestRate(analyzed.latestRate);
      setChange24h(dailyChange || 0);
      setTrend(analyzed.trend.trend);
      setConfidence(analyzed.decision.confidence);
      setReason(analyzed.decision.reason);
      setLastRunAt(new Date().toLocaleString());
    } catch (error) {
      const message = error instanceof Error ? error.message : "分析失败";
      setLastError(message);
      setReason(`分析失败: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [defaultCurrency]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const isUp = change24h >= 0;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text className="text-2xl font-bold text-gray-800 mb-4">汇率监控首页</Text>

        <CurrencySwitcher />

        <View className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <Text className="text-gray-600 text-sm mb-1">当前汇率</Text>
          <Text className="text-3xl font-bold text-gray-800">
            CNY/{defaultCurrency?.code || "AUD"} {latestRate.toFixed(4)}
          </Text>
          <Text className={`text-sm mt-2 font-semibold ${isUp ? "text-green-600" : "text-red-600"}`}>
            较昨日 {isUp ? "上涨" : "下跌"} {Math.abs(change24h).toFixed(2)}%
          </Text>
          <Text className="text-sm text-gray-600 mt-1">趋势: {trend}</Text>
          <Text className="text-sm text-gray-600">置信度: {(confidence * 100).toFixed(1)}%</Text>
          <Text className="text-xs text-gray-500 mt-2">最近执行: {lastRunAt || "未执行"}</Text>
        </View>

        <View className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <Text className="text-gray-700 font-semibold mb-2">自主分析结果</Text>
          <Text className="text-gray-600 text-sm">{loading ? "分析中，请稍候..." : reason}</Text>
          {lastError ? <Text className="text-red-600 text-xs mt-2">错误: {lastError}</Text> : null}
        </View>

        <TouchableOpacity
          onPress={load}
          disabled={loading}
          className={`${loading ? "bg-gray-400" : "bg-blue-500"} rounded-xl py-3`}
        >
          <Text className="text-white text-center font-semibold">
            {loading ? "分析中..." : "立即执行自主分析"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
