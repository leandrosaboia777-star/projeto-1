import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { devotionFor, type DevotionPeriod } from "../domain/devotions";
import type { Language } from "./i18n";
export type DevotionSettings = {
  enabled: boolean;
  notifications: boolean;
  time: string;
};
const listeners = new Set<() => void>();
export function subscribeDevotions(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export async function readDevotionSettings(
  userId: string,
): Promise<DevotionSettings> {
  const defaults = { enabled: true, notifications: true, time: "07:00" };
  try {
    const value = JSON.parse(
      (await AsyncStorage.getItem(`devotion:${userId}:settings`)) ?? "null",
    );
    return value
      ? {
          enabled: value.enabled !== false,
          notifications: value.notifications === true,
          time: /^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
            ? value.time
            : defaults.time,
        }
      : defaults;
  } catch {
    return defaults;
  }
}
export async function saveDevotionSettings(
  userId: string,
  value: DevotionSettings,
) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))
    throw new Error("INVALID_TIME");
  await AsyncStorage.setItem(
    `devotion:${userId}:settings`,
    JSON.stringify(value),
  );
  listeners.forEach((fn) => fn());
}
export async function cancelDevotionNotifications() {
  if (Platform.OS === "web") return;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of pending)
    if (n.content.data?.feature === "devotion")
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
}
let notificationQueue: Promise<void> = Promise.resolve();
export function scheduleDevotions(
  userId: string,
  settings: DevotionSettings,
  language: Language,
  timezone: string,
) {
  const task = notificationQueue.then(() =>
    rescheduleDevotions(userId, settings, language, timezone),
  );
  notificationQueue = task.catch(() => {});
  return task;
}
export function clearDevotionNotifications() {
  const task = notificationQueue.then(() => cancelDevotionNotifications());
  notificationQueue = task.catch(() => {});
  return task;
}
async function rescheduleDevotions(
  userId: string,
  settings: DevotionSettings,
  language: Language,
  timezone: string,
) {
  if (Platform.OS === "web") return;
  await cancelDevotionNotifications();
  if (!settings.enabled || !settings.notifications) return;
  let permission = await Notifications.getPermissionsAsync();
  if (permission.status === "undetermined")
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;
  const now = new Date(),
    local = toZonedTime(now, timezone);
  for (let i = 0; i < 14; i++) {
    const day = format(addDays(local, i), "yyyy-MM-dd"),
      date = fromZonedTime(`${day}T${settings.time}:00`, timezone);
    if (date <= now) continue;
    const reading = devotionFor(day, "morning", language);
    await Notifications.scheduleNotificationAsync({
      identifier: `devotion-${userId}-${day}-morning`,
      content: {
        title: reading.title,
        sound: "default",
        body: `${reading.verse} — ${reading.reference}\n${reading.reflection}`,
        data: {
          feature: "devotion",
          screen: "dashboard",
          day,
          period: "morning",
        },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}
export async function notifyWorkdayFinished(
  userId: string,
  day: string,
  language: Language,
) {
  if (
    Platform.OS === "web" ||
    !(await Notifications.getPermissionsAsync()).granted
  )
    return;
  const r = devotionFor(day, "evening", language);
  await Notifications.scheduleNotificationAsync({
    identifier: `devotion-${userId}-${day}-evening`,
    content: {
      title: r.title,
      sound: "default",
      body: `${r.verse} — ${r.reference}\n${r.reflection}`,
      data: {
        feature: "devotion",
        screen: "dashboard",
        day,
        period: "evening",
      },
    },
    trigger: null,
  });
}
let pending: { day: string; period: DevotionPeriod } | null = null;
const openListeners = new Set<() => void>();
export function openDevotionNotification(data: Record<string, unknown>) {
  if (
    data.feature !== "devotion" ||
    typeof data.day !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(data.day) ||
    !["morning", "evening"].includes(String(data.period))
  )
    return;
  pending = { day: data.day, period: data.period as DevotionPeriod };
  openListeners.forEach((fn) => fn());
}
export function takeDevotionNotification() {
  const value = pending;
  pending = null;
  return value;
}
export function subscribeDevotionOpen(fn: () => void) {
  openListeners.add(fn);
  return () => {
    openListeners.delete(fn);
  };
}
