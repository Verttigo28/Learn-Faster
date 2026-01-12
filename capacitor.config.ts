import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ch.baptistef.learnfaster',
  appName: 'learn-faster',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: { enabled: true }
  }
};

export default config;
