import { useState } from "react";
import { useFocusEffect } from "expo-router";
import React from "react";
import { View, Text, TouchableOpacity, TextInput, Modal, FlatList, Alert, ScrollView } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { CurrencySwitcher } from "@/components/currency-switcher";
import {
  getAlerts,
  addAlert,
  deleteAlert,
  getStrategies,
  getAppSettings,
} from "@/lib/services/storage";
import { runMonitoringCycle } from "@/lib/services/analysis-engine";
import { useCurrency } from "@/lib/currency-context";

type AlertType = "price" | "strategy";

export default function AlertsScreen() {
  const { defaultCurrency } = useCurrency();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [running, setRunning] = useState(false);
  const [globalRecipientEmail, setGlobalRecipientEmail] = useState("");

  const [formData, setFormData] = useState({
    type: "price" as AlertType,
    condition: "",
    strategyId: "",
    emailNotificationEnabled: false,
  });

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      if (defaultCurrency) {
        const [alertsData, strategiesData, appSettings] = await Promise.all([
          getAlerts(defaultCurrency.code),
          getStrategies(defaultCurrency.code),
          getAppSettings(),
        ]);
        setAlerts(alertsData || []);
        setStrategies(strategiesData || []);
        setGlobalRecipientEmail(appSettings.emailAddress || "");
      }
    } catch {
      setAlerts([]);
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

  const handleRunMonitorNow = async () => {
    if (!defaultCurrency) return;
    try {
      setRunning(true);
      await runMonitoringCycle(defaultCurrency);
      await loadData();
      alert("监控已执行");
    } catch {
      alert("执行监控失败");
    } finally {
      setRunning(false);
    }
  };

  const handleCreateAlert = async () => {
    if (!defaultCurrency) {
      alert("请先选择币种");
      return;
    }

    if (formData.type === "price" && !formData.condition) {
      alert("请输入价格条件，例如 <=0.1850");
      return;
    }

    if (formData.type === "strategy" && !formData.strategyId) {
      alert("请选择策略");
      return;
    }

    if (formData.emailNotificationEnabled && !globalRecipientEmail) {
      alert("请先到设置页填写收件邮箱");
      return;
    }

    try {
      setIsCreating(true);
      await addAlert({
        strategyId: formData.type === "strategy" ? formData.strategyId : `manual_${Date.now()}`,
        type: formData.type,
        condition: formData.type === "strategy" ? "auto" : formData.condition,
        currencyCode: defaultCurrency.code,
        recipientEmail: formData.emailNotificationEnabled ? globalRecipientEmail : undefined,
        emailNotificationEnabled: formData.emailNotificationEnabled,
        isActive: true,
      });

      setModalVisible(false);
      setFormData({ type: "price", condition: "", strategyId: "", emailNotificationEnabled: false });
      await loadData();
      alert("提醒创建成功");
    } catch {
      alert("创建提醒失败");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScreenContainer>
      <View className="flex-1">
        <View className="p-4 pb-0">
          <Text className="text-2xl font-bold text-gray-800 mb-2">提醒中心</Text>
          <CurrencySwitcher />

          <View className="flex-row justify-between items-center mb-4 gap-2">
            <TouchableOpacity onPress={() => setModalVisible(true)} className="bg-blue-500 px-3 py-2 rounded-lg flex-1">
              <Text className="text-white font-semibold text-sm text-center">+ 新建提醒</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleRunMonitorNow}
              disabled={running}
              className={`${running ? "bg-gray-400" : "bg-emerald-500"} px-3 py-2 rounded-lg flex-1`}
            >
              <Text className="text-white font-semibold text-sm text-center">{running ? "执行中" : "立即监控"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-600">加载中...</Text>
          </View>
        ) : alerts.length === 0 ? (
          <View className="flex-1 items-center justify-center p-4">
            <Text className="text-gray-600 text-center">暂无提醒</Text>
          </View>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingTop: 0 }}
            renderItem={({ item }) => (
              <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                <Text className="text-lg font-bold text-gray-800 mb-1">{item.type === "price" ? "价格提醒" : "策略提醒"}</Text>
                <Text className="text-gray-600 text-sm mb-1">条件: {item.condition}</Text>
                {item.recipientEmail ? <Text className="text-xs text-blue-600 mb-2">📧 {item.recipientEmail}</Text> : null}
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("删除提醒", "确定要删除吗？", [
                      { text: "取消", style: "cancel" },
                      {
                        text: "删除",
                        style: "destructive",
                        onPress: async () => {
                          await deleteAlert(item.id);
                          await loadData();
                        },
                      },
                    ]);
                  }}
                  className="bg-red-100 py-2 rounded-lg"
                >
                  <Text className="text-red-600 font-semibold text-center text-sm">删除</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black bg-opacity-50 justify-end">
          <View className="bg-white rounded-t-2xl p-6">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xl font-bold text-gray-800">新建提醒</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text className="text-2xl text-gray-400">✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              <Text className="text-sm font-semibold text-gray-600 mb-2">提醒类型</Text>
              <View className="flex-row gap-2 mb-4">
                <TouchableOpacity
                  onPress={() => setFormData((v) => ({ ...v, type: "price" }))}
                  className={`flex-1 py-2 rounded-lg ${formData.type === "price" ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <Text className={`text-center font-semibold ${formData.type === "price" ? "text-white" : "text-gray-700"}`}>
                    价格提醒
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setFormData((v) => ({ ...v, type: "strategy" }))}
                  className={`flex-1 py-2 rounded-lg ${formData.type === "strategy" ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <Text className={`text-center font-semibold ${formData.type === "strategy" ? "text-white" : "text-gray-700"}`}>
                    策略提醒
                  </Text>
                </TouchableOpacity>
              </View>

              {formData.type === "price" ? (
                <>
                  <Text className="text-sm font-semibold text-gray-600 mb-2">价格条件</Text>
                  <TextInput
                    placeholder="例如 <=0.1850"
                    value={formData.condition}
                    onChangeText={(text) => setFormData((v) => ({ ...v, condition: text }))}
                    className="border border-gray-300 rounded-lg p-3 mb-4 text-gray-800"
                  />
                </>
              ) : (
                <>
                  <Text className="text-sm font-semibold text-gray-600 mb-2">选择策略</Text>
                  <View className="mb-4 gap-2">
                    {strategies.length === 0 ? (
                      <Text className="text-xs text-gray-500">暂无可选策略</Text>
                    ) : (
                      strategies.map((s) => {
                        const selected = formData.strategyId === s.id;
                        return (
                          <TouchableOpacity
                            key={s.id}
                            onPress={() => setFormData((v) => ({ ...v, strategyId: s.id }))}
                            className={`p-3 rounded-lg border ${selected ? "bg-blue-50 border-blue-400" : "bg-white border-gray-300"}`}
                          >
                            <Text className={`font-semibold ${selected ? "text-blue-700" : "text-gray-800"}`}>{s.name}</Text>
                            <Text className="text-xs text-gray-500">目标: {Number(s.targetRate).toFixed(4)}</Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </View>
                </>
              )}

              <View className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                <Text className="text-sm text-gray-700">收件邮箱: {globalRecipientEmail || "未配置"}</Text>
                <Text className="text-xs text-gray-500 mt-1">邮箱来自设置页</Text>
                <TouchableOpacity
                  onPress={() => setFormData((v) => ({ ...v, emailNotificationEnabled: !v.emailNotificationEnabled }))}
                  className={`mt-2 py-2 rounded-lg ${formData.emailNotificationEnabled ? "bg-blue-500" : "bg-gray-200"}`}
                >
                  <Text className={`text-center font-semibold ${formData.emailNotificationEnabled ? "text-white" : "text-gray-700"}`}>
                    {formData.emailNotificationEnabled ? "已开启邮箱提醒" : "开启邮箱提醒"}
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleCreateAlert}
                disabled={isCreating}
                className={`${isCreating ? "bg-gray-400" : "bg-blue-500"} py-3 rounded-lg`}
              >
                <Text className="text-white text-center font-semibold">{isCreating ? "创建中..." : "创建提醒"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
