const test = require("node:test");
const assert = require("node:assert/strict");
const { versions, patchApp } = require("../scripts/upgrade-ios27.cjs");
const fixture =
  'import React from "react";\nimport {\n  SafeAreaView,\n  View,\n} from "react-native";\nconst value=response.notification.request.content.data.screen;\nexport default function App(){return (<Provider><Shell /></Provider>);}\n';
test("SDK 58 migration updates safe areas and optional notification payloads", () => {
  const updated = patchApp(fixture);
  assert.match(updated, /from "react-native-safe-area-context"/);
  assert.match(
    updated,
    /<SafeAreaProvider><Provider><Shell \/><\/Provider><\/SafeAreaProvider>/,
  );
  assert.match(updated, /content.data\?\.screen/);
  assert.equal(patchApp(updated), updated);
});
test("unknown source layout is rejected instead of overwritten", () => {
  assert.throws(() => patchApp("user custom root"));
});
test("migration uses Expo-supported native versions", () => {
  const bundled = require("expo/bundledNativeModules.json");
  for (const [name, version] of Object.entries(versions))
    if (name in bundled) assert.equal(version, bundled[name], name);
  assert.match(versions.expo, /58/);
});
test("existing-checkout migration preserves local credentials and EAS config", () => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const { execFileSync } = require("node:child_process");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saboia-migration-test-"));
  try {
    fs.mkdirSync(path.join(root, "scripts"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "saboia-cleaning",
        dependencies: { expo: "~54.0.0", "date-fns": "^4.1.0" },
        devDependencies: {},
        overrides: { minimatch: "^11.0.4" },
      }),
    );
    fs.writeFileSync(path.join(root, "App.tsx"), fixture);
    const config =
      'export default {expo:{extra:{eas:{projectId:"existing-project-id"}}}};';
    fs.writeFileSync(path.join(root, "app.config.ts"), config);
    fs.writeFileSync(
      path.join(root, ".env"),
      "LOCAL_CONFIG_MUST_REMAIN_UNCHANGED=test-fixture",
    );
    fs.writeFileSync(
      path.join(root, "package-lock.json"),
      "original-lock-backup",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "fix-ios-deployment.cjs"),
      "const minimum='15.1'; // SDK 54",
    );
    execFileSync(
      process.execPath,
      [require.resolve("../scripts/upgrade-ios27.cjs")],
      { cwd: root, stdio: "pipe" },
    );
    assert.equal(
      fs.readFileSync(path.join(root, "app.config.ts"), "utf8"),
      config,
    );
    assert.equal(
      fs.readFileSync(path.join(root, ".env"), "utf8"),
      "LOCAL_CONFIG_MUST_REMAIN_UNCHANGED=test-fixture",
    );
    assert.equal(
      fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
      "original-lock-backup",
    );
    const updated = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    );
    assert.equal(updated.dependencies.expo, versions.expo);
    assert.equal(updated.dependencies["date-fns"], "^4.1.0");
    assert.equal(updated.overrides["glob@7"].minimatch, "^3.1.2");
    const backups = fs.readdirSync(path.join(root, ".expo", "saboia-backups"));
    assert.ok(backups.length > 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
