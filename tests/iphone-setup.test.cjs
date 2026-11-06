const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  patchConfig,
  previewProfile,
  prepare,
  readPublicConfig,
  TEAM,
  PROJECT,
} = require("../scripts/iphone.cjs");
const legacy = `export default {expo:{plugins:["@bacons/apple-targets"],ios:{...(process.env.APPLE_TEAM_ID ? {appleTeamId:process.env.APPLE_TEAM_ID}:{}),entitlements:{"com.apple.security.application-groups":["group.com.saboiacleaning.app"]}},extra:{eas:{projectId:"${PROJECT}"}}}};`;
test("signature configuration preserves app group and existing EAS project", () => {
  const patched = patchConfig(legacy);
  assert.ok(patched.includes(TEAM));
  assert.ok(patched.includes(PROJECT));
  assert.ok(patched.includes("group.com.saboiacleaning.app"));
  assert.equal(patchConfig(patched), patched);
  assert.throws(() => patchConfig(legacy.replace(PROJECT, "different-id")));
});
test("preview creates a standalone physical-device build", () => {
  const config = JSON.parse(
    previewProfile(
      JSON.stringify({
        build: {
          production: { autoIncrement: true },
          preview: { ios: { resourceClass: "m-medium" } },
        },
      }),
    ),
  );
  assert.equal(config.build.preview.developmentClient, false);
  assert.equal(config.build.preview.ios.simulator, false);
  assert.equal(config.build.preview.distribution, "internal");
  assert.equal(config.build.preview.environment, "preview");
  assert.equal(config.build.preview.ios.resourceClass, "m-medium");
  assert.equal(config.build.production.autoIncrement, true);
});
test("setup keeps .env intact and excludes local credentials/generated native code from upload", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saboia-iphone-"));
  try {
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "saboia-cleaning",
        dependencies: { expo: "~58.0.23" },
      }),
    );
    fs.writeFileSync(path.join(root, "app.config.ts"), legacy);
    fs.writeFileSync(path.join(root, "eas.json"), "{}");
    fs.writeFileSync(path.join(root, ".gitignore"), "node_modules/\n");
    fs.writeFileSync(path.join(root, ".env"), "private fixture retained");
    const backup = prepare(root);
    assert.ok(fs.existsSync(path.join(backup, "app.config.ts")));
    assert.equal(
      fs.readFileSync(path.join(root, ".env"), "utf8"),
      "private fixture retained",
    );
    const ignore = fs.readFileSync(path.join(root, ".easignore"), "utf8");
    for (const pattern of [".env\n", ".env.*\n", "ios/\n", "android/\n"])
      assert.ok(ignore.includes(pattern));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("only public Supabase settings are returned; service-role keys are rejected", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saboia-public-"));
  try {
    const file = path.join(root, ".env");
    fs.writeFileSync(
      file,
      "EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_testfixture\nOPENAI_API_KEY=do-not-upload\n",
    );
    assert.deepEqual(Object.keys(readPublicConfig(root)), [
      "EXPO_PUBLIC_SUPABASE_URL",
      "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    ]);
    const jwt =
      "a." +
      Buffer.from(JSON.stringify({ role: "service_role" })).toString(
        "base64url",
      ) +
      ".test";
    fs.writeFileSync(
      file,
      "EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co\nEXPO_PUBLIC_SUPABASE_ANON_KEY=" +
        jwt,
    );
    assert.throws(() => readPublicConfig(root), /service_role/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("share extension signing is declared before remote prebuild", () => {
  const { withIphoneSigning } = require("../scripts/iphone.cjs");
  const config = { extra: { eas: { projectId: PROJECT } } };
  withIphoneSigning(config);
  withIphoneSigning(config);
  const extensions = config.extra.eas.build.experimental.ios.appExtensions;
  assert.equal(extensions.length, 1);
  assert.equal(extensions[0].targetName, "SaboiaShare");
  assert.equal(extensions[0].bundleIdentifier, "com.saboiacleaning.app.share");
  assert.deepEqual(
    extensions[0].entitlements["com.apple.security.application-groups"],
    ["group.com.saboiacleaning.app"],
  );
});
