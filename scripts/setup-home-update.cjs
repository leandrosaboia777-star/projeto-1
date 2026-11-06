#!/usr/bin/env node
const fs = require("node:fs"),
  path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
process.chdir(root);
try {
  const result = spawnSync(
    "npx",
    [
      "supabase",
      "functions",
      "deploy",
      "translate-content",
      "--import-map",
      "supabase/functions/deno.json",
    ],
    { stdio: "inherit", shell: false },
  );
  if (result.status !== 0)
    throw new Error(
      "A função de tradução não foi enviada. Confira a mensagem acima.",
    );
  const file = path.join(
    root,
    "supabase/migrations/202611060007_house_cover.sql",
  );
  let copied = false;
  if (process.platform === "darwin")
    copied =
      spawnSync("pbcopy", [], {
        input: fs.readFileSync(file),
        stdio: ["pipe", "ignore", "ignore"],
      }).status === 0;
  console.log("Tradução enviada. Falta ativar a foto de capa no banco.");
  if (copied)
    console.log(
      "O SQL JÁ FOI COPIADO. Vá ao Supabase → SQL Editor → New query, cole com Cmd+V e clique Run. Não copie outro texto antes de colar.",
    );
  else
    console.log(
      "Abra este arquivo e execute seu conteúdo no SQL Editor do Supabase: " +
        file,
    );
  console.log(
    "Depois do sucesso no SQL Editor, gere a nova versão: node scripts/iphone.cjs --build",
  );
  console.log(
    "A imagem do ícone, o azul e as novas telas aparecem após instalar a nova versão.",
  );
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
