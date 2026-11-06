const fs = require("node:fs");
const path = require("node:path");
const root = path.join(process.cwd(), "ios", "SaboiaCleaning");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");
const plist = read("Info.plist");
const scene = read("SceneDelegate.swift");
const app = read("AppDelegate.swift");
if (
  !plist.includes("UIApplicationSceneManifest") ||
  !plist.includes("UISceneDelegateClassName") ||
  !plist.includes("$(PRODUCT_MODULE_NAME).SceneDelegate")
)
  throw new Error(
    "Generated app is missing the scene lifecycle manifest required by iOS 27.",
  );
if (!/class SceneDelegate:\s*ExpoAppSceneDelegate/.test(scene))
  throw new Error("Generated app is missing the Expo SceneDelegate.");
if (/UIWindow\(frame:\s*UIScreen.main.bounds\)/.test(app))
  throw new Error(
    "Legacy UIWindow startup is still present. Regenerate the iOS project.",
  );
const project = fs.readFileSync(
  path.join(
    process.cwd(),
    "ios",
    "SaboiaCleaning.xcodeproj",
    "project.pbxproj",
  ),
  "utf8",
);
if (!project.includes("SceneDelegate.swift in Sources"))
  throw new Error("SceneDelegate.swift is not registered in the native build.");
console.log(
  "PASS: generated iOS scene manifest, delegate, build registration, and startup configuration. Native execution still requires macOS.",
);
