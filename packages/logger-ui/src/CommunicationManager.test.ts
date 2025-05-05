import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { EventLogEntry } from "./types"; // Assuming types.ts is in the same directory

// Mock Phaser's EventEmitter using a mock class
class MockPhaserEventEmitter {
  on = vi.fn();
  off = vi.fn();
  emit = vi.fn();
  destroy = vi.fn();
  listenerCount = vi.fn().mockReturnValue(0);
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
      delete (global.window as MockWindow).__console_log_original;
      managerInstance.setRedirectEventsToConsole(true);
      mockConsoleLog.mockClear(); // Clear constructor log

      expect(() => {
        managerInstance.logEvent("MissingConsoleTest", "noError");
      }).not.toThrow();

      const log = managerInstance.getEventLog();
      // Expect 3 logs: init, setRedirect, noError
      expect(log).toHaveLength(3);
      expect(log[2].eventName).toBe("noError"); // Check the third entry
    });
  });

  describe("clearLog Method", () => {
    it("should clear the event log", () => {
      // Add some events first (plus the constructor one)
      managerInstance.logEvent("Test1", "event1");
      managerInstance.logEvent("Test2", "event2");
      expect(managerInstance.getEventLog()).toHaveLength(3); // init, event1, event2

      managerInstance.clearLog();

      expect(managerInstance.getEventLog()).toHaveLength(0);
    });

    it('should emit "log-cleared" event', () => {
      // Spy on the emit method *of the instance*
      const emitSpy = vi.spyOn(managerInstance, "emit");

      managerInstance.clearLog();

      // Constructor logs "initialized", clearLog logs "logCleared"
      // So emit is called twice in total before spy is attached.
      // We expect emitSpy to be called ONCE by the clearLog action itself.
      expect(emitSpy).toHaveBeenCalledTimes(1);
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

  // --- More tests will be added below ---
});
