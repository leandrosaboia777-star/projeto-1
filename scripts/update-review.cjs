#!/usr/bin/env node
// Update only the reviewed assistant review files; preserve .env and Apple/EAS setup.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const manifest = {
  "src/screens/Assistant.tsx":
    "cc5aaf31a275bb5735738e2659012b0dacf1412466b9b6c30baf36b392c1497d",
  "src/components/ProposalReview.tsx":
    "52080bbf28d0b643af3c1fa078aedd65e189c97aaf913c9f842d26ccc8097f9c",
  "src/domain/rescheduling.ts":
    "8411896a80da31d8fbe149901807bdb8c69607ed60b40fa97b39bd019c4924d2",
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
    "review-" + Date.now(),
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
  console.log(
    "Atualização salva. .env e configuração Apple/EAS preservadas. Backup: " +
      backup,
  );
  console.log("Próximo passo: node scripts/iphone.cjs --build");
  console.log(
    "Essa preparação ainda não altera o aplicativo instalado no iPhone.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
