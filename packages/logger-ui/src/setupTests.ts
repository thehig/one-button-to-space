// Import matchers from jest-dom
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// --- Global Mock for Phaser ---
vi.mock("phaser", () => {
  const mockEventEmitterInstance = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    default: {},
    Events: {
      EventEmitter: vi.fn(() => mockEventEmitterInstance),
    },
  };
});
// --- End Phaser Mock ---
