const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("reminder setup preserves local settings, keeps its secret private, and reuses it on retry", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saboia-reminder-test-"));
  try {
    for (const dir of ["scripts", "supabase/migrations", "bin"])
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    const env =
      'EXPO_PUBLIC_SUPABASE_URL="https://example-test.supabase.co"\nEXPO_PUBLIC_SUPABASE_ANON_KEY=public-placeholder\n';
    fs.writeFileSync(path.join(root, ".env"), env);
    fs.writeFileSync(
      path.join(root, "app.config.ts"),
      "preserve local signing config",
    );
    fs.copyFileSync(
      path.resolve(__dirname, "../scripts/setup-request-reminders.cjs"),
      path.join(root, "scripts/setup-request-reminders.cjs"),
    );
    fs.writeFileSync(
      path.join(root, "supabase/migrations/202611060006_request_reminders.sql"),
      "-- local migration fixture\n",
    );
    fs.writeFileSync(path.join(root, "bin/npx"), "#!/bin/sh\nexit 0\n", {
      mode: 0o700,
    });
    const run = () =>
      spawnSync(
        process.execPath,
        [path.join(root, "scripts/setup-request-reminders.cjs")],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: path.join(root, "bin") + path.delimiter + process.env.PATH,
          },
        },
      );
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const secretFile = path.join(root, ".expo/request-reminders/secret.env");
    const secretText = fs.readFileSync(secretFile, "utf8");
    const secret = secretText.trim().split("=")[1];
    assert.match(secret, /^[a-f0-9]{64}$/);
    assert.equal(first.stdout.includes(secret), false);
    assert.equal(fs.statSync(secretFile).mode & 0o777, 0o600);
    const sql = fs.readFileSync(
      path.join(root, ".expo/request-reminders/activate.sql"),
      "utf8",
    );
    assert.ok(
      sql.includes(
        "https://example-test.supabase.co/functions/v1/request-reminders",
      ),
    );
    assert.ok(sql.includes(secret));
    const retry = run();
    assert.equal(retry.status, 0, retry.stderr);
    assert.equal(fs.readFileSync(secretFile, "utf8"), secretText);
    assert.equal(fs.readFileSync(path.join(root, ".env"), "utf8"), env);
    assert.equal(
      fs.readFileSync(path.join(root, "app.config.ts"), "utf8"),
      "preserve local signing config",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
