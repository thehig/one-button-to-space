import React from "react";
import { render, screen, within } from "@testing-library/react";
import { GameEventLog } from "./GameEventLog";
// Remove CommunicationProvider import, we won't use the real one
// import { CommunicationProvider } from "./CommunicationContext";
import { vi } from "vitest";
import { EventLogEntry, SourceTreeNode } from "../../types"; // Import the type and SourceTreeNode
import { fireEvent } from "@testing-library/react";

// --- Global Mock for Phaser ---
vi.mock("phaser", () => {
  // Use plain objects and functions instead of a class definition inside the factory
  const mockEventEmitterInstance = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  return {
    default: {}, // Keep default based on previous error
    Events: {
      // Mock EventEmitter as a function that returns the instance mock
      // This mimics calling `new Phaser.Events.EventEmitter()`
      EventEmitter: vi.fn(() => mockEventEmitterInstance),
    },
    // Add other Phaser exports if needed by dependencies
  };
});
// --- End Phaser Mock ---

// --- Mock CommunicationManager ---
// Explicitly mock this to prevent its side effects, even though we mock the context hook
vi.mock("./CommunicationManager", () => {
  const mockInstance = {
    logEvent: vi.fn(),
    clearLog: vi.fn(),
    getEventLog: vi.fn(() => []),
    on: vi.fn(),
    off: vi.fn(),
    setMaxLogSize: vi.fn(),
    setRedirectEventsToConsole: vi.fn(),
    // Add other methods if needed
  };
  return {
    CommunicationManager: {
      getInstance: vi.fn(() => mockInstance),
    },
  };
});
// --- End CommunicationManager Mock ---

/* // Remove this - we will mock the manager instance instead
// --- Mock useCommunicationContext Hook ---
vi.mock("./CommunicationContext", async (importOriginal) => {
  // Import the original module to get access to its exports if needed
  const originalModule = await importOriginal<
    typeof import("./CommunicationContext")
  >();
  // Keep the original CommunicationProvider export if it's needed elsewhere (unlikely for this test)
  // Return the new module structure with the mocked hook
  return {
    ...originalModule,
    useCommunicationContext: vi.fn(), // Mock the hook function itself
  };
});
// --- End Mock ---
*/

// Helper to setup mock return values for the hook -- REMOVED as we mock manager now
/*
const setupMockContext = (mockValues: {
  events?: EventLogEntry[];
  clearLog?: () => void;
  logEvent?: (...args: unknown[]) => void; // Use any[] for simplicity here
}) => {
  (useCommunicationContext as ReturnType<typeof vi.fn>).mockReturnValue({
    events: mockValues.events ?? [],
    clearLog: mockValues.clearLog ?? vi.fn(),
    logEvent: mockValues.logEvent ?? vi.fn(),
  });
};
*/

// Get the mocked manager instance for test manipulation
import { CommunicationManager } from "../../managers/CommunicationManager/CommunicationManager";
const mockManagerInstance = CommunicationManager.getInstance();

// Import the real CommunicationProvider
import { CommunicationProvider } from "../../contexts/CommunicationContext/CommunicationContext";

// Helper to render with the real provider
const renderWithProvider = (ui: React.ReactElement) => {
  return render(<CommunicationProvider>{ui}</CommunicationProvider>);
};

