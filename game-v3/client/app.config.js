// Dynamic Expo config — reads API/WS URLs from environment at build time.

module.exports = {
  expo: {
    name: 'EmpireOS V3',
    slug: 'empire-os-v3',
    version: '0.1.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    backgroundColor: '#030712',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.empireos.v3',
    },
    android: {
      package: 'com.empireos.v3',
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
