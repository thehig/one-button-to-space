import React, { PropsWithChildren } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import {
  CommunicationProvider,
  useCommunicationContext,
} from "./CommunicationContext";
import { vi, Mock } from "vitest";
import { EventLogEntry } from "../../types";
import { CommunicationManager } from "../../CommunicationManager"; // Import the real one for mocking path

// Define the listener callback type at the top level
// Use Function type to match the expected signature from spyOn errors
type ListenerCallback = (...args: unknown[]) => void; // More specific type

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

// --- Mock CommunicationManager ---
vi.mock("../../CommunicationManager", () => {
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

// Get the mocked manager instance for test manipulation
// Cast to the internal type to access _listeners and _trigger safely
const mockManagerInstance = CommunicationManager.getInstance() as ReturnType<
  (typeof CommunicationManager)["getInstance"]
> & {
  _trigger: (event: string, ...args: unknown[]) => void;
  _listeners: Record<string, Array<ListenerCallback>>;
};

// Helper to render with the real provider
const renderWithProvider = (
  ui: React.ReactElement,
  providerProps: PropsWithChildren<{
    maxLogSize?: number;
    redirectEventsToConsole?: boolean;
  }> = {}
) => {
  return render(
    <CommunicationProvider {...providerProps}>{ui}</CommunicationProvider>
  );
};

// Dummy component to test context consumption
const TestConsumerComponent = () => {
  const { events, clearLog, logEvent } = useCommunicationContext();
  return (
    <div>
      <span data-testid="event-count">{events.length}</span>
      <button onClick={clearLog}>Clear</button>
      <button onClick={() => logEvent("Test", "Event")}>Log</button>
    </div>
  );
};

// Component designed to throw error if context is missing
const ErrorConsumerComponent = () => {
  let error = null;
  try {
    useCommunicationContext();
  } catch (e) {
    error = e;
  }
  return error ? (
    <div data-testid="error-message">{(error as Error).message}</div>
  ) : null;
};

// --- Test Suite ---
describe.sequential("CommunicationContext", () => {
  // Reset the mock manager's methods before each test
  beforeEach(() => {
    vi.clearAllMocks(); // Clears call history and resets implementations
    // Reset internal listener store for the mock directly
    for (const key in mockManagerInstance._listeners) {
      delete mockManagerInstance._listeners[key];
    }

    // Set default return value for getEventLog
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue([]);
    // Ensure other methods are spies if needed (clearAllMocks resets implementations)
    vi.spyOn(mockManagerInstance, "clearLog"); // Just spy to track calls
    vi.spyOn(mockManagerInstance, "logEvent"); // Just spy to track calls
    vi.spyOn(mockManagerInstance, "setMaxLogSize"); // Just spy to track calls
    vi.spyOn(mockManagerInstance, "setRedirectEventsToConsole"); // Just spy to track calls

    // REMOVED spyOn for on/off with mockImplementation
    /*
    vi.spyOn(mockManagerInstance, "on").mockImplementation(
      ((event: string | symbol, callback: ListenerCallback) => {
        const listeners = mockManagerInstance._listeners;
        const eventKey = String(event);
        if (!listeners[eventKey]) listeners[eventKey] = [];
        listeners[eventKey].push(callback as ListenerCallback);
        return mockManagerInstance;
      }) as any // Assert implementation compatibility
    );
    vi.spyOn(mockManagerInstance, "off").mockImplementation(
      ((event: string | symbol, callback?: ListenerCallback) => {
        const listeners = mockManagerInstance._listeners;
        const eventKey = String(event);
        if (listeners[eventKey]) {
          listeners[eventKey] = listeners[eventKey].filter(
            (cb: ListenerCallback) => cb !== callback
          );
        }
        return mockManagerInstance;
      }) as any // Assert implementation compatibility
    );
    */
  });

  it("should render children within the provider", () => {
    renderWithProvider(<div>Test Child</div>);
    expect(screen.getByText("Test Child")).toBeInTheDocument();
  });

  it("should provide default context values when rendered", () => {
    renderWithProvider(<TestConsumerComponent />);

    // Check initial event count
    expect(screen.getByTestId("event-count")).toHaveTextContent("0");

    // Check functions are defined (implicitly tested by rendering TestConsumerComponent without error)
    // We can also check if the manager's methods were called *initially* if expected
    // Based on CommunicationContext, getEventLog IS called initially in useEffect
    // It's called twice: once for maxLogSize effect, once for main event effect
    expect(mockManagerInstance.getEventLog).toHaveBeenCalledTimes(2);
    // setMaxLogSize and setRedirectEventsToConsole are also called with defaults
    expect(mockManagerInstance.setMaxLogSize).toHaveBeenCalledWith(100); // Default value
    expect(mockManagerInstance.setRedirectEventsToConsole).toHaveBeenCalledWith(
      false
    ); // Default value

    // Check that 'on' was called to subscribe to events
    expect(mockManagerInstance.on).toHaveBeenCalledWith(
      "new-event",
      expect.any(Function)
    );
    expect(mockManagerInstance.on).toHaveBeenCalledWith(
      "log-cleared",
      expect.any(Function)
    );
  });

  it("should throw an error when useCommunicationContext is used outside a provider", () => {
    // Render the component that tries to consume context *without* the provider
    render(<ErrorConsumerComponent />);

    // Check that the specific error message is rendered
    expect(screen.getByTestId("error-message")).toHaveTextContent(
      "useCommunicationContext must be used within a CommunicationProvider"
    );
  });

  // --- Test Provider Props ---

  it("should call setMaxLogSize on the manager when maxLogSize prop is provided", () => {
    const testMaxLogSize = 50;
    renderWithProvider(<TestConsumerComponent />, {
      maxLogSize: testMaxLogSize,
    });

    // Check initial call during mount effect
    expect(mockManagerInstance.setMaxLogSize).toHaveBeenCalledWith(
      testMaxLogSize
    );
  });

  it("should call setMaxLogSize again when maxLogSize prop changes", () => {
    const initialSize = 50;
    const { rerender } = renderWithProvider(<TestConsumerComponent />, {
      maxLogSize: initialSize,
    });
    expect(mockManagerInstance.setMaxLogSize).toHaveBeenCalledTimes(1); // Initial call
    expect(mockManagerInstance.setMaxLogSize).toHaveBeenCalledWith(initialSize);

    const newSize = 25;
    act(() => {
      rerender(
        <CommunicationProvider maxLogSize={newSize}>
          <TestConsumerComponent />
        </CommunicationProvider>
      );
    });

    // Check call after rerender with new prop
    expect(mockManagerInstance.setMaxLogSize).toHaveBeenCalledTimes(2); // Called again
    expect(mockManagerInstance.setMaxLogSize).toHaveBeenCalledWith(newSize);
  });

  it("should call setRedirectEventsToConsole on the manager when redirectEventsToConsole prop is provided", () => {
    renderWithProvider(<TestConsumerComponent />, {
      redirectEventsToConsole: true,
    });
    // Check initial call during mount effect
    expect(mockManagerInstance.setRedirectEventsToConsole).toHaveBeenCalledWith(
      true
    );

    // Check default case (implicitly tested in default context value test, but good to be explicit)
    vi.clearAllMocks(); // Clear mocks before rendering again
    vi.spyOn(
      mockManagerInstance,
      "setRedirectEventsToConsole"
    ).mockImplementation(() => {}); // Re-spy after clear
    renderWithProvider(<TestConsumerComponent />);
    expect(mockManagerInstance.setRedirectEventsToConsole).toHaveBeenCalledWith(
      false
    ); // Default
  });

  it("should call setRedirectEventsToConsole again when redirectEventsToConsole prop changes", () => {
    const { rerender } = renderWithProvider(<TestConsumerComponent />, {
      redirectEventsToConsole: true,
    });
    expect(
      mockManagerInstance.setRedirectEventsToConsole
    ).toHaveBeenCalledTimes(1);
    expect(mockManagerInstance.setRedirectEventsToConsole).toHaveBeenCalledWith(
      true
    );

    act(() => {
      rerender(
        <CommunicationProvider redirectEventsToConsole={false}>
          <TestConsumerComponent />
        </CommunicationProvider>
      );
    });

    expect(
      mockManagerInstance.setRedirectEventsToConsole
    ).toHaveBeenCalledTimes(2);
    expect(mockManagerInstance.setRedirectEventsToConsole).toHaveBeenCalledWith(
      false
    );
  });

  // --- Test Event Handling ---

  it("should update context events when the manager emits 'new-event'", () => {
    // Render first to ensure effects run
    renderWithProvider(<TestConsumerComponent />);

    // Remove unused variable
    // const initialEvents: EventLogEntry[] = [];
    expect(screen.getByTestId("event-count")).toHaveTextContent("0"); // Initial state

    const newEvent: EventLogEntry = {
      timestamp: new Date().toISOString(),
      source: "ManagerSim",
      eventName: "SimulatedEvent",
      data: { detail: "abc" },
    };

    // Reset the spy and set up the specific mock sequence for this test
    // AFTER the initial render calls have happened.
    vi.spyOn(mockManagerInstance, "getEventLog")
      .mockClear() // Clear any calls from initial render
      .mockReturnValueOnce([newEvent]); // Expect one call from the handler

    // Simulate the manager emitting the event
    act(() => {
      // Access _trigger directly now
      mockManagerInstance._trigger("new-event", newEvent);
    });

    // Check that getEventLog was called again by the handler
    // We cleared calls from render, so expect only 1 call here
    expect(mockManagerInstance.getEventLog).toHaveBeenCalledTimes(1);

    // Check that the state updated in the consumer
    expect(screen.getByTestId("event-count")).toHaveTextContent("1");
  });

  // --- Test Clearing Logic ---

  it("should call manager clearLog when clearLog from context is invoked", () => {
    renderWithProvider(<TestConsumerComponent />);
    const clearButton = screen.getByRole("button", { name: /clear/i });

    act(() => {
      fireEvent.click(clearButton);
    });

    expect(mockManagerInstance.clearLog).toHaveBeenCalledTimes(1);
  });

  it("should clear context events when the manager emits 'log-cleared'", () => {
    // Setup: Start with an event
    const initialEvent: EventLogEntry = {
      timestamp: "t1",
      source: "S1",
      eventName: "E1",
    };
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue([
      initialEvent,
    ]);

    renderWithProvider(<TestConsumerComponent />);
    expect(screen.getByTestId("event-count")).toHaveTextContent("1"); // Starts with 1 event

    // Simulate the manager emitting log-cleared
    act(() => {
      // Access _trigger directly now
      mockManagerInstance._trigger("log-cleared");
    });

    // Check that the state updated in the consumer
    expect(screen.getByTestId("event-count")).toHaveTextContent("0");
  });

  // --- Test Cleanup ---
  it("should unregister event listeners on unmount", () => {
    const { unmount } = renderWithProvider(<TestConsumerComponent />);

    // Check that 'on' was called initially
    expect(mockManagerInstance.on).toHaveBeenCalledWith(
      "new-event",
      expect.any(Function)
    );
    expect(mockManagerInstance.on).toHaveBeenCalledWith(
      "log-cleared",
      expect.any(Function)
    );

    // Store the listeners that were registered
    const listeners = mockManagerInstance._listeners;
    const newEventListener = listeners["new-event"][0];
    const clearListener = listeners["log-cleared"][0];

    unmount();

    // Check that 'off' was called with the correct listeners
    expect(mockManagerInstance.off).toHaveBeenCalledWith(
      "new-event",
      newEventListener
    );
    expect(mockManagerInstance.off).toHaveBeenCalledWith(
      "log-cleared",
      clearListener
    );
  });

  // Add more tests here...
});
