const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'saboia-codegen-'));
try {
  const result = spawnSync(process.execPath, [
    path.join(path.dirname(require.resolve('react-native/package.json')), 'scripts/generate-codegen-artifacts.js'),
    '-p', process.cwd(), '-t', 'ios', '-o', output,
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
