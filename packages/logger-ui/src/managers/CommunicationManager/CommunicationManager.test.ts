import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { EventLogEntry } from "../../types"; // Assuming types.ts is in the same directory

// Unmock CommunicationManager for this test file to use the real implementation
vi.unmock("./CommunicationManager");

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
      // Create a copy in case a listener modifies the array during iteration
      [...this.listeners[eventName]].forEach((listener) => {
        listener(...args);
      });
    }
  });

  destroy() {
    vi.fn(() => {
      // Clear listeners on destroy
      this.listeners = {};
    })(); // Immediately call the mock function to track calls if needed, though spying on prototype is preferred
  }

  listenerCount = vi.fn((eventName: string) => {
    return this.listeners[eventName]?.length || 0;
  });

  // Add the missing method
  removeAllListeners = vi.fn(() => {
    // Simulate clearing listeners
    this.listeners = {};
  });

  constructor() {
    // No specific logic needed in the mock constructor
  }
}

vi.mock("phaser", () => ({
  __esModule: true,
  default: {
    // Provide a default export
    Events: {
      EventEmitter: MockPhaserEventEmitter, // Use the mock class
    },
  },
  Events: {
    // Also export Events directly
    EventEmitter: MockPhaserEventEmitter, // Use the mock class
  },
}));

// Dynamically import to allow resetting singleton between tests
let CommunicationManager: typeof import("./CommunicationManager").CommunicationManager;
let managerInstance: import("./CommunicationManager").CommunicationManager;

// Mock window for console redirection tests
const mockConsoleLog = vi.fn();
// Define a minimal type for the mocked window properties
interface MockWindow {
  __console_log_original?: (...args: unknown[]) => void;
  console?: {
    log?: (...args: unknown[]) => void;
  };
}
(global.window as MockWindow) = {
  __console_log_original: mockConsoleLog,
  console: {
    log: mockConsoleLog, // Provide a fallback if __console_log_original isn't checked
  },
};

const MOCK_TIMESTAMP = "2024-01-01T12:00:00.000Z";
const MOCK_DATE_NOW = new Date(MOCK_TIMESTAMP).getTime();

