import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser-auth",
  use: {
    baseURL: "http://127.0.0.1:8082",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command:
      "EXPO_OFFLINE=1 EXPO_PUBLIC_SUPABASE_URL=http://saboia-test.local EXPO_PUBLIC_SUPABASE_ANON_KEY=browser-test-public-key npx expo start --web --port 8082",
    port: 8082,
    reuseExistingServer: false,
    timeout: 120000,
  },
  reporter: "list",
});
