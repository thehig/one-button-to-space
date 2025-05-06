import { vi } from "vitest";

// Global spies for console methods
// Export them so tests can import and check calls/clear mocks.
export const globalConsoleWarnSpy = vi
  .spyOn(console, "warn")
  .mockImplementation(() => {});
export const globalConsoleErrorSpy = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});

// If you need to access these spies in your tests (e.g., to check calls),
// you can export them:
// export const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
// export const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
