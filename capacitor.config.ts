import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.atuner.app",
  appName: "A Tuner",
  webDir: "dist-mobile",
  backgroundColor: "#0b0d0e",
  android: {
    backgroundColor: "#0b0d0e",
    allowMixedContent: false,
  },
};

export default config;
