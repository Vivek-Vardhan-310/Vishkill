import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vishkill.app',
  appName: 'VishKill',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
    allowNavigation: ['10.1.12.160', 'localhost', '127.0.0.1'],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
};

export default config;
