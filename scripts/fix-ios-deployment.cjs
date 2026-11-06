// Keep third-party Pod targets at or above Expo SDK 54's iOS 15.1 minimum.
// Also exports an Expo config plugin so the fix survives native regeneration.
const fs = require('node:fs');
const path = require('node:path');
const marker = '# saboia-minimum-pod-ios';
const pluginPath = './scripts/fix-ios-deployment.cjs';
function patchPodfile(source) {
  if (source.includes(marker)) return source;
  const pattern = /(react_native_post_install\([\s\S]*?\n[ \t]*\))\n/g;
  if ([...source.matchAll(pattern)].length !== 1) throw new Error('Unexpected Podfile layout. No files changed.');
  const hook = `\n    ${marker}\n    minimum_ios = Gem::Version.new('15.1')\n    installer.pods_project.targets.each do |pod_target|\n      pod_target.build_configurations.each do |configuration|\n        current_ios = configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n        if current_ios.nil? || Gem::Version.new(current_ios.to_s) < minimum_ios\n          configuration.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = minimum_ios.to_s\n        end\n      end\n    end\n`;
  return source.replace(pattern, '$1\n' + hook);
}
function patchAppConfig(source) {
  if (source.includes(pluginPath)) return source;
  const pattern = /(['"])@bacons\/apple-targets\1/g;
  if ([...source.matchAll(pattern)].length !== 1) throw new Error('Unexpected app.config.ts layout. No files changed.');
  return source.replace(pattern, JSON.stringify(pluginPath) + ',\n      $&');
}
function withPodMinimum(config) {
  const {withPodfile} = require('expo/config-plugins');
  return withPodfile(config, mod => {
    mod.modResults.contents = patchPodfile(mod.modResults.contents);
    return mod;
  });
}
function main() {
  const root = process.cwd();
  const files = [
    ['ios/Podfile', patchPodfile],
    ['app.config.ts', patchAppConfig],
  ].map(([relative, transform]) => {
    const file = path.join(root, relative);
    const original = fs.readFileSync(file, 'utf8');
    return {relative, file, original, updated: transform(original)};
  });
  const backup = path.join(root, '.expo', 'saboia-backups', String(Date.now()));
  fs.mkdirSync(backup, {recursive:true});
  const written=[];
  try {
    for (const f of files) {
      if (f.original===f.updated) continue;
      fs.writeFileSync(path.join(backup,path.basename(f.file)), f.original);
      fs.writeFileSync(f.file,f.updated);written.push(f);
    }
  } catch(error) {
    for(const f of written)fs.writeFileSync(f.file,f.original);
    throw error;
  }
  console.log('iOS minimum deployment target fix applied (15.1).');
  console.log('Next: npx expo run:ios');
}
module.exports=withPodMinimum;
module.exports.patchPodfile=patchPodfile;
module.exports.patchAppConfig=patchAppConfig;
if (require.main===module) {try {main();}catch(error){console.error(error.message);process.exitCode=1;}}
