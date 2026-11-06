const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
function run(mode) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "saboia-profile-"));
  fs.mkdirSync(path.join(root, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs/portfolio"), { recursive: true });
  fs.mkdirSync(path.join(root, "bin"));
  fs.copyFileSync(
    "scripts/publish-portfolio.cjs",
    path.join(root, "scripts/publish-portfolio.cjs"),
  );
  fs.copyFileSync(
    "docs/portfolio/github-metadata.json",
    path.join(root, "docs/portfolio/github-metadata.json"),
  );
  fs.writeFileSync(
    path.join(root, "docs/PROFILE-README.md"),
    "# English portfolio introduction\n",
  );
  const log = path.join(root, "calls.jsonl");
  const stub = `#!${process.execPath}
 const fs=require('node:fs');const args=process.argv.slice(2);let input='';if(args.includes('--input'))input=fs.readFileSync(0,'utf8');fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args,input})+'\\n');const endpoint=args[1],method=args.includes('--method')?args[args.indexOf('--method')+1]:'GET';const mode=${JSON.stringify(mode)};if(endpoint==='user'&&method==='GET')process.stdout.write(mode==='wrong'?'another-account':'leandrosaboia777-star');else if(endpoint==='user/repos'&&method==='GET')process.stdout.write(JSON.stringify(mode==='existing'?[[{full_name:'leandrosaboia777-star/leandrosaboia777-star'}]]:[[]]));else if(endpoint.endsWith('/contents'))process.stdout.write(JSON.stringify([{name:'README.md'}]));else process.stdout.write('{}');`;
  fs.writeFileSync(path.join(root, "bin/gh"), stub, { mode: 0o700 });
  const result = spawnSync(
    process.execPath,
    [path.join(root, "scripts/publish-portfolio.cjs")],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: path.join(root, "bin") + path.delimiter + process.env.PATH,
      },
    },
  );
  const calls = fs
    .readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  fs.rmSync(root, { recursive: true, force: true });
  return { result, calls };
}
test("portfolio publishing stops before writes when the authenticated account is wrong", () => {
  const { result, calls } = run("wrong");
  assert.equal(result.status, 1);
  assert.equal(calls.length, 1);
  assert.match(result.stderr, /does not match/);
});
test("portfolio publishing creates a missing profile README with the prepared English content", () => {
  const { result, calls } = run("new");
  assert.equal(result.status, 0, result.stderr);
  const created = calls.find(
    (c) => c.args[1] === "user/repos" && c.args.includes("POST"),
  );
  assert.ok(created);
  assert.equal(JSON.parse(created.input).private, false);
  const readme = calls.find((c) => c.args[1].endsWith("/contents/README.md"));
  assert.ok(readme);
  assert.equal(
    Buffer.from(JSON.parse(readme.input).content, "base64").toString(),
    "# English portfolio introduction\n",
  );
  assert.ok(calls.some((c) => c.args[1].endsWith("/topics")));
});
test("portfolio publishing preserves an existing profile README", () => {
  const { result, calls } = run("existing");
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    calls.some((c) => c.args[1].endsWith("/contents/README.md")),
    false,
  );
  assert.match(result.stdout, /preserved/);
});