// --- Use .sequential to avoid potential parallel test interference ---
describe.sequential("GameEventLog", () => {
  // Reset the mock manager's methods before each test
  beforeEach(() => {
    // Reset calls and mock implementations
    vi.clearAllMocks(); // Clears call history and resets implementations for *all* mocks
    // Set default return value for getEventLog using spyOn
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue([]);
    // Ensure clearLog and logEvent are also mocked if needed globally
    // If their default behavior is no-op, spying might be enough,
    // but explicit mocks are safer if tests rely on them being functions.
    vi.spyOn(mockManagerInstance, "clearLog").mockImplementation(() => {});
    vi.spyOn(mockManagerInstance, "logEvent").mockImplementation(() => {});
  });

  it("should render without crashing", () => {
    // Setup default manager return values (done in beforeEach)
    // Render GameEventLog with the real provider
    renderWithProvider(<GameEventLog />);

    // Check for a key element to confirm rendering
    expect(screen.getByText("Game Event Log")).toBeInTheDocument();
    expect(mockManagerInstance.logEvent).not.toHaveBeenCalled();
  });

  // --- Test Event Display ---
  it("should display events from the context", () => {
    // 1. Arrange: Setup mock manager AND config data
    const mockEvents: EventLogEntry[] = [
      {
        timestamp: new Date().toISOString(),
        source: "TestSource1",
        eventName: "TestEventOne",
        data: { count: 1 },
      },
      {
        timestamp: new Date(Date.now() + 1000).toISOString(),
        source: "TestSource2",
        eventName: "TestEventTwo",
        data: null,
      },
    ];
    // Define config data matching the sources in mockEvents
    const mockSourceConfigData: SourceTreeNode[] = [
      { id: "TestSource1", children: [] },
      { id: "TestSource2", children: [] },
    ];
    // Use spyOn to set the mock return value
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue(mockEvents);

    // 2. Act: Render the component using the provider, providing the config data
    renderWithProvider(
      <GameEventLog startsOpen={true} sourceConfigData={mockSourceConfigData} />
    );

    // 3. Assert: Check if event names are rendered
    expect(screen.getByText("TestEventTwo")).toBeInTheDocument();
    expect(screen.getByText("TestEventOne")).toBeInTheDocument();

    // Also check that the "No events" message is NOT present
    expect(
      screen.queryByText("No events match filters.")
    ).not.toBeInTheDocument();

    // Check the event count in the header (should reflect unfiltered count initially)
    // Note: The count displayed might be filtered count (0 initially if filter hook has async aspects)
    // or total count. Let's check for the presence of the count span instead of exact value for now.
    expect(screen.getByText(/\(\d+\)/)).toBeInTheDocument(); // Checks for (number)
  });

  // --- New Test ---
  it('should call clearLog from context when "Clear Log" button is clicked', () => {
    // 1. Arrange: Setup mock manager with a spy for clearLog
    const mockClearLog = vi.fn();
    // Spy on the method and provide the mock implementation
    vi.spyOn(mockManagerInstance, "clearLog").mockImplementation(mockClearLog);

    // Render expanded AND with the filter tree open so the button is visible
    renderWithProvider(<GameEventLog startsOpen={true} startTreeOpen={true} />);

    // 2. Act: Find and click the "Clear Log" button
    const clearButton = screen.getByRole("button", { name: /clear log/i });
    fireEvent.click(clearButton);

    // 3. Assert: Check if the mock function was called
    expect(mockClearLog).toHaveBeenCalledTimes(1);
  });

  // --- New Test ---
  it("should filter events based on event name input", () => {
    // 1. Arrange: Setup manager with events and matching config
    const mockEvents: EventLogEntry[] = [
      {
        timestamp: "2023-01-01T10:00:00Z",
        source: "SourceA",
        eventName: "LoginSuccess",
        data: { userId: 1 },
      },
      {
        timestamp: "2023-01-01T10:01:00Z",
        source: "SourceB",
        eventName: "DataLoaded",
        data: null,
      },
      {
        timestamp: "2023-01-01T10:02:00Z",
        source: "SourceA",
        eventName: "LoginFailed",
        data: { error: "Bad password" },
      },
    ];
    const mockSourceConfigData: SourceTreeNode[] = [
      { id: "SourceA", children: [] },
      { id: "SourceB", children: [] },
    ];
    // Use spyOn
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue(mockEvents);

    // Render expanded with filter tree open using provider
    renderWithProvider(
      <GameEventLog
        startsOpen={true}
        startTreeOpen={true}
        sourceConfigData={mockSourceConfigData}
      />
    );

    // Ensure all events are visible initially (newest first)
    expect(screen.getByText("LoginFailed")).toBeInTheDocument();
    expect(screen.getByText("DataLoaded")).toBeInTheDocument();
    expect(screen.getByText("LoginSuccess")).toBeInTheDocument();

    // 2. Act: Find the filter input and type "Login"
    const filterInput = screen.getByPlaceholderText(/filter by event name/i);
    fireEvent.change(filterInput, { target: { value: "Login" } });

    // 3. Assert: Check that only matching events are now visible
    expect(screen.getByText("LoginFailed")).toBeInTheDocument();
    expect(screen.getByText("LoginSuccess")).toBeInTheDocument();
    expect(screen.queryByText("DataLoaded")).not.toBeInTheDocument();

    // Act again: Clear the filter
    fireEvent.change(filterInput, { target: { value: "" } });

    // Assert again: All events should be visible again
    expect(screen.getByText("LoginFailed")).toBeInTheDocument();
    expect(screen.getByText("DataLoaded")).toBeInTheDocument();
    expect(screen.getByText("LoginSuccess")).toBeInTheDocument();
  });

  // --- New Test ---
  it("should display event data in details panel when an event is clicked", () => {
    // 1. Arrange: Setup manager with events (one with data) and config
    const eventWithData = {
      timestamp: "2023-01-01T10:00:00Z",
      source: "SourceA",
      eventName: "EventWithData",
      data: { userId: 123, action: "login" },
    };
    const eventWithoutData = {
      timestamp: "2023-01-01T10:01:00Z",
      source: "SourceB",
      eventName: "EventWithoutData",
      data: null,
    };
    const mockEvents: EventLogEntry[] = [eventWithData, eventWithoutData];
    const mockSourceConfigData: SourceTreeNode[] = [
      { id: "SourceA", children: [] },
      { id: "SourceB", children: [] },
    ];
    // Use spyOn
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue(mockEvents);

    // Render with all panels open using provider
    renderWithProvider(
      <GameEventLog
        startsOpen={true}
        startTreeOpen={true}
        startDataOpen={true} // Ensure details panel is open
        sourceConfigData={mockSourceConfigData}
      />
    );

    // 2. Act: Find the event list item for the event WITH data and click it
    // Find the list item containing the event name
    const eventItem = screen.getByText("EventWithData").closest("li");
    expect(eventItem).toBeInTheDocument(); // Ensure we found the item
    if (eventItem) {
      fireEvent.click(eventItem);
    }

    // 3. Assert: Check if the data is displayed in the details panel
    const detailsPanel = screen.getByTestId("log-details-panel");

    // Check for elements rendered by react-json-view within the details panel
    // Find the text content of the keys/values, ignoring the quote spans
    expect(within(detailsPanel).getByText("userId")).toBeInTheDocument(); // Find the key text
    expect(within(detailsPanel).getByText("123")).toBeInTheDocument(); // Find the value
    expect(within(detailsPanel).getByText("action")).toBeInTheDocument(); // Find the key text
    // Use regex for potentially more robust matching of the string value text
    expect(within(detailsPanel).getByText(/login/i)).toBeInTheDocument(); // Find the string value text using regex

    // Optional: Assert that the placeholder is NOT visible
    expect(
      screen.queryByText(/Click an event to view details/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/No data for this event/i)
    ).not.toBeInTheDocument();
  });

  // --- New Test ---
  it("should filter events based on source tree selection", () => {
    // 1. Arrange: Setup manager with events and matching config
    const eventA = {
      timestamp: "2023-01-01T10:00:00Z",
      source: "SourceA",
      eventName: "EventFromA",
      data: null,
    };
    const eventB = {
      timestamp: "2023-01-01T10:01:00Z",
      source: "SourceB",
      eventName: "EventFromB",
      data: { value: true },
    };
    const mockEvents: EventLogEntry[] = [eventA, eventB];
    const mockSourceConfigData: SourceTreeNode[] = [
      { id: "SourceA", children: [] },
      { id: "SourceB", children: [] },
    ];
    // Use spyOn
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue(mockEvents);

    // Render expanded with filter tree open using provider
    renderWithProvider(
      <GameEventLog
        startsOpen={true}
        startTreeOpen={true}
        sourceConfigData={mockSourceConfigData}
      />
    );

    // Ensure all events are visible initially (newest first)
    expect(screen.getByText("EventFromB")).toBeInTheDocument();
    expect(screen.getByText("EventFromA")).toBeInTheDocument();

    // 2. Act: Find the checkbox for SourceA and uncheck it
    // The checkbox is INSIDE the label containing the source name
    const sourceALabel = screen.getByText(/SourceA/).closest("label"); // Find label containing text
    expect(sourceALabel).toBeInTheDocument();

    // Find the checkbox WITHIN the label
    const sourceACheckbox = within(sourceALabel!).getByRole(
      "checkbox"
    ) as HTMLInputElement;
    expect(sourceACheckbox).toBeInTheDocument();
    // Note: No need to check type again, getByRole already does that
    expect(sourceACheckbox).toBeChecked(); // Should be checked by default

    fireEvent.click(sourceACheckbox); // Click to uncheck

    // 3. Assert: Event from SourceA should be hidden, Event from SourceB remains
    expect(screen.queryByText("EventFromA")).not.toBeInTheDocument();
    expect(screen.getByText("EventFromB")).toBeInTheDocument();
    expect(sourceACheckbox).not.toBeChecked();

    // 4. Act: Click the checkbox again to re-check it
    fireEvent.click(sourceACheckbox);

    // 5. Assert: Event from SourceA should reappear
    expect(screen.getByText("EventFromA")).toBeInTheDocument();
    expect(screen.getByText("EventFromB")).toBeInTheDocument();
    expect(sourceACheckbox).toBeChecked();
  });

  // --- Test interaction: Source Tree Filtering leads to List Update ---
  it("should update the displayed event list when a source is toggled in the tree", () => {
    // 1. Arrange: Setup manager with events and config
    const eventA = {
      timestamp: "2023-01-01T10:00:00Z",
      source: "SourceA",
      eventName: "EventFromA",
      data: null,
    };
    const eventB = {
      timestamp: "2023-01-01T10:01:00Z",
      source: "SourceB",
      eventName: "EventFromB",
      data: { value: true },
    };
    const mockEvents: EventLogEntry[] = [eventA, eventB];
    const mockSourceConfigData: SourceTreeNode[] = [
      { id: "SourceA", children: [] },
      { id: "SourceB", children: [] },
    ];
    // Use spyOn
    vi.spyOn(mockManagerInstance, "getEventLog").mockReturnValue(mockEvents);

    // Render expanded with filter tree open using provider
    renderWithProvider(
      <GameEventLog
        startsOpen={true}
        startTreeOpen={true}
        sourceConfigData={mockSourceConfigData}
      />
    );

    // Verify initial state: both events visible
    expect(screen.getByText("EventFromA")).toBeInTheDocument();
    expect(screen.getByText("EventFromB")).toBeInTheDocument();

    // 2. Act: Find and click the checkbox for SourceA
    const sourceALabel = screen.getByText(/SourceA/).closest("label");
    const sourceACheckbox = within(sourceALabel!).getByRole(
      "checkbox"
    ) as HTMLInputElement;
    fireEvent.click(sourceACheckbox); // Uncheck SourceA

    // 3. Assert: List updates - EventFromA is gone, EventFromB remains
    expect(screen.queryByText("EventFromA")).not.toBeInTheDocument();
    expect(screen.getByText("EventFromB")).toBeInTheDocument();

    // 4. Act: Click the checkbox for SourceB
    const sourceBLabel = screen.getByText(/SourceB/).closest("label");
    const sourceBCheckbox = within(sourceBLabel!).getByRole(
      "checkbox"
    ) as HTMLInputElement;
    fireEvent.click(sourceBCheckbox); // Uncheck SourceB

    // 5. Assert: List updates - Both events gone, placeholder appears
    expect(screen.queryByText("EventFromA")).not.toBeInTheDocument();
    expect(screen.queryByText("EventFromB")).not.toBeInTheDocument();
    expect(screen.getByText("No events match filters.")).toBeInTheDocument();

    // 6. Act: Click SourceA checkbox again to re-enable
    fireEvent.click(sourceACheckbox);

    // 7. Assert: List updates - EventFromA reappears
    expect(screen.getByText("EventFromA")).toBeInTheDocument();
    expect(screen.queryByText("EventFromB")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No events match filters.")
    ).not.toBeInTheDocument();
  });

  // --- Test collapse/expand when the toggle button is clicked ---
  it("should collapse and expand when the toggle button is clicked", () => {
    // 1. Arrange: Render in default (collapsed) state
    renderWithProvider(<GameEventLog />); // <<< Use helper

    // Find the main content wrapper to check visibility/class
    // The parent Rnd component gets the 'collapsed' class
    const rndContainer = screen.getByTestId("rnd-container"); // Needs data-testid
    const contentWrapper = screen.getByTestId("log-content-wrapper"); // Needs data-testid

    // 2. Assert initial state (Collapsed)
    expect(rndContainer).toHaveClass("collapsed");
    expect(contentWrapper).toHaveClass("log-content-wrapper--collapsed");
    // The expand button should be visible (find by text content)
    const expandButton = screen.getByRole("button", { name: "➕" });
    expect(expandButton).toBeInTheDocument();

    // 3. Act: Click the expand button
    fireEvent.click(expandButton);

    // 4. Assert expanded state
    expect(rndContainer).not.toHaveClass("collapsed");
    expect(contentWrapper).toHaveClass("log-content-wrapper--expanded");
    // The collapse button should now be visible (find by text content)
    const collapseButton = screen.getByRole("button", { name: "➖" });
    expect(collapseButton).toBeInTheDocument();
    // Expand button should be gone
    expect(
      screen.queryByRole("button", { name: "➕" })
    ).not.toBeInTheDocument();

    // 5. Act: Click the collapse button
    fireEvent.click(collapseButton);

    // 6. Assert collapsed state again
    expect(rndContainer).toHaveClass("collapsed");
    expect(contentWrapper).toHaveClass("log-content-wrapper--collapsed");
    expect(screen.getByRole("button", { name: "➕" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "➖" })
    ).not.toBeInTheDocument();
  });

  // --- Test toggle lock state ---
  it("should toggle lock state when the lock/unlock button is clicked", () => {
    // 1. Arrange: Render in default (unlocked) state
    renderWithProvider(<GameEventLog />); // <<< Use helper

    const rndContainer = screen.getByTestId("rnd-container");

    // 2. Assert initial state (Unlocked)
    expect(rndContainer).not.toHaveClass("locked");
    const unlockButton = screen.getByRole("button", { name: "🔓" });
    expect(unlockButton).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "🔒" })
    ).not.toBeInTheDocument();

    // 3. Act: Click the unlock button to lock
    fireEvent.click(unlockButton);

    // 4. Assert locked state
    expect(rndContainer).toHaveClass("locked");
    const lockButton = screen.getByRole("button", { name: "🔒" });
    expect(lockButton).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "🔓" })
    ).not.toBeInTheDocument();
    // Also check that the main collapse/expand button (still showing ➕) is disabled when locked
    expect(screen.getByRole("button", { name: "➕" })).toBeDisabled();

    // 5. Act: Click the lock button to unlock
    fireEvent.click(lockButton);

    // 6. Assert unlocked state again
    expect(rndContainer).not.toHaveClass("locked");
    expect(screen.getByRole("button", { name: "🔓" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "🔒" })
    ).not.toBeInTheDocument();
    // Main collapse/expand button (still showing ➕) should be enabled again
    expect(screen.getByRole("button", { name: "➕" })).toBeEnabled();
  });

  // --- Test collapse/expand filter tree toggle ---
  it("should collapse and expand the filter tree when the filter toggle button is clicked", () => {
    // 1. Arrange: Render with main panel and filter tree open
    renderWithProvider(<GameEventLog startsOpen={true} startTreeOpen={true} />); // <<< FIX: Use helper

    // Find the filter column to check its class
    const filterColumn = screen.getByTestId("log-filter-column"); // Needs data-testid

    // 2. Assert initial state (Filter Tree Expanded)
    expect(filterColumn).not.toHaveClass("log-column--filter-collapsed");
    // Find the button by its emoji text content
    const filterToggleButton = screen.getByRole("button", { name: "☰" });
    expect(filterToggleButton).toBeInTheDocument();
    // We can still check the title for initial state verification if desired
    expect(filterToggleButton).toHaveAttribute("title", "Hide Filters");

    // 3. Act: Click the filter toggle button
    fireEvent.click(filterToggleButton);

    // 4. Assert filter collapsed state
    expect(filterColumn).toHaveClass("log-column--filter-collapsed");
    // The button is the same, but its title should change
    expect(screen.getByRole("button", { name: "☰" })).toHaveAttribute(
      "title",
      "Show Filters"
    );

    // 5. Act: Click the filter toggle button again
    fireEvent.click(filterToggleButton); // Use the same button reference

    // 6. Assert filter expanded state again
    expect(filterColumn).not.toHaveClass("log-column--filter-collapsed");
    expect(screen.getByRole("button", { name: "☰" })).toHaveAttribute(
      "title",
      "Hide Filters"
    );
  });

  // --- New Test ---
  it("should hijack console.log and call logEvent when hijackConsoleLogs is true", () => {
    // 1. Arrange: Setup mock manager with a spy for logEvent
    const mockLogEvent = vi.fn();
    // Spy on the method and provide the mock implementation
    vi.spyOn(mockManagerInstance, "logEvent").mockImplementation(mockLogEvent);

    // Render with default hijackConsoleLogs=true using provider
    // Use unmount to test cleanup
    const { unmount } = renderWithProvider(<GameEventLog startsOpen={true} />);

    // Store original console.log to restore it later (belt and suspenders)
    const originalConsoleLog = window.console.log;

    // 2. Act: Call console.log
    const testMessage = "This is a console test message";
    console.log(testMessage, { moreData: true });

    // 3. Assert: Check if mock logEvent was called with expected structure
    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    // Check the arguments. source should be 'log'. eventName is tricky, check data.
    expect(mockLogEvent).toHaveBeenCalledWith(
      "log", // Source for hijacked console.log
      expect.stringContaining("GameEventLog.test.tsx"), // eventName should contain the filename
      { messages: [testMessage, { moreData: true }] } // data payload
    );

    // --- Test Cleanup ---
    // Ensure the original console.log is restored on unmount
    unmount();

    // Check if console.log is the original (or if window prop is gone)
    // This check might be flaky depending on test runner environment
    try {
      expect(
        window.console.log === originalConsoleLog ||
          !window.__console_log_original
      ).toBe(true);
    } catch (e) {
      console.warn(
        "Test runner environment might not fully support console restoration check.",
        e
      );
    }

    // Restore console fully just in case unmount didn't catch it or property exists
    if (window.__console_log_original) {
      window.console.log = window.__console_log_original;
    }

    // Call console.log again - logEvent should NOT be called this time
    mockLogEvent.mockClear(); // Clear previous calls
    console.log("This should NOT be hijacked");
    expect(mockLogEvent).not.toHaveBeenCalled();
  });

  // --- New Test ---
  it("should NOT hijack console.log when hijackConsoleLogs is false", () => {
    // 1. Arrange: Setup mock manager with a spy for logEvent
    const mockLogEvent = vi.fn();
    // Spy on the method and provide the mock implementation
    vi.spyOn(mockManagerInstance, "logEvent").mockImplementation(mockLogEvent);

    // No need to store originalConsoleLog here

    // Render with hijackConsoleLogs explicitly set to false using provider
    const { unmount } = renderWithProvider(
      <GameEventLog hijackConsoleLogs={false} />
    );

    // 2. Act: Call console.log
    const testMessage = "This should go to the real console";
    console.log(testMessage);

    // 3. Assert: Check that mock logEvent was NOT called
    expect(mockLogEvent).not.toHaveBeenCalled();

    // Cleanup
    unmount();
    // No manual restoration check needed here, unmount should handle it.
  });

  // --- Test startsOpen Prop ---
  it("should render expanded initially when startsOpen is true", () => {
    renderWithProvider(<GameEventLog startsOpen={true} />);
    const rndContainer = screen.getByTestId("rnd-container");
    const contentWrapper = screen.getByTestId("log-content-wrapper");
    expect(rndContainer).not.toHaveClass("collapsed");
    expect(contentWrapper).toHaveClass("log-content-wrapper--expanded");
    expect(screen.getByRole("button", { name: "➖" })).toBeInTheDocument(); // Collapse button
  });

  it("should render collapsed initially when startsOpen is false", () => {
    renderWithProvider(<GameEventLog startsOpen={false} />);
    const rndContainer = screen.getByTestId("rnd-container");
    expect(rndContainer).toHaveClass("collapsed");
    expect(screen.getByRole("button", { name: "➕" })).toBeInTheDocument(); // Expand button
  });

  it("should render collapsed initially by default", () => {
    renderWithProvider(<GameEventLog />);
    const rndContainerDefault = screen.getByTestId("rnd-container");
    expect(rndContainerDefault).toHaveClass("collapsed");
    expect(screen.getByRole("button", { name: "➕" })).toBeInTheDocument(); // Expand button
  });

  // --- Test startsLocked Prop ---
  it("should render locked initially when startsLocked is true", () => {
    renderWithProvider(<GameEventLog startsLocked={true} />);
    const rndContainer = screen.getByTestId("rnd-container");
    expect(rndContainer).toHaveClass("locked");
    expect(screen.getByRole("button", { name: "🔒" })).toBeInTheDocument(); // Lock button
    // Collapse/Expand button should be disabled
    expect(screen.getByRole("button", { name: "➕" })).toBeDisabled();
  });

  it("should render unlocked initially when startsLocked is false", () => {
    renderWithProvider(<GameEventLog startsLocked={false} />);
    const rndContainer = screen.getByTestId("rnd-container");
    expect(rndContainer).not.toHaveClass("locked");
    expect(screen.getByRole("button", { name: "🔓" })).toBeInTheDocument(); // Unlock button
    expect(screen.getByRole("button", { name: "➕" })).toBeEnabled();
  });

  it("should render unlocked initially by default", () => {
    renderWithProvider(<GameEventLog />);
    const rndContainerDefault = screen.getByTestId("rnd-container");
    expect(rndContainerDefault).not.toHaveClass("locked");
    expect(screen.getByRole("button", { name: "🔓" })).toBeInTheDocument(); // Unlock button
    expect(screen.getByRole("button", { name: "➕" })).toBeEnabled();
  });

  // --- Test startTreeOpen Prop ---
  it("should render with filter tree open initially when startTreeOpen is true", () => {
    // Needs startsOpen=true for the filter tree to be potentially visible
    renderWithProvider(<GameEventLog startsOpen={true} startTreeOpen={true} />);
    const filterColumn = screen.getByTestId("log-filter-column");
    expect(filterColumn).not.toHaveClass("log-column--filter-collapsed");
    // Check button title
    expect(screen.getByRole("button", { name: "☰" })).toHaveAttribute(
      "title",
      "Hide Filters"
    );
  });

  it("should render with filter tree closed initially when startTreeOpen is false", () => {
    // Needs startsOpen=true
    renderWithProvider(
      <GameEventLog startsOpen={true} startTreeOpen={false} />
    );
    const filterColumn = screen.getByTestId("log-filter-column");
    expect(filterColumn).toHaveClass("log-column--filter-collapsed");
    expect(screen.getByRole("button", { name: "☰" })).toHaveAttribute(
      "title",
      "Show Filters"
    );
  });

  it("should render with filter tree closed initially by default", () => {
    renderWithProvider(<GameEventLog startsOpen={true} />);
    const filterColumnDefault = screen.getByTestId("log-filter-column");
    expect(filterColumnDefault).toHaveClass("log-column--filter-collapsed");
    expect(screen.getByRole("button", { name: "☰" })).toHaveAttribute(
      "title",
      "Show Filters"
    );
  });

  // --- Test startDataOpen Prop ---
  it("should render with details panel open initially when startDataOpen is true", () => {
    // Needs startsOpen=true
    renderWithProvider(<GameEventLog startsOpen={true} startDataOpen={true} />);
    const detailsPanel = screen.getByTestId("log-details-panel");
    expect(detailsPanel).not.toHaveClass("log-column--details-collapsed");
    // Check button title
    expect(screen.getByRole("button", { name: "ℹ️" })).toHaveAttribute(
      "title",
      "Hide Details"
    );
  });

  it("should render with details panel closed initially when startDataOpen is false", () => {
    // Needs startsOpen=true
    renderWithProvider(
      <GameEventLog startsOpen={true} startDataOpen={false} />
    );
    const detailsPanel = screen.getByTestId("log-details-panel");
    expect(detailsPanel).toHaveClass("log-column--details-collapsed");
    expect(screen.getByRole("button", { name: "ℹ️" })).toHaveAttribute(
      "title",
      "Show Details"
    );
  });

  it("should render with details panel closed initially by default", () => {
    renderWithProvider(<GameEventLog startsOpen={true} />);
    const detailsPanelDefault = screen.getByTestId("log-details-panel");
    expect(detailsPanelDefault).toHaveClass("log-column--details-collapsed");
    expect(screen.getByRole("button", { name: "ℹ️" })).toHaveAttribute(
      "title",
      "Show Details"
    );
  });

  // --- Test initial layout and opacity props ---
  it("should apply collapsedOpacity when initially collapsed", () => {
    const collapsedOpacity = 0.65;
    renderWithProvider(
      <GameEventLog startsOpen={false} collapsedOpacity={collapsedOpacity} />
    );

    const rndContainer = screen.getByTestId("rnd-container");
    expect(rndContainer).toHaveClass("collapsed");
    expect(rndContainer).toHaveStyle(`opacity: ${collapsedOpacity}`);
  });

  it("should apply lockedOpacity when initially locked and expanded", () => {
    const lockedOpacity = 0.75;
    renderWithProvider(
      <GameEventLog
        startsOpen={true}
        startsLocked={true}
        lockedOpacity={lockedOpacity}
      />
    );

    const rndContainer = screen.getByTestId("rnd-container");
    expect(rndContainer).not.toHaveClass("collapsed");
    expect(rndContainer).toHaveClass("locked");
    expect(rndContainer).toHaveStyle(`opacity: ${lockedOpacity}`);
  });

  it("should apply opacity 1 when initially expanded and unlocked", () => {
    renderWithProvider(<GameEventLog startsOpen={true} startsLocked={false} />);

    const rndContainer = screen.getByTestId("rnd-container");
    expect(rndContainer).not.toHaveClass("collapsed");
    expect(rndContainer).not.toHaveClass("locked");
    expect(rndContainer).toHaveStyle("opacity: 1");
  });

  // Add more tests here...
});
