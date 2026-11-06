#!/usr/bin/env node
// Run on the authenticated Mac. Never prints or uploads secrets to GitHub.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
process.chdir(root);
function run(args) {
  const result = spawnSync("npx", ["supabase", ...args], {
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(
      "O comando Supabase não terminou. Corrija o erro acima antes de continuar.",
    );
}
try {
  const env = fs.readFileSync(".env", "utf8");
  const match = env.match(
    /^EXPO_PUBLIC_SUPABASE_URL\s*=\s*["']?(https:\/\/[a-z0-9-]+\.supabase\.co)["']?\s*$/m,
  );
  if (!match)
    throw new Error("EXPO_PUBLIC_SUPABASE_URL não encontrada no .env.");
  const privateDir = path.join(root, ".expo", "request-reminders");
  fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
  const secretFile = path.join(privateDir, "secret.env");
  if (!fs.existsSync(secretFile))
    fs.writeFileSync(
      secretFile,
      `REQUEST_REMINDER_SECRET=${crypto.randomBytes(32).toString("hex")}\n`,
      { mode: 0o600 },
    );
  const secret = fs.readFileSync(secretFile, "utf8").trim().split("=")[1];
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw new Error("Configuração local de lembretes inválida.");
  run(["secrets", "set", "--env-file", secretFile]);
  run([
    "functions",
    "deploy",
    "request-reminders",
    "--import-map",
    "supabase/functions/deno.json",
  ]);
  const sql =
    `-- PRIVATE: do not share this file or commit it. Run in your Supabase SQL Editor.\n` +
    fs.readFileSync(
      "supabase/migrations/202611060006_request_reminders.sql",
      "utf8",
    ) +
    `\n
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $setup$ declare existing uuid; begin
 select id into existing from vault.secrets where name='saboia_request_reminders';
 if existing is null then perform vault.create_secret('${secret}','saboia_request_reminders');
 else perform vault.update_secret(existing,'${secret}','saboia_request_reminders'); end if;
end $setup$;
select cron.schedule('saboia-request-reminders','*/5 * * * *',$job$
 select net.http_post(
   url := '${match[1]}/functions/v1/request-reminders',
   headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='saboia_request_reminders')),
   body := '{}'::jsonb,
   timeout_milliseconds := 120000
 );
$job$);
`;
  const sqlFile = path.join(privateDir, "activate.sql");
  fs.writeFileSync(sqlFile, sql, { mode: 0o600 });
  console.log(
    "Função enviada. Falta ativar o banco/agendador no SQL Editor do Supabase.",
  );
  console.log(
    "Abra este arquivo local e execute o conteúdo UMA VEZ no SQL Editor:",
  );
  console.log(sqlFile);
  console.log(
    "O arquivo contém um segredo do servidor: não envie por chat nem publique.",
  );
  console.log(
    "Depois instale a nova versão do app e ative Lembretes de solicitações nas Configurações.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
