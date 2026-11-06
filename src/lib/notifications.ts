import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import { expandSchedule } from "../domain/schedule";
import type { Data } from "../domain/schema";
import { translator, type Language } from "./i18n";
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
export async function scheduleReminders(
  data: Data,
  language: Language,
  time: string,
) {
  if (Platform.OS === "web")
    throw new Error(
      language === "pt-BR"
        ? "Notificações locais precisam do aplicativo iOS."
        : "Local notifications require the iOS app.",
    );
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error("Notification permission denied");
  await Notifications.cancelAllScheduledNotificationsAsync();
  const t = translator(language);
  const [hour, minute] = time.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour! < 0 ||
    hour! > 23 ||
    minute! < 0 ||
    minute! > 59
  )
    throw new Error("Invalid time");
  for (let n = 0; n < 7; n++) {
    const day = addDays(startOfDay(new Date()), n);
    const appointments = expandSchedule(
      data.series,
      data.exceptions,
      day,
      addDays(day, 1),
      data.timezone,
    );
    const briefing = setMinutes(setHours(day, hour!), minute!);
    if (+briefing > Date.now())
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t("briefing"),
          body: `${appointments.length} ${t("houses").toLowerCase()}`,
          data: { screen: "dashboard" },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: briefing,
        },
      });
    for (const o of appointments.slice(0, 6)) {
      const reminder = new Date(+new Date(o.starts_at) - 30 * 60000);
      if (+reminder > Date.now())
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t("notificationTitle"),
            body: `${data.houses.find((h) => h.id === o.house_id)?.nickname ?? ""} · ${new Date(o.starts_at).toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" })}`,
            data: { screen: "calendar" },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder,
          },
        });
    }
  }
}
