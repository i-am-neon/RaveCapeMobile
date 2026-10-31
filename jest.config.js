module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Native-module-heavy packages ship untranspiled sources.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-.*|reanimated-color-picker|@shopify/react-native-skia)/)',
  ],
};
