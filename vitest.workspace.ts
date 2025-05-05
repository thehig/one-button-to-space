import { defineWorkspace } from "vitest/config";

// defineWorkspace provides type safety for the configuration
export default defineWorkspace([
  "packages/*",
  // You could also define projects individually
  // {
  //   test: {
  //     name: 'client',
  //     root: './packages/client',
  //     environment: 'jsdom', // Example: specific environment for client tests
  //   },
  // },
  // {
  //   test: {
  //     name: 'server',
  //     root: './packages/server',
  //     environment: 'node',
  //   },
  // },
]);
