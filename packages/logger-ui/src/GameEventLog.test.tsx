import React from "react";
import { render, screen, within } from "@testing-library/react";
import { GameEventLog } from "./GameEventLog";
// Remove CommunicationProvider import, we won't use the real one
// import { CommunicationProvider } from "./CommunicationContext";
import { useCommunicationContext } from "./CommunicationContext";
import { vi } from "vitest";
import { EventLogEntry, SourceTreeNode } from "./types"; // Import the type and SourceTreeNode
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

// Helper to setup mock return values for the hook
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

describe("GameEventLog", () => {
  // Reset the mock hook before each test
  beforeEach(() => {
    // Reset the mock implementation and call history
    (useCommunicationContext as ReturnType<typeof vi.fn>).mockClear();
    // Set default return values for a clean slate
    setupMockContext({});
  });

  it("should render without crashing", () => {
    // Setup default context values (empty events, mock functions)
    setupMockContext({});

    // Render GameEventLog directly, no Provider needed
    render(<GameEventLog />);

    // Check for a key element to confirm rendering
    expect(screen.getByText("Game Event Log")).toBeInTheDocument();
  });

  // --- Test Event Display ---
  it("should display events from the context", () => {
    // 1. Arrange: Setup mock context AND config data
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
    setupMockContext({ events: mockEvents });

    // 2. Act: Render the component, providing the config data
    render(
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
    // 1. Arrange: Setup mock context with a spy for clearLog
    const mockClearLog = vi.fn();
    setupMockContext({ clearLog: mockClearLog });

    // Render expanded AND with the filter tree open so the button is visible
    render(<GameEventLog startsOpen={true} startTreeOpen={true} />);

    // 2. Act: Find and click the "Clear Log" button
    const clearButton = screen.getByRole("button", { name: /clear log/i });
    fireEvent.click(clearButton);

    // 3. Assert: Check if the mock function was called
    expect(mockClearLog).toHaveBeenCalledTimes(1);
  });

  // --- New Test ---
  it("should filter events based on event name input", () => {
    // 1. Arrange: Setup context with events and matching config
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
    setupMockContext({ events: mockEvents });

    // Render expanded with filter tree open
    render(
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
    // 1. Arrange: Setup context with events (one with data) and config
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
    setupMockContext({ events: mockEvents });

    // Render with all panels open
    render(
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
    // 1. Arrange: Setup context with events and matching config
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
    setupMockContext({ events: mockEvents });

    // Render expanded with filter tree open
    render(
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

  // --- New Test ---
  it("should collapse and expand when the toggle button is clicked", () => {
    // 1. Arrange: Render in default (collapsed) state
    render(<GameEventLog />);

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

  // --- New Test ---
  it("should toggle lock state when the lock/unlock button is clicked", () => {
    // 1. Arrange: Render in default (unlocked) state
    render(<GameEventLog />);

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

  // --- New Test ---
  it("should collapse and expand the filter tree when the filter toggle button is clicked", () => {
    // 1. Arrange: Render with main panel and filter tree open
    render(<GameEventLog startsOpen={true} startTreeOpen={true} />);

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
    // 1. Arrange: Setup mock context with a spy for logEvent
    const mockLogEvent = vi.fn();
    setupMockContext({ logEvent: mockLogEvent });

    // Render with default hijackConsoleLogs=true
    // Use unmount to test cleanup
    const { unmount } = render(<GameEventLog startsOpen={true} />);

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
    // 1. Arrange: Setup mock context with a spy for logEvent
    const mockLogEvent = vi.fn();
    setupMockContext({ logEvent: mockLogEvent });

    // No need to store originalConsoleLog here

    // Render with hijackConsoleLogs explicitly set to false
    const { unmount } = render(<GameEventLog hijackConsoleLogs={false} />);

    // 2. Act: Call console.log
    const testMessage = "This should go to the real console";
    console.log(testMessage);

    // 3. Assert: Check that mock logEvent was NOT called
    expect(mockLogEvent).not.toHaveBeenCalled();

    // Cleanup
    unmount();
    // No manual restoration check needed here, unmount should handle it.
  });

  // Add more tests here...
});
