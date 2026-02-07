const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// Mobile app uses React 19, desktop uses React 18
// We must ensure Metro always resolves 'react' from mobile's local node_modules
const mobileReactPath = path.resolve(projectRoot, 'node_modules/react');

/**
 * Metro configuration for Envoy Mobile (monorepo)
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [monorepoRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Use resolveRequest to force React 19 regardless of hierarchical lookup
    resolveRequest: (context, moduleName, platform) => {
      // Redirect all 'react' imports to mobile's React 19
      if (moduleName === 'react' || moduleName.startsWith('react/')) {
        const redirected = moduleName.replace(/^react/, mobileReactPath);
        return context.resolveRequest(context, redirected, platform);
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
