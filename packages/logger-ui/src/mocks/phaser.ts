import { vi } from "vitest";

// Mock Phaser's EventEmitter using a mock class with basic implementation
class MockPhaserEventEmitter {
  private listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  on = vi.fn((eventName: string, listener: (...args: unknown[]) => void) => {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(listener);
  });

  off = vi.fn((eventName: string, listener: (...args: unknown[]) => void) => {
    if (this.listeners[eventName]) {
      this.listeners[eventName] = this.listeners[eventName].filter(
        (l) => l !== listener
      );
    }
  });

  emit = vi.fn((eventName: string, ...args: unknown[]) => {
    if (this.listeners[eventName]) {
      [...this.listeners[eventName]].forEach((listener) => {
        listener(...args);
      });
    }
  });

  destroy = vi.fn(() => {
    this.listeners = {};
  });

  listenerCount = vi.fn((eventName: string) => {
    return this.listeners[eventName]?.length || 0;
  });

  removeAllListeners = vi.fn(() => {
    this.listeners = {};
  });

  constructor() {}
}

// Global Mock for Phaser
vi.mock("phaser", () => {
  return {
    // __esModule: true, // Add if needed based on how Phaser is structured/imported
    default: {
      Events: {
        EventEmitter: MockPhaserEventEmitter, // Use the mock class
      },
    },
    Events: {
      EventEmitter: MockPhaserEventEmitter, // Use the mock class
    },
  };
});
