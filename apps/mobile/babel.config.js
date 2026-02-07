module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    // 'nativewind/babel', // TODO: re-enable after proper NativeWind v4 setup
  ],
  plugins: [
    'react-native-reanimated/plugin', // Must be last
  ],
};
