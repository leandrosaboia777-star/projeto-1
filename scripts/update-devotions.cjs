#!/usr/bin/env node
// Update only the reviewed assistant review files; preserve .env and Apple/EAS setup.
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const manifest = {
  "App.tsx": "90311d3dcc2432ca39b123d96d74ced0cffc97c335a17eadb797c02b68f4f489",
  "assets/icon.png":
    "0bfaf3fe8f1ec1a0598ee46621198f0d8614fccebbc267591765d7820483488d",
  "src/components/ui.tsx":
    "380fbd821a2e8046683772658c8c78b2f03c9573dd2a878d2bbc764d730e8fa2",
  "src/components/PrivatePhoto.tsx":
    "a301d008d0c65035134d18fe00e9e23d4bc8ce3ffe7de4d1e0d7d29e4f7337cf",
  "src/components/ProposalReview.tsx":
    "52080bbf28d0b643af3c1fa078aedd65e189c97aaf913c9f842d26ccc8097f9c",
  "src/domain/content.ts":
    "ce2a7736f8fb57015a5baaefc5733ba79b0f92879c60b7bff59d1c3a2d6ff420",
  "src/domain/schema.ts":
    "57fef92d91e6c150cf2d4d51a45ad50b24469844b4408864365370487448b297",
  "src/domain/rescheduling.ts":
    "8411896a80da31d8fbe149901807bdb8c69607ed60b40fa97b39bd019c4924d2",
  "src/screens/Houses.tsx":
    "123c35d809ec0d7087e8eb187c7987c882fae2cceb5562a355762f457113593e",
  "src/screens/Assistant.tsx":
    "6b5bfe96ef5d929681e05fcbbbec77ffe85603b4487b80c1416c2b08b6ae1deb",
  "src/screens/Dashboard.tsx":
    "70e34257fe93140a91aac7e322a68c17e020efc0b07f221d588d18f07cb66992",
  "src/screens/Requests.tsx":
    "d1ccceda441dd0f6b286e08f38271e4cd3628c04d67b545cb249f73c736b8a4e",
  "src/screens/Settings.tsx":
    "d27baf148227ed75cce6ff3675ead01f9972b067c55bc50140f3394893322184",
  "src/lib/photos.ts":
    "7be8293204fb4140782c36356bab4fba926f013250fbb735ae87918d1cce225b",
  "src/lib/content.tsx":
    "df54d84d8280a28cf98e7a4c454807c63e7ed5236eb00e7637f580c057d826d9",
  "src/lib/requestNotifications.ts":
    "5da32940e79a499a90c0fce2e50c2574b111b879bb2e625f7ddfdc2bfb8919b1",
  "supabase/functions/translate-content/index.ts":
    "60a0aefb23fe0d428dd7b3ce6f8cbfa92236209ef023001cbc5ba82bebef26f6",
  "supabase/migrations/202611060007_house_cover.sql":
    "2dd6c23718decbf9b009c99aa477442d22cf4eeca15bb0a50a12405c7bf00444",
  "scripts/setup-home-update.cjs":
    "decabdb1aae0b75a03b5306216921e6e6d6d93dfebbf56391af8051c41535674",
  "docs/HOME-UPDATE.md":
    "0408527681eec54bf06646b55e689ee674a33286ce600dc35cdeb1366b46e75d",
  "src/components/Devotions.tsx":
    "e8deb76059e38eee416bb25afa1966d1257c14a459708c7d7de30bb843bab9bd",
  "src/domain/devotions.ts":
    "60eaadfea326e41126ecacbd0acd1a8c0b096b1d20c8a75cdeb90f5e9554aec5",
  "src/lib/devotions.ts":
    "ce7d7169d8b2bf6ab0013e5886e895b5eb24d4e8ee1548e8b8639b1efd5de4f0",
  "src/lib/notifications.ts":
    "50ff76bc5db018fb17a65a11b44320aec23e0a357638beae65a9cfb658efb0cb",
  "src/screens/Calendar.tsx":
    "acfd2c86dc5404137ad9cabf6d1e85c3900e9f6b1402df05cc605b993d1448e1",
  "docs/DEVOTIONS.md":
    "c0d6b1b349f913d0fabe3a95fdd7e62d6a287ea514557ab6f9deee8fbea8227c",
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
    "devotions-" + Date.now(),
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
  const configFile = path.join(root, "app.config.ts");
  if (fs.existsSync(configFile)) {
    const original = fs.readFileSync(configFile, "utf8");
    const updated = original
      .replaceAll("#315E4F", "#DCEFFC")
      .replaceAll("#F5F5F0", "#F2F7FC");
    if (updated !== original) write("app.config.ts", updated);
  }
  const supaConfig = fs.readFileSync(
    path.join(root, "supabase/config.toml"),
    "utf8",
  );
  if (!supaConfig.includes("[functions.translate-content]"))
    write(
      "supabase/config.toml",
      supaConfig +
        '\n[functions.translate-content]\nverify_jwt = false\nimport_map = "./functions/deno.json"\n',
    );
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
