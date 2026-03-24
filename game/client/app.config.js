// Dynamic Expo config — reads API/WS URLs from environment at build time.
// Set API_BASE_URL and WS_BASE_URL before running:
//   API_BASE_URL=http://YOUR_VPS_IP:3000/api/v1 WS_BASE_URL=ws://YOUR_VPS_IP:3000/ws npx expo start

module.exports = {
  expo: {
    name: 'EmpireOS',
    slug: 'empire-os',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    splash: {
      resizeMode: 'contain',
      backgroundColor: '#030712',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.empireos.app',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#030712',
      },
      package: 'com.empireos.app',
    },
    plugins: [
      'expo-secure-store',
      [
        'expo-notifications',
        {
          color: '#22c55e',
          sounds: [],
        },
      ],
    ],
    extra: {
      apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3000/api/v1',
      wsBaseUrl: process.env.WS_BASE_URL ?? 'ws://localhost:3000/ws',
    },
  },
};
