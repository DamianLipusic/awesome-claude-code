// Dynamic Expo config — reads API/WS URLs from environment at build time.
//
// Development (local):
//   npx expo start
//
// Production (VPS):
//   API_BASE_URL=http://YOUR_VPS_IP:3000/api/v1 \
//   WS_BASE_URL=ws://YOUR_VPS_IP:3000/ws \
//   npx expo start --tunnel

module.exports = {
  expo: {
    name: 'EmpireOS',
    slug: 'empire-os',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    backgroundColor: '#030712',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.empireos.app',
    },
    android: {
      package: 'com.empireos.app',
      adaptiveIcon: {
        backgroundColor: '#030712',
      },
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
      apiBaseUrl: process.env.API_BASE_URL ?? 'http://187.124.18.170:3000/api/v1',
      wsBaseUrl:  process.env.WS_BASE_URL  ?? 'ws://187.124.18.170:3000/ws',
    },
  },
};
