module.exports = config => ({
  type: 'share', name: 'SaboiaShare', displayName: 'Saboia Cleaning',
  bundleIdentifier: '.share', deploymentTarget: '15.1',
  frameworks: ['UIKit', 'Social', 'UniformTypeIdentifiers'],
  entitlements: { 'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'] },
});
