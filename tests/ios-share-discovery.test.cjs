const test=require('node:test');
const assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const path=require('node:path');
test('Apple Targets discovers share config through its exact glob pattern',()=>{
 const requireForTargets=createRequire(require.resolve('@bacons/apple-targets/package.json'));
 const discovered=requireForTargets('glob').globSync('./targets/*/expo-target.config.@(json|js)',{cwd:path.resolve(__dirname,'..'),absolute:true});
 assert.ok(discovered.includes(path.resolve(__dirname,'../targets/share/expo-target.config.js')),'Missing share config: incompatible glob/minimatch can silently omit native targets.');
});
