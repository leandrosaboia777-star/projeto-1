#!/usr/bin/env node
// Update only the reviewed rescheduling files; preserve .env and Apple/EAS setup.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const manifest = {
  "App.tsx": "975867827ac3b871ce699b88d3fdaba2f93b275787b16187953dc7ffe216c8af",
  "src/domain/rescheduling.ts":
    "8411896a80da31d8fbe149901807bdb8c69607ed60b40fa97b39bd019c4924d2",
  "src/domain/schedule.ts":
    "d491066680ff1b2ac02eaff455babc6d7884a5835af8aa9054d129827a7ec271",
  "src/screens/Requests.tsx":
    "d1ccceda441dd0f6b286e08f38271e4cd3628c04d67b545cb249f73c736b8a4e",
  "src/screens/Settings.tsx":
    "37c43ecf712b2a0b513202fb451ea2cb9ab0438291ec46e674a48926bfdf24e2",
  "src/lib/requestNotifications.ts":
    "5da32940e79a499a90c0fce2e50c2574b111b879bb2e625f7ddfdc2bfb8919b1",
  "supabase/functions/request-reminders/index.ts":
    "17074af90e3e2b10128968db7714bf907a9477f1af0d259c86ed0757c86e39c3",
  "supabase/migrations/202611060006_request_reminders.sql":
    "536b59e8112ee1652af8884eb372763284b02a3a5602d8b2edca9e1782b61eb3",
  "scripts/setup-request-reminders.cjs":
    "ce308e2e14ce866e467564abdf74f5683c42c8e60d78229549d918a57466c982",
  "docs/REQUESTS.md":
    "8ff04cf8702c5acae5cfa2431cfad9baacdbde196fc51694d1da39422ddfe8df",
};
async function main() {
  const root = path.resolve(__dirname, "..");
  if (
    JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"))
      .name !== "saboia-cleaning"
  )
    throw new Error("Execute na pasta SaboiaCleaning.");
  const downloaded = await Promise.all(
    Object.entries(manifest).map(async ([file, hash]) => {
      const response = await fetch(
        "https://raw.githubusercontent.com/leandrosaboia777-star/projeto-1/main/" +
          file,
        { signal: AbortSignal.timeout(30000) },
      );
      if (!response.ok) throw new Error("Não foi possível baixar " + file);
      const content = Buffer.from(await response.arrayBuffer());
      if (crypto.createHash("sha256").update(content).digest("hex") !== hash)
        throw new Error(
          "A versão de " +
            file +
            " mudou. Nenhum arquivo foi atualizado; baixe o atualizador novamente.",
        );
      return [file, content];
    }),
  );
  const backup = path.join(
    root,
    ".expo",
    "saboia-backups",
    "requests-" + Date.now(),
  );
  function write(file, content) {
    const target = path.join(root, file);
    if (fs.existsSync(target)) {
      const saved = path.join(backup, file);
      fs.mkdirSync(path.dirname(saved), { recursive: true });
      fs.copyFileSync(target, saved);
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  for (const [file, content] of downloaded) write(file, content);
  const configPath = path.join(root, "supabase/config.toml");
  const config = fs.readFileSync(configPath, "utf8");
  if (!config.includes("[functions.request-reminders]"))
    write(
      "supabase/config.toml",
      config +
        '\n[functions.request-reminders]\nverify_jwt = false\nimport_map = "./functions/deno.json"\n',
    );
  console.log(
    "Atualização salva. .env e configuração Apple/EAS preservadas. Backup: " +
      backup,
  );
  console.log("Próximo passo: node scripts/setup-request-reminders.cjs");
  console.log(
    "Essa preparação ainda não altera o aplicativo instalado no iPhone.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
