#!/usr/bin/env node
// Temporary Expo SDK 54 compatibility for Xcode's Device Hub.
// This changes only local CLI app discovery/activation. No signing, build,
// simctl, or other prerequisite validation is disabled. npm ci restores originals.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const patches = [
  ['build/src/start/doctor/apple/SimulatorAppPrerequisite.js', [
    ['id of app "Simulator"', 'id of app "Device Hub"'],
    ["result !== 'com.apple.iphonesimulator' && result !== 'com.apple.CoreSimulator.SimulatorTrampoline'", "result !== 'com.apple.iphonesimulator' && result !== 'com.apple.CoreSimulator.SimulatorTrampoline' && result !== 'com.apple.dt.Devices'"],
  ]],
  ['build/src/start/platforms/ios/ensureSimulatorAppRunning.js', [
    ['processes whose name is "Simulator"', 'processes whose name is "Device Hub"'],
    ["'Simulator'", "'Device Hub'"],
  ]],
  ['build/src/start/platforms/ios/AppleDeviceManager.js', [
    ['tell application "Simulator" to activate', 'tell application "Device Hub" to activate'],
  ]],
];
function transform(source, replacements) {
  let result = source;
  for (const [before, after] of replacements) {
    if (result.includes(after)) continue;
    if (result.split(before).length !== 2) throw new Error('Unexpected Expo CLI source. No files changed; send this message for review.');
    result = result.replace(before, after);
  }
  new vm.Script(result);
  return result;
}
function main() {
  const check = process.argv.includes('--check');
  if (!check) {
    if (process.platform !== 'darwin') throw new Error('Run this helper on the Mac with Xcode.');
    const id = execFileSync('osascript', ['-e', 'id of app "Device Hub"'], {encoding:'utf8'}).trim();
    if (id !== 'com.apple.dt.Devices') throw new Error('Device Hub has an unexpected identifier. No files changed.');
    execFileSync('xcrun', ['simctl','help'], {stdio:'ignore'});
  }
  const expoRoot = path.dirname(require.resolve('expo/package.json', {paths:[process.cwd()]}));
  const cliRoot = path.dirname(require.resolve('@expo/cli/package.json', {paths:[expoRoot]}));
  const version = JSON.parse(fs.readFileSync(path.join(cliRoot,'package.json'),'utf8')).version;
  if (!version.startsWith('54.')) throw new Error(`This helper supports Expo CLI 54 only, found ${version}. No files changed.`);
  // Validate every expected source and syntax before modifying any file.
  const plans = patches.map(([relative, replacements])=>{
    const file = path.join(cliRoot,relative);
    const original = fs.readFileSync(file,'utf8');
    return {file,original,updated:transform(original,replacements)};
  });
  if (check) { console.log(`Validated ${plans.length} CLI files for Expo ${version}. No files changed.`); return; }
  const written=[];
  try {
    for (const plan of plans) {
      if (plan.original===plan.updated) continue;
      const backup=plan.file+'.saboia-device-hub-backup';
      if (!fs.existsSync(backup)) fs.copyFileSync(plan.file,backup,fs.constants.COPYFILE_EXCL);
      fs.writeFileSync(plan.file,plan.updated);written.push(plan);
    }
  } catch (error) {
    for (const plan of written) fs.writeFileSync(plan.file,plan.original);
    throw error;
  }
  console.log('Device Hub compatibility applied. Run: npx expo run:ios');
}
if (require.main===module) {try {main();} catch(error) {console.error(error.message);process.exitCode=1;} }
module.exports={transform,patches};
