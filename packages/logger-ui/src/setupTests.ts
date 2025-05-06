// Import matchers from jest-dom
import "@testing-library/jest-dom/vitest";
import { vi, Mock } from "vitest";
import { EventLogEntry } from "./types";
import { CommunicationManager } from "./CommunicationManager";

// Define listener callback type needed for CommManager mock
type ListenerCallback = (...args: unknown[]) => void;

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

// --- Global Mock for CommunicationManager ---
vi.mock("./CommunicationManager", () => {
  // Initialize listeners record here
  const listeners: Record<string, Array<ListenerCallback>> = {};

  // Define the explicit type for the mock instance
  type MockManagerType = {
    logEvent: Mock;
    clearLog: Mock;
    getEventLog: Mock<() => EventLogEntry[]>;
    setMaxLogSize: Mock;
    setRedirectEventsToConsole: Mock;
    on: Mock<
      (event: string | symbol, callback: ListenerCallback) => MockManagerType
    >;
    off: Mock<
      (event: string | symbol, callback?: ListenerCallback) => MockManagerType
    >;
    _listeners: Record<string, Array<ListenerCallback>>;
    _trigger: (event: string, ...args: unknown[]) => void;
  };

  // Define the shape of our mock, including internal helpers
  // Explicitly type mockInstance
  const mockInstance: MockManagerType = {
    // --- Actual CommunicationManager methods we need to mock ---
    logEvent: vi.fn(),
    clearLog: vi.fn(),
    getEventLog: vi.fn(() => []),
    setMaxLogSize: vi.fn(),
    setRedirectEventsToConsole: vi.fn(),
    // Mock 'on' to store listeners
    on: vi.fn(
      (event: string | symbol, callback: ListenerCallback): MockManagerType => {
        // Explicit return type
        const eventKey = String(event); // Use string key for listeners object
        if (!listeners[eventKey]) {
          listeners[eventKey] = [];
        }
        listeners[eventKey].push(callback);
        return mockInstance; // Return instance for chaining
      }
    ),
    // Mock 'off' to remove listeners
    off: vi.fn(
      (
        event: string | symbol,
        callback?: ListenerCallback
      ): MockManagerType => {
        // Explicit return type
        const eventKey = String(event); // Use string key for listeners object
        if (listeners[eventKey]) {
          listeners[eventKey] = listeners[eventKey].filter(
            (cb) => cb !== callback
          );
        }
        return mockInstance; // Return instance for chaining
      }
    ),
    // --- Internal properties/methods for testing ---
    _listeners: listeners, // Assign the listeners object
    _trigger: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(...args));
      }
    },
  };

  return {
    CommunicationManager: {
      // Ensure getInstance returns the correctly shaped mock object
      getInstance: vi.fn(() => mockInstance as unknown as CommunicationManager),
    },
  };
});
// --- End CommunicationManager Mock ---
