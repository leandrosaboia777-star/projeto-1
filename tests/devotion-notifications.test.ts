import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import * as readings from "../src/domain/devotions";
const require = createRequire(process.cwd() + "/package.json");
function setup() {
  const scheduled = new Map<string, any>([
    [
      "briefing",
      { identifier: "briefing", content: { data: { feature: "schedule" } } },
    ],
  ]);
  const storage = new Map<string, string>();
  const fakeNotifications = {
    SchedulableTriggerInputTypes: { DATE: "date" },
    getPermissionsAsync: async () => ({ granted: true, status: "granted" }),
    requestPermissionsAsync: async () => ({ granted: true, status: "granted" }),
    getAllScheduledNotificationsAsync: async () => [...scheduled.values()],
    cancelScheduledNotificationAsync: async (id: string) => {
      scheduled.delete(id);
    },
    scheduleNotificationAsync: async (item: any) => {
      scheduled.set(item.identifier, item);
      return item.identifier;
    },
  };
  const source = ts.transpileModule(
    fs.readFileSync("src/lib/devotions.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const module = { exports: {} as any };
  const time = Date.parse("2026-10-30T10:00:00Z");
  class FixedDate extends Date {
    constructor(value?: string | number | Date) {
      super(
        value === undefined ? time : value instanceof Date ? +value : value,
      );
    }
    static now() {
      return time;
    }
  }
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    Date: FixedDate,
    console,
    Set,
    Map,
    Promise,
    require: (id: string) => {
      if (id === "react-native") return { Platform: { OS: "ios" } };
      if (id === "expo-notifications") return fakeNotifications;
      if (id === "@react-native-async-storage/async-storage")
        return {
          getItem: async (key: string) => storage.get(key) ?? null,
          setItem: async (key: string, value: string) => {
            storage.set(key, value);
          },
        };
      if (id === "../domain/devotions") return readings;
      return require(id);
    },
  });
  return { api: module.exports, scheduled };
}
test("morning alerts preserve work reminders, respect DST and do not duplicate on renewal", async () => {
  const { api, scheduled } = setup();
  await api.scheduleDevotions(
    "owner",
    { enabled: true, notifications: true, time: "07:00" },
    "pt-BR",
    "America/New_York",
  );
  assert.equal(scheduled.size, 15);
  assert.ok(scheduled.has("briefing"));
  assert.equal(
    scheduled
      .get("devotion-owner-2026-10-30-morning")
      .trigger.date.toISOString(),
    "2026-10-30T11:00:00.000Z",
  );
  assert.equal(
    scheduled
      .get("devotion-owner-2026-11-01-morning")
      .trigger.date.toISOString(),
    "2026-11-01T12:00:00.000Z",
  );
  await api.scheduleDevotions(
    "owner",
    { enabled: true, notifications: true, time: "07:00" },
    "en-US",
    "America/New_York",
  );
  assert.equal(scheduled.size, 15);
  assert.equal(
    scheduled.get("devotion-owner-2026-10-30-morning").content.title,
    "A word to begin your day",
  );
  await api.scheduleDevotions(
    "owner",
    { enabled: false, notifications: false, time: "07:00" },
    "en-US",
    "America/New_York",
  );
  assert.equal(scheduled.size, 1);
  assert.ok(scheduled.has("briefing"));
});
test("evening alert contains Scripture and reflection, and preference validation preserves the previous value", async () => {
  const { api, scheduled } = setup();
  await api.notifyWorkdayFinished("owner", "2026-11-06", "pt-BR");
  const notification = scheduled.get("devotion-owner-2026-11-06-evening");
  assert.equal(notification.trigger, null);
  assert.ok(
    notification.content.body.includes(
      readings.devotionFor("2026-11-06", "evening", "pt-BR").reflection,
    ),
  );
  assert.equal((await api.readDevotionSettings("owner")).time, "07:00");
  await api.saveDevotionSettings("owner", {
    enabled: true,
    notifications: true,
    time: "08:15",
  });
  await assert.rejects(
    api.saveDevotionSettings("owner", {
      enabled: true,
      notifications: true,
      time: "28:00",
    }),
  );
  assert.equal((await api.readDevotionSettings("owner")).time, "08:15");
});
