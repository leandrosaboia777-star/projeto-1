import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { checked, db } from "./supabase";
import type { Language } from "./i18n";

export async function enableRequestNotifications(language: Language) {
  const pt = language === "pt-BR";
  if (Platform.OS !== "ios" && Platform.OS !== "android")
    throw new Error(
      pt
        ? "Use o aplicativo instalado no celular."
        : "Use the installed mobile app.",
    );
  if (!(await Notifications.requestPermissionsAsync()).granted)
    throw new Error(
      pt
        ? "Permita notificações nos Ajustes do celular."
        : "Allow notifications in your phone's Settings.",
    );
  const projectId =
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("EAS project is not configured.");
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await checked(
    db().rpc("register_push_device", { p_token: token, p_language: language }),
  );
  await AsyncStorage.setItem("requestPushToken", token);
}

export async function disableRequestNotifications() {
  const token = await AsyncStorage.getItem("requestPushToken");
  if (token) await checked(db().rpc("remove_push_device", { p_token: token }));
  await AsyncStorage.removeItem("requestPushToken");
}
