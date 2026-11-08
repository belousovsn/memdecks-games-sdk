import { defineConfig } from "vite";

// mp-client ships CommonJS. From npm, Vite converts it on its own. Inside the SDK repo the
// package is linked from `packages/`, so it has to be named for both dev and build.
const sdk = [/@memdecks[\/]mp-/, /packages[\/]mp-/];

export default defineConfig({
  // The memdecks site loads the game at the root of its own host.
  base: "/",
  server: { port: 5173 },
  optimizeDeps: { include: ["@memdecks/mp-client"] },
  build: { commonjsOptions: { include: [...sdk, /node_modules/] } },
});
