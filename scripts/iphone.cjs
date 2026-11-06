#!/usr/bin/env node
// Guided iPhone build setup. Never uploads server-only secrets or reads Apple passwords.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const TEAM = "7MWAZDHJCJ";
const OWNER = "leandrosaboias-team";
const PROJECT = "4fbec1be-289f-4f57-b6ba-08ede8c06f6b";
const CLI = "eas-cli@27.5.0";
const IGNORE = [
  ".git/",
  "node_modules/",
  ".expo/",
  "ios/",
  "android/",
  ".env",
  ".env.*",
  "!.env.example",
  "dist/",
  "dist-ios/",
  "test-results/",
  "playwright-report/",
  "*.log",
  "attachments/",
];
function patchConfig(original) {
  let source = original;
  const oldTeam =
    /\.\.\.\(\s*process\.env\.APPLE_TEAM_ID\s*\?\s*\{\s*appleTeamId:\s*process\.env\.APPLE_TEAM_ID\s*\}\s*:\s*\{\s*\}\s*\),?/;
  if (oldTeam.test(source))
    source = source.replace(
      oldTeam,
      `appleTeamId: process.env.APPLE_TEAM_ID || "${TEAM}",`,
    );
  else if (
    !new RegExp(
      `appleTeamId:\\s*process\\.env\\.APPLE_TEAM_ID\\s*\\|\\|\\s*["']${TEAM}["']`,
    ).test(source)
  )
    throw new Error(
      "A configuração Apple foi modificada. Envie a mensagem para revisão; nenhum arquivo foi alterado.",
    );
  const owner = source.match(/\bowner:\s*["']([^"']+)["']/);
  if (owner && owner[1] !== OWNER)
    throw new Error(
      "A conta Expo configurada é diferente. Nenhum arquivo foi alterado.",
    );
  if (!owner)
    source = source.replace(/(\bexpo:\s*\{)/, `$1\n    owner: "${OWNER}",`);
  const id = source.match(/\bprojectId:\s*["']([^"']+)["']/);
  if (id && id[1] !== PROJECT)
    throw new Error(
      "O identificador Expo configurado é diferente. Nenhum arquivo foi alterado.",
    );
  if (!id) {
    if (!/extra:\s*\{\s*\}/.test(source))
      throw new Error(
        "Não foi possível localizar extra.eas.projectId. Nenhum arquivo foi alterado.",
      );
    source = source.replace(
      /extra:\s*\{\s*\}/,
      `extra: {eas: {projectId: "${PROJECT}"}}`,
    );
  }
  if (!source.includes("./scripts/iphone.cjs")) {
    const anchor = /(['"])@bacons\/apple-targets\1/g;
    if ([...source.matchAll(anchor)].length !== 1)
      throw new Error(
        "Não foi possível localizar os plugins do aplicativo. Nenhum arquivo foi alterado.",
      );
    source = source.replace(anchor, '"./scripts/iphone.cjs",\n      $&');
  }
  return source;
}
function previewProfile(original) {
  const config = JSON.parse(original);
  config.cli = { ...config.cli, version: ">=27.5.0" };
  config.build = config.build || {};
  config.build.preview = {
    ...config.build.preview,
    developmentClient: false,
    distribution: "internal",
    environment: "preview",
    ios: { ...config.build.preview?.ios, simulator: false },
  };
  return JSON.stringify(config, null, 2) + "\n";
}
function prepare(root = process.cwd()) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );
  if (
    pkg.name !== "saboia-cleaning" ||
    !String(pkg.dependencies.expo).includes("58.")
  )
    throw new Error(
      "Execute na pasta SaboiaCleaning já atualizada para Expo 58.",
    );
  const configs = [
    ["app.config.ts", patchConfig],
    ["eas.json", previewProfile],
  ];
  const plans = configs.map(([name, transform]) => {
    const file = path.join(root, name);
    const original = fs.readFileSync(file, "utf8");
    return { name, file, original, updated: transform(original) };
  });
  const ignoreFile = path.join(root, ".easignore");
  const original = fs.existsSync(ignoreFile)
    ? fs.readFileSync(ignoreFile, "utf8")
    : fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  const lines = original.split(/\r?\n/);
  const missing = IGNORE.filter((p) => !lines.includes(p));
  plans.push({
    name: ".easignore",
    file: ignoreFile,
    original: fs.existsSync(ignoreFile) ? original : null,
    updated: missing.length
      ? original +
        "\n# Saboia: regenerate native code and keep local credentials off uploads\n" +
        missing.join("\n") +
        "\n"
      : original,
  });
  const backup = path.join(
    root,
    ".expo",
    "saboia-backups",
    "iphone-" + Date.now(),
  );
  fs.mkdirSync(backup, { recursive: true });
  const written = [];
  try {
    for (const p of plans) {
      if (p.original !== null)
        fs.writeFileSync(path.join(backup, p.name), p.original);
      fs.writeFileSync(p.file, p.updated);
      written.push(p);
    }
  } catch (error) {
    for (const p of written) {
      if (p.original === null) fs.rmSync(p.file, { force: true });
      else fs.writeFileSync(p.file, p.original);
    }
    throw error;
  }
  return backup;
}
function readPublicConfig(root = process.cwd()) {
  // Parse only the two public settings. Never inspect server-only credential values.
  const names = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];
  const result = {};
  const filename = path.join(root, ".env");
  const text = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
  for (const name of names) {
    let value = process.env[name];
    if (!value) {
      const match = text.match(
        new RegExp("^\\s*" + name + "\\s*=\\s*(.*?)\\s*$", "m"),
      );
      value = match?.[1];
      if (
        (value?.startsWith('"') && value.endsWith('"')) ||
        (value?.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
    }
    if (!value || value.includes("YOUR_"))
      throw new Error(
        "Falta " + name + " no seu .env. O arquivo não foi alterado.",
      );
    result[name] = value;
  }
  const url = new URL(result[names[0]]);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co"))
    throw new Error(
      "Use a URL HTTPS do projeto Supabase para instalar no iPhone.",
    );
  const key = result[names[1]];
  if (key.startsWith("sb_secret_") || key.startsWith("sk-"))
    throw new Error(
      "A configuração pública contém uma chave privada. Corrija somente a chave pública no .env.",
    );
  if (!key.startsWith("sb_publishable_")) {
    let payload;
    try {
      payload = JSON.parse(
        Buffer.from(key.split(".")[1] || "", "base64url").toString(),
      );
    } catch {
      throw new Error("A chave pública Supabase não foi reconhecida.");
    }
    if (payload.role !== "anon")
      throw new Error(
        "Use somente a chave anon/publicável do Supabase, nunca a service_role.",
      );
  }
  return result;
}
function eas(args, quiet = false) {
  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["--yes", CLI, ...args],
    { stdio: quiet ? "pipe" : "inherit", encoding: "utf8" },
  );
  if (result.error || result.status !== 0)
    throw new Error(
      quiet
        ? "Não foi possível preparar as variáveis públicas no Expo. Confirme o login na conta correta e tente novamente."
        : "O comando EAS não terminou. Envie a mensagem do terminal, sem senhas ou códigos.",
    );
}
function main() {
  const mode = process.argv[2] || "--prepare";
  if (!["--prepare", "--register", "--build"].includes(mode))
    throw new Error("Use --prepare, --register ou --build.");
  if (mode === "--prepare") {
    const backup = prepare();
    console.log("Configuração do iPhone preparada. Team ID: " + TEAM);
    console.log("Seu .env foi preservado. Backup: " + backup);
    console.log("Próximo: node scripts/iphone.cjs --register");
    return;
  }
  if (mode === "--register") {
    eas(["device:create"]);
    return;
  }
  const values = readPublicConfig();
  prepare();
  for (const [name, value] of Object.entries(values)) {
    eas(
      [
        "env:set",
        "preview",
        "--name",
        name,
        "--value",
        value,
        "--visibility",
        "plaintext",
        "--scope",
        "project",
        "--non-interactive",
      ],
      true,
    );
    console.log(
      name + ": configurada no ambiente preview (valor não exibido).",
    );
  }
  eas(["build", "--platform", "ios", "--profile", "preview"]);
}
function withIphoneSigning(config) {
  config.extra = config.extra || {};
  config.extra.eas = config.extra.eas || {};
  config.extra.eas.build = config.extra.eas.build || {};
  config.extra.eas.build.experimental =
    config.extra.eas.build.experimental || {};
  const ios = (config.extra.eas.build.experimental.ios =
    config.extra.eas.build.experimental.ios || {});
  ios.appExtensions = ios.appExtensions || [];
  const entry = {
    targetName: "SaboiaShare",
    bundleIdentifier: "com.saboiacleaning.app.share",
    entitlements: {
      "com.apple.security.application-groups": ["group.com.saboiacleaning.app"],
    },
  };
  const index = ios.appExtensions.findIndex(
    (e) => e.bundleIdentifier === entry.bundleIdentifier,
  );
  if (index >= 0) {
    if (ios.appExtensions[index].targetName !== entry.targetName)
      throw new Error("A extensão iOS configurada tem outro nome.");
    ios.appExtensions[index] = entry;
  } else ios.appExtensions.push(entry);
  return config;
}
module.exports = withIphoneSigning;
Object.assign(module.exports, {
  patchConfig,
  previewProfile,
  prepare,
  readPublicConfig,
  withIphoneSigning,
  TEAM,
  OWNER,
  PROJECT,
});
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
