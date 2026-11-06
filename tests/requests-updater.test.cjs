const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

for (const updater of ["requests", "review"]) {
  test(`${updater} updater preserves credentials and refuses changed downloads before overwriting`, () => {
    const target =
      updater === "requests" ? "App.tsx" : "src/screens/Assistant.tsx";
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "saboia-update-test-"));
    const source = path.resolve(__dirname, "..");
    try {
      for (const dir of ["scripts", "supabase"])
        fs.mkdirSync(path.join(root, dir), { recursive: true });
      fs.writeFileSync(
        path.join(root, "package.json"),
        ' {"name":"saboia-cleaning"}',
      );
      fs.writeFileSync(path.join(root, ".env"), "private local settings");
      fs.writeFileSync(
        path.join(root, "app.config.ts"),
        "existing signing config",
      );
      fs.writeFileSync(
        path.join(root, "supabase/config.toml"),
        'project_id = "existing-project"\n',
      );
      fs.copyFileSync(
        path.join(source, `scripts/update-${updater}.cjs`),
        path.join(root, `scripts/update-${updater}.cjs`),
      );
      const stub = path.join(root, "fetch-stub.cjs");
      fs.writeFileSync(
        stub,
        `const fs=require('node:fs'),path=require('node:path'); global.fetch=async url=>{const file=url.split('/main/')[1];return new Response(process.env.SABOIA_TEST_TAMPER&&file===${JSON.stringify(target)}?'changed content':fs.readFileSync(path.join(${JSON.stringify(source)},file)));};`,
      );
      const run = (tamper = "") =>
        spawnSync(
          process.execPath,
          ["--require", stub, path.join(root, `scripts/update-${updater}.cjs`)],
          {
            encoding: "utf8",
            env: { ...process.env, SABOIA_TEST_TAMPER: tamper },
          },
        );
      let result = run();
      assert.equal(result.status, 0, result.stderr);
      assert.equal(
        fs.readFileSync(path.join(root, ".env"), "utf8"),
        "private local settings",
      );
      assert.equal(
        fs.readFileSync(path.join(root, "app.config.ts"), "utf8"),
        "existing signing config",
      );
      const config = fs.readFileSync(
        path.join(root, "supabase/config.toml"),
        "utf8",
      );
      assert.ok(config.startsWith('project_id = "existing-project"'));
      assert.equal(
        config.includes("[functions.request-reminders]"),
        updater === "requests",
      );
      fs.writeFileSync(
        path.join(root, target),
        "preserve manual edits on failed update",
      );
      result = run("yes");
      assert.equal(result.status, 1);
      assert.equal(
        fs.readFileSync(path.join(root, target), "utf8"),
        "preserve manual edits on failed update",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}
