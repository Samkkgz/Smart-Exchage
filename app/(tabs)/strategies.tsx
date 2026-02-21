import { useState } from "react";
import { useFocusEffect } from "expo-router";
import React from "react";
import { View, Text, TouchableOpacity, TextInput, Modal, FlatList, Alert } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { getStrategies, addStrategy, deleteStrategy } from "@/lib/services/storage";
import { calculate24hChange, getLatestExchangeRate } from "@/lib/services/exchangerate-api";
import { analyzeForCurrency } from "@/lib/services/analysis-engine";
import { useCurrency } from "@/lib/currency-context";

type StrategyBuildMode = "target" | "trend" | "suggestion";

function buildStrategyName(mode: StrategyBuildMode, currencyCode: string): string {
  const modeLabel = mode === "target" ? "按目标价格" : mode === "trend" ? "按趋势" : "按分析建议";
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${modeLabel}-${currencyCode}-${date}`;
}

export default function StrategiesScreen() {
  const { defaultCurrency } = useCurrency();
  const [strategies, setStrategies] = useState<any[]>([]);
  const [currentRate, setCurrentRate] = useState<number>(0);
  const [change24h, setChange24h] = useState<number>(0);
  const [trend, setTrend] = useState("sideways");
  const [strength, setStrength] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [buildMode, setBuildMode] = useState<StrategyBuildMode>("suggestion");
  const [formData, setFormData] = useState({
    targetRate: "",
    quantity: "",
    description: "",
  });

  const presetTargetByMode = React.useMemo(() => {
    if (!currentRate) return "";
    if (buildMode === "target") return formData.targetRate;
    if (buildMode === "trend") {
      const byTrend = trend === "up" ? currentRate * 0.992 : trend === "down" ? currentRate * 0.998 : currentRate * 0.995;
      return byTrend.toFixed(4);
    }
    const factor = confidence >= 0.75 ? 0.997 : confidence >= 0.6 ? 0.995 : 0.992;
    return (currentRate * factor).toFixed(4);
  }, [buildMode, confidence, currentRate, formData.targetRate, trend]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      if (defaultCurrency) {
        const [strats, rate, dailyChange, analysis] = await Promise.all([
          getStrategies(defaultCurrency.code),
          getLatestExchangeRate(defaultCurrency.code),
          calculate24hChange(defaultCurrency.code),
          analyzeForCurrency(defaultCurrency.code),
        ]);
        setStrategies(strats || []);
        setCurrentRate(rate?.rate || analysis.latestRate || 0);
        setChange24h(dailyChange || 0);
        setTrend(analysis.trend.trend);
        setStrength(analysis.trend.strength);
        setConfidence(analysis.decision.confidence);
        setReason(analysis.decision.reason);
      }
    } catch {
      setStrategies([]);
    } finally {
      setLoading(false);
    }
  }, [defaultCurrency]);

  useFocusEffect(
    React.useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleCreateStrategy = async () => {
    if (!defaultCurrency) return;

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
      await loadData();
      alert("策略创建成功");
    } catch {
      alert("创建策略失败");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteStrategy = (strategyId: string) => {
    Alert.alert("删除策略", "确定要删除这个策略吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        onPress: async () => {
          await deleteStrategy(strategyId);
          await loadData();
        },
        style: "destructive",
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "monitoring":
        return "bg-blue-50 border-l-4 border-blue-500";
      case "triggered":
        return "bg-green-50 border-l-4 border-green-500";
      case "completed":
        return "bg-gray-50 border-l-4 border-gray-500";
      default:
        return "bg-white border-l-4 border-gray-300";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "monitoring":
        return "监控中";
      case "triggered":
        return "已触发";
      case "completed":
        return "已完成";
      default:
        return status;
    }
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        <View className="p-4 pb-0">
          <Text className="text-2xl font-bold text-gray-800 mb-2">买入策略</Text>
          <CurrencySwitcher />
          {defaultCurrency && (
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-sm text-gray-600">当前汇率</Text>
                <Text className="text-xl font-bold text-blue-600">{currentRate.toFixed(4)}</Text>
                <Text className={`text-xs font-semibold ${change24h >= 0 ? "text-green-600" : "text-red-600"}`}>
                  较昨日 {change24h >= 0 ? "上涨" : "下跌"} {Math.abs(change24h).toFixed(2)}%
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setBuildMode("suggestion");
                  setFormData((prev) => ({ ...prev, targetRate: presetTargetByMode }));
                  setModalVisible(true);
                }}
                className="bg-blue-500 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">+ 新建策略</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-600">加载中...</Text>
          </View>
        ) : strategies.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-gray-600 text-center mb-4">还没有创建任何策略</Text>
            <TouchableOpacity onPress={() => setModalVisible(true)} className="bg-blue-500 px-6 py-3 rounded-lg">
              <Text className="text-white font-semibold">创建第一个策略</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={strategies}
            keyExtractor={(item, index) => item.id ?? `${item.name}-${index}`}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View className={`rounded-lg p-4 ${getStatusColor(item.status)}`}>
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-800">{item.name}</Text>
                    <Text className="text-xs text-gray-600 mt-1">状态: {getStatusLabel(item.status)}</Text>
                  </View>
                  <View className="bg-white px-3 py-1 rounded-full">
                    <Text className="text-xs font-semibold text-gray-700">{new Date(item.createdAt).toLocaleDateString()}</Text>
                  </View>
                </View>

                <View className="bg-white bg-opacity-60 rounded-lg p-3 mb-3">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-sm text-gray-600">目标汇率</Text>
                    <Text className="text-sm font-bold text-gray-800">{item.targetRate.toFixed(4)}</Text>
                  </View>
                  {item.quantity > 0 && (
                    <View className="flex-row justify-between">
                      <Text className="text-sm text-gray-600">数量</Text>
                      <Text className="text-sm font-bold text-gray-800">{item.quantity}</Text>
                    </View>
                  )}
                </View>

                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedStrategy(item);
                      setDetailVisible(true);
                    }}
                    className="flex-1 bg-white bg-opacity-70 py-2 rounded-lg active:opacity-80"
                  >
                    <Text className="text-gray-700 font-semibold text-center text-sm">查看详情</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteStrategy(item.id)}
                    className="flex-1 bg-red-500 py-2 rounded-lg active:opacity-80"
                  >
                    <Text className="text-white font-semibold text-center text-sm">删除</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>

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
            {buildMode !== "target" ? <Text className="text-xs text-blue-600 mb-3">该方式将自动使用分析计算目标汇率</Text> : null}

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

      <Modal visible={detailVisible} transparent animationType="fade">
        <View className="flex-1 bg-black bg-opacity-40 justify-center px-6">
          <View className="bg-white rounded-xl p-5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-lg font-bold text-gray-800">策略详情</Text>
              <TouchableOpacity onPress={() => setDetailVisible(false)}>
                <Text className="text-xl text-gray-400">✕</Text>
              </TouchableOpacity>
            </View>
            {selectedStrategy ? (
              <>
                <Text className="text-sm text-gray-700 mb-1">名称: {selectedStrategy.name}</Text>
                <Text className="text-sm text-gray-700 mb-1">状态: {getStatusLabel(selectedStrategy.status)}</Text>
                <Text className="text-sm text-gray-700 mb-1">目标汇率: {selectedStrategy.targetRate?.toFixed(4)}</Text>
                <Text className="text-sm text-gray-700 mb-1">数量: {selectedStrategy.quantity || 0}</Text>
                <Text className="text-sm text-gray-700 mb-1">创建时间: {new Date(selectedStrategy.createdAt).toLocaleString()}</Text>
                <Text className="text-sm text-gray-700 mt-2">描述: {selectedStrategy.description || "无"}</Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
