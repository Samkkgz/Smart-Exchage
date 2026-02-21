import { useState } from "react";
import { useFocusEffect } from "expo-router";
import React from "react";
import { View, Text, TouchableOpacity, FlatList } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { getMonthlyEvaluations, MonthlyEvaluation } from "@/lib/services/storage";
import { useCurrency } from "@/lib/currency-context";
import { runMonitoringCycle } from "@/lib/services/analysis-engine";

export default function EvaluationScreen() {
  const { defaultCurrency } = useCurrency();
  const [evaluations, setEvaluations] = useState<MonthlyEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      if (defaultCurrency) {
        const data = await getMonthlyEvaluations(defaultCurrency.code);
        setEvaluations((data || []).sort((a, b) => b.month.localeCompare(a.month)));
      }
    } catch {
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  }, [defaultCurrency]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefreshEvaluation = async () => {
    if (!defaultCurrency) return;
    try {
      setRunning(true);
      await runMonitoringCycle(defaultCurrency);
      await loadData();
      alert("已刷新月度评估并执行策略校准");
    } catch {
      alert("刷新评估失败");
    } finally {
      setRunning(false);
    }
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        <View className="p-4 pb-0">
          <Text className="text-2xl font-bold text-gray-800 mb-2">月度评估与校准</Text>
          <CurrencySwitcher />
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-gray-600 text-sm">已生成 {evaluations.length} 份评估</Text>
            <TouchableOpacity
              onPress={handleRefreshEvaluation}
              disabled={running}
              className={`${running ? "bg-gray-400" : "bg-blue-500"} px-3 py-2 rounded-lg`}
            >
              <Text className="text-white font-semibold text-sm">{running ? "执行中..." : "立即刷新"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-600">加载中...</Text>
          </View>
        ) : evaluations.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-gray-600 text-center">暂无评估数据，先在首页执行一次分析</Text>
          </View>
        ) : (
          <FlatList
            data={evaluations}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingTop: 0 }}
            renderItem={({ item }) => (
              <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <View className="flex-row justify-between items-start mb-3">
                  <View>
                    <Text className="text-lg font-bold text-gray-800">{item.month}</Text>
                    <Text className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${item.accuracy >= 60 ? "bg-green-100" : item.accuracy >= 40 ? "bg-yellow-100" : "bg-red-100"}`}>
                    <Text className={`text-sm font-bold ${item.accuracy >= 60 ? "text-green-600" : item.accuracy >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                      {item.accuracy.toFixed(1)}%
                    </Text>
                  </View>
                </View>

                <View className="space-y-2 mb-3">
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600 text-sm">触发策略数</Text>
                    <Text className="font-semibold text-gray-800">{item.totalStrategies}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600 text-sm">成功触发</Text>
                    <Text className="font-semibold text-gray-800">{item.successfulTriggers}</Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text className="text-gray-600 text-sm">平均收益</Text>
                    <Text className={`font-semibold ${item.averageReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {item.averageReturn >= 0 ? "+" : ""}
                      {item.averageReturn.toFixed(2)}%
                    </Text>
                  </View>
                </View>

                {item.recommendations?.length ? (
                  <View className="bg-blue-50 rounded-lg p-3">
                    <Text className="text-xs font-semibold text-blue-600 mb-1">校准建议:</Text>
                    {item.recommendations.map((suggestion, idx) => (
                      <Text key={idx} className="text-xs text-blue-600 mb-1">• {suggestion}</Text>
                    ))}
                  </View>
                ) : null}
              </View>
            )}
          />
        )}
      </View>
    </ScreenContainer>
  );
}
