#!/usr/bin/env node
// Upgrade an existing Saboia Cleaning checkout without replacing .env or EAS IDs.
const fs = require("node:fs");
const path = require("node:path");
const versions = {
  "@react-native-async-storage/async-storage": "2.2.0",
  expo: "~58.0.23",
  "expo-constants": "~58.0.15",
  "expo-dev-client": "~58.0.18",
  "expo-file-system": "~58.0.13",
  "expo-font": "~58.0.11",
  "expo-image-picker": "~58.0.10",
  "expo-linking": "~58.0.16",
  "expo-notifications": "~58.1.8",
  "expo-secure-store": "~58.0.2",
  "expo-speech": "~58.0.3",
  "expo-speech-recognition": "~58.0.1",
  "expo-splash-screen": "~58.0.13",
  "expo-status-bar": "~58.0.4",
  react: "19.3.0",
  "react-dom": "19.3.0",
  "react-native": "0.88.1",
  "react-native-svg": "15.16.0",
  "react-native-web": "~0.21.4",
  "react-native-safe-area-context": "~5.11.1",
};
function patchApp(source) {
  let updated = source;
  if (!updated.includes('from "react-native-safe-area-context"')) {
    if (!/^[ \t]*SafeAreaView,?[ \t]*$/m.test(updated))
      throw new Error("Unexpected App.tsx imports; no files changed.");
    updated = updated.replace(/^[ \t]*SafeAreaView,?[ \t]*\n/m, "");
    updated =
      'import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";\n' +
      updated;
  }
  if (!updated.includes("<SafeAreaProvider>")) {
    const root = /<Provider>\s*<Shell\s*\/>\s*<\/Provider>/g;
    if ([...updated.matchAll(root)].length !== 1)
      throw new Error("Unexpected App.tsx root; no files changed.");
    updated = updated.replace(
      root,
      "<SafeAreaProvider><Provider><Shell /></Provider></SafeAreaProvider>",
    );
  }
  return updated.replaceAll(
    "response.notification.request.content.data.screen",
    "response.notification.request.content.data?.screen",
  );
}
function main() {
  const root = process.cwd();
  const packageFile = path.join(root, "package.json");
  const originalPackage = fs.readFileSync(packageFile, "utf8");
  const manifest = JSON.parse(originalPackage);
  if (manifest.name !== "saboia-cleaning")
    throw new Error("Run in your SaboiaCleaning project folder.");
  Object.assign(manifest.dependencies, versions);
  manifest.devDependencies = {
    ...manifest.devDependencies,
    "@types/react": "~19.3.0",
  };
  manifest.overrides = {
    ...manifest.overrides,
    minimatch: "^11.0.5",
    "glob@10": "^14.0.4",
    "glob@7": { minimatch: "^3.1.2" },
  };
  const appFile = path.join(root, "App.tsx");
  const appOriginal = fs.readFileSync(appFile, "utf8");
  const plans = [
    {
      file: packageFile,
      original: originalPackage,
      updated: JSON.stringify(manifest, null, 2) + "\n",
    },
    { file: appFile, original: appOriginal, updated: patchApp(appOriginal) },
  ];
  const targetFile = path.join(root, "scripts", "fix-ios-deployment.cjs");
  if (fs.existsSync(targetFile)) {
    const original = fs.readFileSync(targetFile, "utf8");
    plans.push({
      file: targetFile,
      original,
      updated: original
        .replaceAll("15.1", "16.4")
        .replaceAll("SDK 54", "SDK 58"),
    });
  }
  const codegenFile = path.join(root, "scripts", "check-codegen.cjs");
  if (fs.existsSync(codegenFile)) {
    const original = fs.readFileSync(codegenFile, "utf8");
    plans.push({
      file: codegenFile,
      original,
      updated: original.replace(
        "require.resolve('react-native/scripts/generate-codegen-artifacts.js')",
        "path.join(path.dirname(require.resolve('react-native/package.json')), 'scripts/generate-codegen-artifacts.js')",
      ),
    });
  }
  const backup = path.join(
    root,
    ".expo",
    "saboia-backups",
    "expo58-" + Date.now(),
  );
  fs.mkdirSync(backup, { recursive: true });
  // Back up config/lock unchanged, alongside source files changed below. Never read .env.
  for (const name of ["app.config.ts", "package-lock.json"]) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) fs.copyFileSync(file, path.join(backup, name));
  }
  const written = [];
  try {
    for (const p of plans) {
      fs.writeFileSync(path.join(backup, path.basename(p.file)), p.original);
      fs.writeFileSync(p.file, p.updated);
      written.push(p);
    }
  } catch (error) {
    for (const p of written) fs.writeFileSync(p.file, p.original);
    throw error;
  }
  console.log(
    "Expo SDK 58 migration prepared. Your .env and app.config.ts were not changed.",
  );
  console.log("Backup: " + backup);
  console.log("Next: npm install");
}
module.exports = { versions, patchApp };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
