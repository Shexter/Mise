const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo's Android development wrapper calls expo-keep-awake automatically.
// Version 15.0.8 leaves activation rejections unhandled when Expo Go's
// Activity is temporarily inactive (for example during a refresh). Route only
// that package import through a compatible wrapper which catches the known
// lifecycle rejection. Production output retains the same native API.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo-keep-awake') {
    return {
      filePath: path.resolve(__dirname, 'src/shims/expoKeepAwake.ts'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
