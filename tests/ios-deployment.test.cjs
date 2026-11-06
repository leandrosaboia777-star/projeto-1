const test=require('node:test');
const assert=require('node:assert/strict');
const {patchPodfile,patchAppConfig}=require('../scripts/fix-ios-deployment.cjs');
const fixture="target 'Example' do\n  post_install do |installer|\n    react_native_post_install(\n      installer,\n      config[:reactNativePath],\n      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )\n  end\nend\n";
test('pod target hook runs after React Native and preserves its configuration',()=>{
 const changed=patchPodfile(fixture);
 assert.ok(changed.includes('Gem::Version.new(\'15.1\')'));
 assert.ok(changed.indexOf('minimum_ios')>changed.indexOf(':ccache_enabled'));
 assert.ok(changed.includes('Gem::Version.new(current_ios.to_s) < minimum_ios'));
 assert.ok(changed.endsWith('  end\nend\n'));
 assert.equal(patchPodfile(changed),changed);
});
test('app config registration preserves user project ID and environment references',()=>{
 const original='export default {expo:{ios:{appleTeamId:process.env.APPLE_TEAM_ID},plugins:["@bacons/apple-targets"],extra:{eas:{projectId:"my-existing-id"}}}};';
 const changed=patchAppConfig(original);
 assert.ok(changed.includes('"my-existing-id"'));
 assert.ok(changed.includes('process.env.APPLE_TEAM_ID'));
 assert.equal(patchAppConfig(changed),changed);
});
test('unrecognized layouts are rejected',()=>{
 assert.throws(()=>patchPodfile('unexpected'));
 assert.throws(()=>patchAppConfig('unexpected'));
});
