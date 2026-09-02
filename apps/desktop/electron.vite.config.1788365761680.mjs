// electron.vite.config.ts
import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
var __electron_vite_injected_dirname = "D:\\peep\\apps\\desktop";
var workspacePackages = [
  "@peep/shared",
  "@peep/platform-core",
  "@peep/agent",
  "@peep/flutter-adapter"
];
var electron_vite_config_default = defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/main/index.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/preload/index.ts"),
          inspector: resolve(__electron_vite_injected_dirname, "src/preload/inspector.ts")
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        "@renderer": resolve(__electron_vite_injected_dirname, "src/renderer/src")
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, "src/renderer/index.html")
        }
      }
    }
  }
});
export {
  electron_vite_config_default as default
};
