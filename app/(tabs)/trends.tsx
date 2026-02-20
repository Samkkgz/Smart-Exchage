import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useCurrency } from "@/lib/currency-context";
import { addStrategy } from "@/lib/services/storage";
import { analyzeForCurrency } from "@/lib/services/analysis-engine";
import { getLatestExchangeRate, getRateHistory } from "@/lib/services/exchangerate-api";

type TimeRange = "1h" | "4h" | "1d" | "1w" | "1m";
type StrategyBuildMode = "target" | "trend" | "suggestion";

function buildStrategyName(mode: StrategyBuildMode, currencyCode: string): string {
  const modeLabel = mode === "target" ? "按目标价格" : mode === "trend" ? "按趋势" : "按分析建议";
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${modeLabel}-${currencyCode}-${date}`;
}

function getStartTimestamp(range: TimeRange): number {
  const now = Date.now();
  switch (range) {
    case "1h":
      return now - 1 * 60 * 60 * 1000;
    case "4h":
      return now - 4 * 60 * 60 * 1000;
    case "1d":
      return now - 24 * 60 * 60 * 1000;
    case "1w":
      return now - 7 * 24 * 60 * 60 * 1000;
    case "1m":
      return now - 30 * 24 * 60 * 60 * 1000;
    default:
      return now - 24 * 60 * 60 * 1000;
  }
}

export default function TrendsScreen() {
  const router = useRouter();
  const { defaultCurrency } = useCurrency();

  const [timeRange, setTimeRange] = useState<TimeRange>("1d");
  const [loading, setLoading] = useState(true);
  const [currentRate, setCurrentRate] = useState(0);
  const [trend, setTrend] = useState("sideways");
  const [strength, setStrength] = useState(0);
  const [volatility, setVolatility] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [reason, setReason] = useState("等待分析");
  const [stats, setStats] = useState({ min: 0, max: 0, avg: 0, count: 0 });

  const [modalVisible, setModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [buildMode, setBuildMode] = useState<StrategyBuildMode>("suggestion");
  const [formData, setFormData] = useState({
    targetRate: "",
    quantity: "",
    description: "",
  });

  const presetTargetByMode = useMemo(() => {
    if (!currentRate) return "";
    if (buildMode === "target") return formData.targetRate;

    if (buildMode === "trend") {
      const byTrend = trend === "up" ? currentRate * 0.992 : trend === "down" ? currentRate * 0.998 : currentRate * 0.995;
      return byTrend.toFixed(4);
    }

    const factor = confidence >= 0.75 ? 0.997 : confidence >= 0.6 ? 0.995 : 0.992;
    return (currentRate * factor).toFixed(4);
  }, [buildMode, confidence, currentRate, formData.targetRate, trend]);

  const loadData = useCallback(async () => {
    if (!defaultCurrency) return;
    setLoading(true);
    try {
      const [analysis, history, latest] = await Promise.all([
        analyzeForCurrency(defaultCurrency.code),
        getRateHistory(defaultCurrency.code),
        getLatestExchangeRate(defaultCurrency.code),
      ]);

      const nowRate = latest?.rate ?? analysis.latestRate;
      setCurrentRate(nowRate);
      setTrend(analysis.trend.trend);
      setStrength(analysis.trend.strength);
      setVolatility(analysis.trend.volatility);
      setConfidence(analysis.decision.confidence);
      setReason(analysis.decision.reason);

      const rangeStart = getStartTimestamp(timeRange);
      const values = history.filter((h) => h.timestamp >= rangeStart).map((h) => h.rate);
      if (values.length) {
        setStats({
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          count: values.length,
        });
      } else {
        setStats({ min: nowRate, max: nowRate, avg: nowRate, count: 1 });
      }
    } catch (error) {
      setReason(error instanceof Error ? error.message : "分析失败");
    } finally {
      setLoading(false);
    }
  }, [defaultCurrency, timeRange]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTimeRangeChange = async (range: TimeRange) => {
    setTimeRange(range);
  };

  const handleCreateStrategy = async () => {
    if (!defaultCurrency) {
      return;
    }

    const target = buildMode === "target" ? formData.targetRate : presetTargetByMode;
    if (!target) {
      alert("请填写目标汇率");
      return;
    }

    try {
      setIsCreating(true);
      const strategyName = buildStrategyName(buildMode, defaultCurrency.code);
      const extraDescription =
        buildMode === "trend"
          ? `按趋势创建: 当前趋势=${trend}, 强度=${(strength * 100).toFixed(2)}%`
          : buildMode === "suggestion"
            ? `按分析建议创建: 置信度=${(confidence * 100).toFixed(2)}%, 原因=${reason}`
            : "按目标价格创建";

      await addStrategy({
        currencyCode: defaultCurrency.code,
        name: strategyName,
        targetRate: parseFloat(target),
        quantity: formData.quantity ? parseFloat(formData.quantity) : 0,
        description: `${formData.description || ""}\n${extraDescription}`.trim(),
        status: "monitoring",
      });

      setModalVisible(false);
      setFormData({ targetRate: "", quantity: "", description: "" });
      setBuildMode("suggestion");
      alert("策略创建成功");
      router.push("/(tabs)/strategies");
    } catch (error) {
      alert("创建策略失败");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="pb-20">
        <View className="p-4">
          <Text className="text-2xl font-bold text-gray-800 mb-4">趋势分析</Text>

          <View className="flex-row gap-2 mb-4">
            {(["1h", "4h", "1d", "1w", "1m"] as TimeRange[]).map((range) => (
              <TouchableOpacity
                key={range}
                onPress={() => handleTimeRangeChange(range)}
                className={`flex-1 py-2 rounded-lg ${timeRange === range ? "bg-blue-500" : "bg-gray-200"}`}
              >
                <Text className={`text-center font-semibold ${timeRange === range ? "text-white" : "text-gray-700"}`}>
                  {range.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <Text className="text-sm text-gray-600 mb-2">当前汇率 CNY/{defaultCurrency?.code || "AUD"}</Text>
            <Text className="text-3xl font-bold text-gray-800">{currentRate.toFixed(4)}</Text>
            <Text className="text-sm text-gray-600 mt-2">趋势: {trend}</Text>
            <Text className="text-sm text-gray-600">趋势强度: {(strength * 100).toFixed(2)}%</Text>
            <Text className="text-sm text-gray-600">波动率(年化): {(volatility * 100).toFixed(2)}%</Text>
            <Text className="text-sm text-gray-600">买入置信度: {(confidence * 100).toFixed(2)}%</Text>
            <Text className="text-xs text-gray-500 mt-2">数据范围: 过去 {timeRange.toUpperCase()}</Text>
          </View>

          <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <Text className="font-bold text-gray-800 mb-2">自主分析结论</Text>
            <Text className="text-sm text-gray-600">{loading ? "分析中..." : reason}</Text>
          </View>

          <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <Text className="font-bold text-gray-800 mb-2">区间统计（{timeRange.toUpperCase()}）</Text>
            <Text className="text-sm text-gray-600">最高: {stats.max.toFixed(4)}</Text>
            <Text className="text-sm text-gray-600">最低: {stats.min.toFixed(4)}</Text>
            <Text className="text-sm text-gray-600">均值: {stats.avg.toFixed(4)}</Text>
            <Text className="text-sm text-gray-600">样本数: {stats.count}</Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              setBuildMode("suggestion");
              setFormData((prev) => ({ ...prev, targetRate: presetTargetByMode }));
              setModalVisible(true);
            }}
            className="bg-emerald-500 py-3 rounded-lg"
          >
            <Text className="text-white text-center font-semibold">按分析创建策略</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black bg-opacity-50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <Text className="text-xl font-bold text-gray-800 mb-4">创建策略</Text>

            <Text className="text-sm font-semibold text-gray-600 mb-2">创建方式</Text>
            <View className="flex-row gap-2 mb-4">
              {([
                { key: "target", label: "按目标价格" },
                { key: "trend", label: "按趋势" },
                { key: "suggestion", label: "按分析建议" },
              ] as { key: StrategyBuildMode; label: string }[]).map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => setBuildMode(item.key)}
                  className={`flex-1 py-2 rounded-lg ${buildMode === item.key ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <Text className={`text-center text-xs font-semibold ${buildMode === item.key ? "text-white" : "text-gray-700"}`}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-semibold text-gray-600 mb-2">策略名称（自动生成）</Text>
            <Text className="border border-gray-300 rounded-lg p-3 mb-4 text-gray-800">
              {buildStrategyName(buildMode, defaultCurrency?.code || "AUD")}
            </Text>

            <Text className="text-sm font-semibold text-gray-600 mb-2">目标汇率 *</Text>
            <TextInput
              placeholder="输入目标汇率"
              value={buildMode === "target" ? formData.targetRate : presetTargetByMode}
              editable={buildMode === "target"}
              onChangeText={(text) => setFormData({ ...formData, targetRate: text })}
              keyboardType="decimal-pad"
              className={`border rounded-lg p-3 mb-2 text-gray-800 ${buildMode === "target" ? "border-gray-300" : "border-blue-300 bg-blue-50"}`}
            />
            {buildMode !== "target" ? (
              <Text className="text-xs text-blue-600 mb-3">该方式将自动使用分析计算目标汇率</Text>
            ) : null}

            <Text className="text-sm font-semibold text-gray-600 mb-2">购买数量</Text>
            <TextInput
              placeholder="可选"
              value={formData.quantity}
              onChangeText={(text) => setFormData({ ...formData, quantity: text })}
              keyboardType="decimal-pad"
              className="border border-gray-300 rounded-lg p-3 mb-4 text-gray-800"
            />

            <Text className="text-sm font-semibold text-gray-600 mb-2">策略描述</Text>
            <TextInput
              placeholder="可选"
              value={formData.description}
              onChangeText={(text) => setFormData({ ...formData, description: text })}
              multiline
              numberOfLines={3}
              className="border border-gray-300 rounded-lg p-3 mb-4 text-gray-800"
            />

            <View className="flex-row gap-2">
              <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 bg-gray-200 py-3 rounded-lg">
                <Text className="text-gray-700 text-center font-semibold">取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateStrategy}
                disabled={isCreating}
                className={`${isCreating ? "bg-gray-400" : "bg-blue-500"} flex-1 py-3 rounded-lg`}
              >
                <Text className="text-white text-center font-semibold">{isCreating ? "创建中..." : "创建"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
