import { vi, Mock } from "vitest";
import { EventLogEntry } from "../types";
import { CommunicationManager as RealCommunicationManager } from "../managers/CommunicationManager"; // Import real type for casting

// Define listener callback type needed for CommManager mock
type ListenerCallback = (...args: unknown[]) => void;

// Define the shape of our mock, including internal helpers
// Export this type for use in tests
export type MockManagerType = {
  eventLog: EventLogEntry[];
  maxLogSize: number;
  _redirectEventsToConsole: boolean;
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

// Export the instance for tests that need the helpers
export let mockCommunicationManagerInstance: MockManagerType;

// Global Mock for CommunicationManager
vi.mock("../managers/CommunicationManager", () => {
  // IMPORTANT: Adjust path relative to *this file*
  // Initialize listeners record here
  const listeners: Record<string, Array<ListenerCallback>> = {};

  // Explicitly type mockInstance
  const instance: MockManagerType = {
    eventLog: [],
    maxLogSize: 100,
    _redirectEventsToConsole: false,

    logEvent: vi.fn(function (this: MockManagerType, source, eventName, data) {
      const timestamp = new Date().toISOString(); // Generate timestamp here
      const entry = { timestamp, source, eventName, data };
      (this.eventLog as EventLogEntry[]).push(entry);
      if (this.eventLog.length > this.maxLogSize) {
        this.eventLog = this.eventLog.slice(-this.maxLogSize);
      }
      // No base emit here, handled by _trigger if needed
    }),
    clearLog: vi.fn(function (this: MockManagerType) {
      (this.eventLog as EventLogEntry[]) = [];
      // Call logEvent on the instance itself
      this.logEvent("CommunicationManager", "logCleared", undefined);
    }),
    getEventLog: vi.fn(function (this: MockManagerType) {
      return [...(this.eventLog as EventLogEntry[])];
    }),
    setMaxLogSize: vi.fn(function (this: MockManagerType, size: number) {
      const oldSize = this.maxLogSize;
      const newSize = Math.max(1, size);
      this.maxLogSize = newSize;
      // Call logEvent on the instance itself
      this.logEvent("CommunicationManager", "maxLogSizeSet", {
        newSize,
        oldSize,
        trimmedLog: this.eventLog.length > newSize, // Check if trimming would occur
      });
      // Actual trimming now happens in logEvent if needed
    }),
    setRedirectEventsToConsole: vi.fn(function (
      this: MockManagerType,
      enabled: boolean
    ) {
      if (this._redirectEventsToConsole !== enabled) {
        this._redirectEventsToConsole = enabled;
        // Call logEvent on the instance itself
        this.logEvent("CommunicationManager", "setRedirectEventsToConsole", {
          enabled,
        });
      }
    }),
    on: vi.fn(
      (event: string | symbol, callback: ListenerCallback): MockManagerType => {
        const eventKey = String(event);
        if (!listeners[eventKey]) {
          listeners[eventKey] = [];
        }
        listeners[eventKey].push(callback);
        return instance;
      }
    ),
    off: vi.fn(
      (
        event: string | symbol,
        callback?: ListenerCallback
      ): MockManagerType => {
        const eventKey = String(event);
        if (listeners[eventKey]) {
          listeners[eventKey] = listeners[eventKey].filter(
            (cb) => cb !== callback
          );
        }
        return instance;
      }
    ),
    _listeners: listeners,
    _trigger: (event: string, ...args: unknown[]) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(...args));
      }
    },
  };

  // Assign the created instance to the exported variable
  mockCommunicationManagerInstance = instance;

  return {
    CommunicationManager: {
      // Ensure getInstance returns the correctly shaped mock object
      getInstance: vi.fn(() => instance as unknown as RealCommunicationManager),
    },
  };
});