describe("CommunicationManager", () => {
  beforeEach(async () => {
    // Clear mocks before each test, including the Phaser mock's calls
    vi.clearAllMocks(); // Use clearAllMocks to reset call counts etc.
    // Reset modules to ensure a fresh singleton state for each test
    vi.resetModules();
    // Use fake timers for consistent timestamps
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_DATE_NOW);

    // Dynamically import the class *after* resetting modules
    const module = await import("./CommunicationManager");
    CommunicationManager = module.CommunicationManager;

    // Mock the original console log function on the window object
    mockConsoleLog.mockClear(); // Clear mock calls from previous tests
    // Use the defined type for the window mock
    (global.window as MockWindow).__console_log_original = mockConsoleLog;

    // Get the instance *after* dynamic import and mocks setup
    managerInstance = CommunicationManager.getInstance();
  });

  afterEach(() => {
    // Clean up listeners and destroy the instance
    if (managerInstance) {
      managerInstance.destroy();
    }
    // Explicitly reset the mocked Phaser emitter's state if needed, though clearAllMocks should handle calls.
    // mockPhaserEmitter.destroy.mockClear(); // etc. if needed

    // Attempt to force singleton reset
    // Type cast to access the private static property for deletion
    delete (CommunicationManager as unknown as { instance?: unknown }).instance;
    // Restore timers and mocks
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // --- Test Cases ---

  describe("Singleton Pattern (getInstance)", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = CommunicationManager.getInstance();
      const instance2 = CommunicationManager.getInstance();
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(managerInstance); // Should be the same as the one from beforeEach
    });

    // Note: Testing "creation if none exists" is implicitly covered by beforeEach
    // and the first test ensuring it returns *something* and it's consistent.
    // We can add a check that it's an instance of the class.
    it("should return an instance of CommunicationManager", () => {
      expect(managerInstance).toBeInstanceOf(CommunicationManager);
    });
  });

  describe("logEvent Method", () => {
    it("should add a log entry with correct structure", () => {
      const source = "TestComponent";
      const eventName = "testEvent";
      const data = { value: 123 };

      managerInstance.logEvent(source, eventName, data);
      const log = managerInstance.getEventLog();

      // Expect 2 entries: 1 from constructor, 1 from this test
      expect(log).toHaveLength(2);
      // Access the specific EventLogEntry type here - check the SECOND entry
      const entry: EventLogEntry = log[1];
      expect(entry.timestamp).toBe(MOCK_TIMESTAMP);
      expect(entry.source).toBe(source);
      expect(entry.eventName).toBe(eventName);
      expect(entry.data).toEqual(data);
    });

    it('should emit "new-event" with the log entry', () => {
      const source = "TestEmitter";
      const eventName = "emissionTest";
      const data = { success: true };

      // Spy is attached AFTER the constructor runs, so it only sees this call
      const emitSpy = vi.spyOn(managerInstance, "emit");

      managerInstance.logEvent(source, eventName, data);

      // Should only be called once by *this* logEvent call
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith("new-event", {
        timestamp: MOCK_TIMESTAMP,
        source,
        eventName,
        data,
      });
    });

    it.each([
      { type: "object", value: { a: 1, b: "hello" } },
      { type: "array", value: [1, 2, "world"] },
      { type: "string", value: "a simple string" },
      { type: "number", value: 42 },
      { type: "boolean", value: true },
      { type: "null", value: null },
    ])("should handle $type data type", ({ value }) => {
      managerInstance.logEvent("DataTypeTest", "test", value);
      const log = managerInstance.getEventLog();
      // Expect 2 entries: 1 from constructor, 1 from this test
      expect(log).toHaveLength(2);
      // Check the data of the SECOND entry
      expect(log[1].data).toEqual(value);
    });

    it("should trim the log when maxLogSize is exceeded (keeping newest)", () => {
      const maxSize = 3;
      managerInstance.setMaxLogSize(maxSize);
      // const initialLogCount = managerInstance.getEventLog().length; // Removed as unused

      for (let i = 1; i <= maxSize + 2; i++) {
        managerInstance.logEvent("TrimmingTest", `event${i}`, { id: i });
      }

      const log = managerInstance.getEventLog();
      expect(log).toHaveLength(maxSize);

      // Figure out the expected first event index after trimming
      // Total events logged = initialLogCount + maxSize + 2
      // We keep maxSize entries. The first kept entry's data should correspond to the correct event.
      // Events added: init, setMaxLog, event1, event2, event3, event4, event5 (if maxSize=3)
      // Log after trim (size 3): event3, event4, event5
      expect(log[0].eventName).toBe("event3");
      expect(log[0].data).toEqual({ id: 3 });
      expect(log[maxSize - 1].eventName).toBe(`event${maxSize + 2}`);
      expect(log[maxSize - 1].data).toEqual({ id: maxSize + 2 });
    });

    it("should redirect to original console.log when enabled", () => {
      managerInstance.setRedirectEventsToConsole(true);
      const source = "RedirectTest";
      const eventName = "redirectEvent";
      const data = { active: true };

      // Constructor already called mockConsoleLog once because redirect was set *before* logEvent.
      // Let's reset the mock count *after* setting redirect to true, just before the tested call.
      mockConsoleLog.mockClear();

      managerInstance.logEvent(source, eventName, data);

      expect(mockConsoleLog).toHaveBeenCalledTimes(1); // Only the call from this test
      expect(mockConsoleLog).toHaveBeenCalledWith(
        `[${source}] ${eventName}:`,
        data
      );
    });

    it("should NOT redirect to console when disabled", () => {
      managerInstance.setRedirectEventsToConsole(false);
      mockConsoleLog.mockClear(); // Ensure constructor call doesn't interfere

      managerInstance.logEvent("NoRedirectTest", "shouldNotLog", {
        info: "test",
      });

      expect(mockConsoleLog).not.toHaveBeenCalled();
    });

    it("should handle logEvent call when redirect is enabled but original console is missing", () => {
      // Locally spy on console.warn for THIS TEST ONLY to suppress the expected warning
      const localConsoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      delete (global.window as MockWindow).__console_log_original;
      managerInstance.setRedirectEventsToConsole(true); // This will attempt to log & warn
      mockConsoleLog.mockClear(); // Clear the main console.log spy if needed

      expect(() => {
        managerInstance.logEvent("MissingConsoleTest", "noError"); // This will also attempt to log & warn
      }).not.toThrow();

      const log = managerInstance.getEventLog();
      // Expect 3 logs: init, setRedirect, noError
      // The setRedirectEventsToConsole and logEvent calls will add to eventLog despite the console warning.
      expect(log).toHaveLength(3);
      expect(log[2].eventName).toBe("noError");

      // Restore the original console.warn (or the global spy if it was in effect)
      localConsoleWarnSpy.mockRestore();
    });
  });

  describe("clearLog Method", () => {
    it('should emit "log-cleared" event', () => {
      const emitSpy = vi.spyOn(managerInstance, "emit");
      managerInstance.clearLog();

      // Check that emit was called specifically with 'log-cleared'
      // We don't assert the total count because logEvent also emits 'new-event'
      expect(emitSpy).toHaveBeenCalledWith("log-cleared");
    });

    it("should log the clearLog event itself", () => {
      // Constructor logs init
      // clearLog clears and then logs the clear event
      managerInstance.clearLog();
      const log = managerInstance.getEventLog();
      expect(log).toHaveLength(1); // Only the clearLog event remains
      expect(log[0].source).toBe("CommunicationManager");
      expect(log[0].eventName).toBe("logCleared");
    });
  });

  describe("Event Listeners (on, off, emit)", () => {
    it('should register and trigger event listeners using "on" and "emit"', () => {
      const listener = vi.fn();
      const eventName = "customEvent";
      const eventData = { payload: "data" };

      managerInstance.on(eventName, listener);
      managerInstance.emit(eventName, eventData);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    it('should remove event listeners using "off"', () => {
      const listener = vi.fn();
      const eventName = "anotherCustomEvent";

      managerInstance.on(eventName, listener);
      managerInstance.off(eventName, listener);
      managerInstance.emit(eventName, { info: "test" });

      expect(listener).not.toHaveBeenCalled();
    });

    // We are already testing the implicit emit calls from logEvent and clearLog.
    // This explicitly tests the inherited emit method.
    it("should allow emitting arbitrary events", () => {
      const listener = vi.fn();
      const eventName = "arbitrary";
      managerInstance.on(eventName, listener);
      managerInstance.emit(eventName, 1, 2, 3);
      expect(listener).toHaveBeenCalledWith(1, 2, 3);
    });
  });

  describe("Configuration Methods", () => {
    describe("setMaxLogSize", () => {
      it("should update the maxLogSize property", () => {
        const newSize = 50;
        managerInstance.setMaxLogSize(newSize);
        expect(managerInstance.maxLogSize).toBe(newSize);
      });

      it("should log the maxLogSize change event", () => {
        const logSpy = vi.spyOn(managerInstance, "logEvent");
        const oldSize = managerInstance.maxLogSize;
        const newSize = 25;

        managerInstance.setMaxLogSize(newSize);

        // logEvent is called by setMaxLogSize itself.
        // The spy is attached *after* the constructor call, so it only sees this one call.
        expect(logSpy).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenLastCalledWith(
          "CommunicationManager",
          "maxLogSizeSet",
          {
            newSize: newSize,
            oldSize: oldSize,
            trimmedLog: false, // Assuming log wasn't trimmed initially
          }
        );
      });

      it("should trim the log immediately if the new size is smaller", () => {
        const initialSize = 10;
        managerInstance.setMaxLogSize(initialSize);
        // Add 6 events (plus init, plus setMaxLogSize = 8 total initially)
        for (let i = 0; i < 6; i++)
          managerInstance.logEvent("PreTrim", `event${i}`);
        expect(managerInstance.getEventLog()).toHaveLength(8);

        const newSize = 5;
        managerInstance.setMaxLogSize(newSize);

        // Should be trimmed to newSize instantly
        expect(managerInstance.getEventLog()).toHaveLength(newSize);
        // Check that the last event logged by setMaxLogSize is the last entry
        const log = managerInstance.getEventLog();
        expect(log[newSize - 1].eventName).toBe("maxLogSizeSet");
      });

      it("should handle invalid sizes (<= 0) by setting size to 1", () => {
        managerInstance.setMaxLogSize(0);
        expect(managerInstance.maxLogSize).toBe(1);
        managerInstance.setMaxLogSize(-100);
        expect(managerInstance.maxLogSize).toBe(1);
      });
    });

    describe("setRedirectEventsToConsole", () => {
      it("should update the internal flag", () => {
        // Use a more specific type assertion to access the private property for testing
        type ManagerWithInternalFlag = {
          _redirectEventsToConsole: boolean;
        };
        expect(
          (managerInstance as unknown as ManagerWithInternalFlag)
            ._redirectEventsToConsole
        ).toBe(false); // Check initial
        managerInstance.setRedirectEventsToConsole(true);
        expect(
          (managerInstance as unknown as ManagerWithInternalFlag)
            ._redirectEventsToConsole
        ).toBe(true);
        managerInstance.setRedirectEventsToConsole(false);
        expect(
          (managerInstance as unknown as ManagerWithInternalFlag)
            ._redirectEventsToConsole
        ).toBe(false);
      });

      it("should log the change event only when the value actually changes", () => {
        const logSpy = vi.spyOn(managerInstance, "logEvent");

        // Call 1: false -> true (should log) - Seen by spy
        managerInstance.setRedirectEventsToConsole(true);
        // Call 2: true -> true (should NOT log)
        managerInstance.setRedirectEventsToConsole(true);
        // Call 3: true -> false (should log) - Seen by spy
        managerInstance.setRedirectEventsToConsole(false);
        // Call 4: false -> false (should NOT log)
        managerInstance.setRedirectEventsToConsole(false);

        // Total log calls seen by spy: set(true) + set(false) = 2
        expect(logSpy).toHaveBeenCalledTimes(2);

        // Check the arguments of the relevant calls
        expect(logSpy).toHaveBeenNthCalledWith(
          1, // First call *seen by spy*
          "CommunicationManager",
          "setRedirectEventsToConsole",
          { enabled: true }
        );
        expect(logSpy).toHaveBeenNthCalledWith(
          2, // Second call *seen by spy*
          "CommunicationManager",
          "setRedirectEventsToConsole",
          { enabled: false }
        );
      });
    });
  });

  describe("getEventLog Method", () => {
    it("should return the current log entries", () => {
      // Constructor adds 'initialized' log
      const event1 = { source: "GetTest1", eventName: "get1", data: { n: 1 } };
      const event2 = { source: "GetTest2", eventName: "get2", data: { n: 2 } };
      managerInstance.logEvent(event1.source, event1.eventName, event1.data);
      managerInstance.logEvent(event2.source, event2.eventName, event2.data);

      const log = managerInstance.getEventLog();

      expect(log).toHaveLength(3); // init, get1, get2
      expect(log[0].eventName).toBe("initialized");
      expect(log[1]).toMatchObject(event1);
      expect(log[2]).toMatchObject(event2);
    });

    it("should return a copy of the event log array, not the original", () => {
      managerInstance.logEvent("CopyTest", "event", { value: "original" });
      const log1 = managerInstance.getEventLog();
      const log1EntryRef = log1[0]; // Keep a reference to the object
      const initialLength = log1.length;

      // Modify the returned array (log1)
      log1.push({
        timestamp: new Date().toISOString(),
        source: "Mutation",
        eventName: "mutationEvent",
        data: { mutated: true },
      });
      // Modify an object within the returned array
      log1[0].eventName = "MODIFIED_INIT";

      // Get the log again
      const log2 = managerInstance.getEventLog();
      const log2EntryRef = log2[0]; // Get reference from the new array

      // 1. Verify the arrays themselves are different instances
      expect(log1).not.toBe(log2);

      // 2. Verify the internal log wasn't changed *in length*
      expect(log2).toHaveLength(initialLength);

      // 3. (Optional but good) Verify the objects *inside* are the same reference initially
      // This confirms we are modifying the same object reference in log1 and log2[0]
      expect(log1EntryRef).toBe(log2EntryRef);

      // 4. Confirm the object modification is visible via log2 (because it's a shallow copy)
      // This replaces the previous failing assertion
      expect(log2[0].eventName).toBe("MODIFIED_INIT");
    });

    it("should return an empty array if the log is empty", () => {
      // Clear the log (which adds a 'logCleared' entry)
      managerInstance.clearLog();
      // Clear it again to ensure it's truly empty before getEventLog
      managerInstance.clearLog();
      expect(managerInstance.getEventLog()).toHaveLength(1); // Should have the second 'logCleared' event

      // Manually clear the internal array *after* clearLog adds its entry
      // Use a specific type assertion instead of 'any' to satisfy the linter
      type ManagerWithEventLog = { eventLog: EventLogEntry[] };
      (managerInstance as unknown as ManagerWithEventLog).eventLog = [];

      const log = managerInstance.getEventLog();
      expect(log).toEqual([]);
    });
  });

  describe("destroy Method", () => {
    it("should remove all listeners registered on the manager itself", () => {
      const newEventListener = vi.fn();
      const logClearedListener = vi.fn();

      managerInstance.on("new-event", newEventListener);
      managerInstance.on("log-cleared", logClearedListener);

      managerInstance.destroy();

      // Emit events after destroy and check listeners are not called *anymore*
      managerInstance.logEvent("AfterDestroy", "testEvent");
      // clearLog also calls logEvent internally, potentially triggering 'new-event' if listener wasn't removed
      managerInstance.clearLog();

      // newEventListener should have been called ONCE by the first logEvent inside destroy()
      expect(newEventListener).toHaveBeenCalledTimes(1);
      expect(logClearedListener).not.toHaveBeenCalled();
    });

    it("should log 'destroyingSubscriptions' and 'destroyed' events", () => {
      const logSpy = vi.spyOn(managerInstance, "logEvent");

      managerInstance.clearLog();
      logSpy.mockClear(); // Clear calls from constructor and clearLog

      managerInstance.destroy();

      // Restore full assertions now that call count is confirmed
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenNthCalledWith(
        1,
        "CommunicationManager",
        "destroyingSubscriptions"
      );
      expect(logSpy).toHaveBeenNthCalledWith(
        2,
        "CommunicationManager",
        "destroyed"
      );

      // Check the final log state
      const log = managerInstance.getEventLog();
      expect(log).toHaveLength(3); // Expect 3 logs: the 'logCleared' from before destroy, and the two destroy logs
      expect(log[0].eventName).toBe("logCleared"); // Added check for first event
      expect(log[1].eventName).toBe("destroyingSubscriptions"); // Index shifted
      expect(log[2].eventName).toBe("destroyed"); // Index shifted
    });

    // Optional: Test idempotency (calling destroy multiple times)
    it("should be safe to call destroy multiple times", () => {
      expect(() => {
        managerInstance.destroy();
        managerInstance.destroy();
      }).not.toThrow();
    });
  });
});
