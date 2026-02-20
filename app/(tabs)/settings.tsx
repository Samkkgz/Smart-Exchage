import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { getAppSettings, updateAppSettings } from "@/lib/services/storage";

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [exchangeRateApiKey, setExchangeRateApiKey] = useState("");
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [updateFrequency, setUpdateFrequency] = useState("5");
  const [minConfidence, setMinConfidence] = useState("0.7");

  useEffect(() => {
    const load = async () => {
      const settings = await getAppSettings();
      setExchangeRateApiKey(settings.exchangeRateApiKey || "bd575de2682cf6fd74775b13");
      setEmailNotificationsEnabled(Boolean(settings.emailNotificationsEnabled));
      setEmailAddress(settings.emailAddress || "");
      setUpdateFrequency(String(settings.updateFrequency || 5));
      setMinConfidence(String(settings.minConfidence || 0.7));
      setLoading(false);
    };
    load();
  }, []);

  const onSave = async () => {
    try {
      setSaving(true);
      await updateAppSettings({
        exchangeRateApiKey: exchangeRateApiKey.trim() || "bd575de2682cf6fd74775b13",
        emailNotificationsEnabled,
        emailAddress: emailAddress.trim(),
        updateFrequency: Math.max(5, Number(updateFrequency || 5)),
        minConfidence: Math.max(0.1, Math.min(0.99, Number(minConfidence || 0.7))),
        emailProvider: "resend",
      });
      alert("设置已保存");
    } catch {
      alert("保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text className="text-2xl font-bold text-gray-800 mb-2">全局设置</Text>
        <CurrencySwitcher />

        <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <Text className="font-semibold text-gray-800 mb-3">ExchangeRate API</Text>
          <Text className="text-xs text-gray-500 mb-2">用于实时汇率拉取，默认已填你的Key</Text>
          <TextInput
            value={exchangeRateApiKey}
            onChangeText={setExchangeRateApiKey}
            placeholder="ExchangeRate API Key"
            className="border border-gray-300 rounded-lg p-3 text-gray-800"
            editable={!loading}
          />
        </View>

        <View className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
          <Text className="font-semibold text-gray-800 mb-3">Email 提醒</Text>
          <TouchableOpacity
            onPress={() => setEmailNotificationsEnabled((v) => !v)}
            className={`mb-3 py-2 rounded-lg ${emailNotificationsEnabled ? "bg-blue-500" : "bg-gray-200"}`}
          >
            <Text className={`text-center font-semibold ${emailNotificationsEnabled ? "text-white" : "text-gray-700"}`}>
              {emailNotificationsEnabled ? "已启用" : "未启用"}
            </Text>
          </TouchableOpacity>

          <TextInput
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="提醒邮箱（收件地址）"
            keyboardType="email-address"
            className="border border-gray-300 rounded-lg p-3 text-gray-800"
            editable={!loading}
          />
          <Text className="text-xs text-gray-500 mt-2">Resend API Key 改为环境变量 EXPO_PUBLIC_RESEND_API_KEY</Text>
        </View>

        <View className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <Text className="font-semibold text-gray-800 mb-3">分析参数</Text>
          <Text className="text-xs text-gray-500 mb-1">自动分析周期（分钟，最小 5）</Text>
          <TextInput
            value={updateFrequency}
            onChangeText={setUpdateFrequency}
            keyboardType="number-pad"
            className="border border-gray-300 rounded-lg p-3 mb-3 text-gray-800"
            editable={!loading}
          />

          <Text className="text-xs text-gray-500 mb-1">最低置信度（0.1~0.99）</Text>
          <TextInput
            value={minConfidence}
            onChangeText={setMinConfidence}
            keyboardType="decimal-pad"
            className="border border-gray-300 rounded-lg p-3 text-gray-800"
            editable={!loading}
          />
        </View>

        <TouchableOpacity
          onPress={onSave}
          disabled={saving || loading}
          className={`${saving || loading ? "bg-gray-400" : "bg-blue-500"} rounded-xl py-3`}
        >
          <Text className="text-white text-center font-semibold">{saving ? "保存中..." : "保存全部设置"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}
