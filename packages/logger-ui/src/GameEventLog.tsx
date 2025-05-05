import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
// Import react-rnd
import { Rnd } from "react-rnd";
// Import types from the main module
// Removed direct RndDragCallback, RndResizeCallback imports as hook handles callbacks
// Restore context import
import { useCommunicationContext } from "./CommunicationContext";
// Import the JSON viewer component
import ReactJson from "react-json-view";
// Import the CSS file
import "./GameEventLog.css";
// Import configuration CLASS and TYPE
import { GameEventLogConfig } from "./GameEventLogConfig"; // Adjust path if needed
import { SourceTreeNode } from "./types"; // Keep type for prop
// Import the TreeNode component
import { TreeNode } from "./TreeNode";
// Import helper functions
import { formatTimeDifference } from "./utils";
// Import the custom hooks
import { useEventFiltering } from "./hooks/useEventFiltering";
import { useComponentLayout } from "./hooks/useComponentLayout";
import { EventLogEntry } from "./types"; // Assuming types are defined here or adjust path

// --- Constants ---
const CONSOLE_SOURCE_ID = "Console"; // Default Source ID for hijacked logs

// --- NEW Helper Function to attempt parsing caller info ---
// Returns filename and line number if possible
interface CallerInfo {
  fileName: string;
  lineNumber: string | null;
}

const getCallerInfo = (): CallerInfo => {
  try {
    const err = new Error();
    const stack = err.stack;
    if (!stack) return { fileName: CONSOLE_SOURCE_ID, lineNumber: null };

    const lines = stack.split("\n").slice(3); // Adjust slice index if needed

    for (const line of lines) {
      if (
        line.includes("GameEventLog.tsx") ||
        line.includes("getCallerInfo") ||
        line.includes("createInterceptor")
      ) {
        continue;
      }

      // Chrome/V8: "at func (path/file.js:123:45)" or "at path/file.js:123:45"
      let match = line.match(/\(?([^\s\(]+):(\d+):\d+\)?$/);
      if (match) {
        const filePath = match[1];
        const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
        return {
          fileName: fileName || CONSOLE_SOURCE_ID,
          lineNumber: match[2],
        };
      }

      // Firefox: "func@path/file.js:123:45" or "@path/file.js:123:45"
      match = line.match(/@([^\s]+):(\d+):\d+$/);
      if (match) {
        const filePath = match[1];
        const fileName = filePath.substring(filePath.lastIndexOf("/") + 1);
        return {
          fileName: fileName || CONSOLE_SOURCE_ID,
          lineNumber: match[2],
        };
      }
    }

    return { fileName: CONSOLE_SOURCE_ID, lineNumber: null }; // Fallback
  } catch (e) {
    console.error("[getCallerInfo] Error parsing stack: ", e);
    return { fileName: CONSOLE_SOURCE_ID, lineNumber: null }; // Fallback on error
  }
};

// Helper function to calculate event counts by source
const calculateCountsBySource = (
  events: EventLogEntry[]
): Record<string, number> => {
  return events.reduce<Record<string, number>>((acc, event) => {
    acc[event.source] = (acc[event.source] || 0) + 1;
    return acc;
  }, {});
};

// --- Main GameEventLog Component ---

// Define props interface
interface GameEventLogProps {
  sourceConfigData?: SourceTreeNode[]; // Prop is now optional
  startsOpen?: boolean; // New prop: Controls initial open state
  startsLocked?: boolean; // New prop: Controls initial locked state
  initialX?: number; // New prop: Initial X coordinate
  initialY?: number; // New prop: Initial Y coordinate
  initialWidth?: number; // New prop: Initial width when expanded
  initialHeight?: number; // New prop: Initial height when expanded
  collapsedOpacity?: number; // New prop: Opacity when collapsed
  lockedOpacity?: number; // New prop: Opacity when locked (and not collapsed)
  startTreeOpen?: boolean; // New prop: Controls initial state of the filter tree section
  startDataOpen?: boolean; // New prop: Controls initial state of the details data section
  hijackConsoleLogs?: boolean; // New prop: Capture console.log/warn/error
}

export const GameEventLog: React.FC<GameEventLogProps> = ({
  sourceConfigData, // Destructure optional prop
  startsOpen = false,
  startsLocked = false, // Destructure and default startsLocked
  initialX = 20,
  initialY = 20,
  initialWidth = 600, // Default width when expanded
  initialHeight = 400, // Default height when expanded (Added)
  collapsedOpacity = 0.7,
  lockedOpacity = 0.8, // Destructure and default lockedOpacity
  startTreeOpen = false, // Default to closed
  startDataOpen = false, // Default to closed
  hijackConsoleLogs = true, // Destructure and default hijackConsoleLogs
}): React.ReactElement => {
  const { events, clearLog } = useCommunicationContext();
  // --- NEW: Get logEvent function from context ---
  const { logEvent } = useCommunicationContext(); // Assuming logEvent is provided by the context

  // --- State for Config --- (Managed in state now)
  const [config, setConfig] = useState<GameEventLogConfig>(() => {
    // Initialize config once using the prop data or default
    return new GameEventLogConfig(sourceConfigData);
  });

  // --- Effect to Handle Dynamic Sources --- (New)
  useEffect(() => {
    if (!config) return; // Should not happen with useState initializer, but safe check

    let configWasUpdated = false;
    const currentSources = new Set(config.getAllSourceIds()); // Use Set for efficient check

    events.forEach((event) => {
      if (!currentSources.has(event.source)) {
        // Call ensureSourceExists on the *current* config instance
        const added = config.ensureSourceExists(event.source);
        if (added) {
          configWasUpdated = true;
          currentSources.add(event.source); // Add to set to avoid re-checking in this loop
        }
      }
    });

    if (configWasUpdated) {
      // If sources were added, create a NEW config instance based on the updated tree
      // This is crucial to trigger re-renders in child components relying on config
      console.log("Config updated with new sources, triggering state update.");
      setConfig(new GameEventLogConfig(config.getSourceTree()));
    }
    // IMPORTANT: Dependency array includes events and the config instance itself.
    // Relying on the config instance ensures this runs if the config object identity changes
    // (e.g., if a new one is created). Relying on events ensures it runs when new events arrive.
  }, [events, config]);

  // --- NEW: Effect to Hijack Console Logs ---
  useEffect(() => {
    if (!hijackConsoleLogs) {
      // If hijacking is disabled, ensure originals are restored (if they were ever replaced)
      // This part handles toggling the prop *off* during component lifetime
      // @ts-expect-error We are assigning methods here
      if (window.__console_log_original) {
        // @ts-expect-error We are assigning methods here
        window.console.log = window.__console_log_original;
      }
      // @ts-expect-error We are assigning methods here
      if (window.__console_warn_original) {
        // @ts-expect-error We are assigning methods here
        window.console.warn = window.__console_warn_original;
      }
      // @ts-expect-error We are assigning methods here
      if (window.__console_error_original) {
        // @ts-expect-error We are assigning methods here
        window.console.error = window.__console_error_original;
      }
      return; // Exit effect early
    }

    // Store originals if they haven't been stored yet
    // Use a temporary property on window to avoid conflicts and allow cleanup checks
    // @ts-expect-error We are assigning methods here
    if (!window.__console_log_original) {
      // @ts-expect-error We are assigning methods here
      window.__console_log_original = window.console.log;
    }
    // @ts-expect-error We are assigning methods here
    if (!window.__console_warn_original) {
      // @ts-expect-error We are assigning methods here
      window.__console_warn_original = window.console.warn;
    }
    // @ts-expect-error We are assigning methods here
    if (!window.__console_error_original) {
      // @ts-expect-error We are assigning methods here
      window.__console_error_original = window.console.error;
    }

    // Get stored originals
    // @ts-expect-error We are assigning methods here
    const originalLog = window.__console_log_original;
    // @ts-expect-error We are assigning methods here
    const originalWarn = window.__console_warn_original;
    // @ts-expect-error We are assigning methods here
    const originalError = window.__console_error_original;

    // Function to create the interceptor
    const createInterceptor = (
      methodName: "log" | "warn" | "error",
      originalMethod: (...args: any[]) => void
    ) => {
      return (...args: any[]) => {
        // --- MODIFICATION: Get caller info object ---
        const { fileName, lineNumber } = getCallerInfo(); // Line number is now ignored

        // --- REVERT: Remove line number prepending ---
        // const processedArgs = [...args]; // Create a copy to modify
        // if (lineNumber && processedArgs.length > 0) {
        //     if (typeof processedArgs[0] === 'string') {
        //         processedArgs[0] = `[L${lineNumber}] ${processedArgs[0]}`;
        //     } else {
        //         // If first arg isn't a string, insert line number as a new first arg
        //         processedArgs.unshift(`[L${lineNumber}]`);
        //     }
        // }

        // --- NEW: Construct eventName with filename and optional line number ---
        const eventNameForLog = lineNumber
          ? `${fileName}:${lineNumber}`
          : fileName;

        // 1. Log the event to our system using method as source, file:line as eventName
        try {
          // Log the ORIGINAL arguments
          const dataPayload = { messages: args }; // Use original args
          // --- SWAP: Use methodName as source, constructed name as eventName ---
          logEvent(methodName, eventNameForLog, dataPayload);
        } catch (e) {
          // --- FIX: Use the original method to report logging errors ---
          const errorArgs = ["Error logging intercepted console message:", e];
          if (originalMethod?.apply) {
            originalMethod.apply(window.console, errorArgs);
          } else if (originalMethod) {
            // IE fallback for the error reporting itself
            originalMethod(errorArgs.map(String).join(" "));
          }
          // --- END FIX ---
        }

        // 2. Call the original console method with ORIGINAL arguments
        if (originalMethod) {
          if (originalMethod.apply) {
            // Normal browsers
            originalMethod.apply(window.console, args); // Use original args
          } else {
            // IE fallback (may join args - less ideal but functional)
            const message = args.map(String).join(" "); // Use original args
            originalMethod(message);
          }
        }
      };
    };

    // Replace console methods
    window.console.log = createInterceptor("log", originalLog);
    window.console.warn = createInterceptor("warn", originalWarn);
    window.console.error = createInterceptor("error", originalError);

    // Cleanup function to restore originals on unmount or when prop changes to false
    return () => {
      // @ts-expect-error We are assigning methods here
      if (window.__console_log_original) {
        // @ts-expect-error We are assigning methods here
        window.console.log = window.__console_log_original;
        // @ts-expect-error We are assigning methods here
        delete window.__console_log_original; // Clean up temporary storage
      }
      // @ts-expect-error We are assigning methods here
      if (window.__console_warn_original) {
        // @ts-expect-error We are assigning methods here
        window.console.warn = window.__console_warn_original;
        // @ts-expect-error We are assigning methods here
        delete window.__console_warn_original;
      }
      // @ts-expect-error We are assigning methods here
      if (window.__console_error_original) {
        // @ts-expect-error We are assigning methods here
        window.console.error = window.__console_error_original;
        // @ts-expect-error We are assigning methods here
        delete window.__console_error_original;
      }
    };
    // Dependency array: run when hijack prop changes or logEvent function instance changes
  }, [hijackConsoleLogs, logEvent]);

  // --- Filtering State & Logic Hook --- (Pass config state)
  const {
    filterName,
    setFilterName,
    allowedSources,
    handleSourceTreeToggle,
    filteredEvents,
    eventsCountBySource,
  } = useEventFiltering(events, config.getAllSourceIds()); // Pass all known source IDs from config state

  // --- NEW: Calculate total counts based on *unfiltered* events ---
  const totalEventsCountBySource = useMemo(() => {
    return calculateCountsBySource(events);
  }, [events]);

  // --- Layout & Visibility State Hook ---
  const {
    position,
    size,
    isCollapsed,
    isFilterCollapsed,
    isDetailsCollapsed,
    toggleCollapse,
    toggleFilterCollapse,
    toggleDetailsCollapse,
    handleDragStop,
    handleResizeStop,
  } = useComponentLayout({
    initialX,
    initialY,
    initialWidth, // Pass initialWidth
    initialHeight, // Pass initialHeight (Added)
    startsOpen,
    startTreeOpen, // Pass startTreeOpen
    startDataOpen, // Pass startDataOpen
    // Pass other initial layout props if needed (e.g., initialHeight)
  });

  // --- Other State --- (Selection state remains here for now)
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(
    null
  );
  // Initialize isLocked state using the startsLocked prop
  const [isLocked, setIsLocked] = useState<boolean>(startsLocked);
  // New state for adjustable locked opacity
  const [currentLockedOpacity, setCurrentLockedOpacity] =
    useState<number>(lockedOpacity);
  // New state for slider visibility
  const [isOpacitySliderVisible, setIsOpacitySliderVisible] =
    useState<boolean>(false); // Default to hidden

  // --- Memoized Calculations ---
  const initializationTime = useMemo(() => {
    if (events.length === 0) {
      return null;
    }
    const sortedEvents = [...events].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const firstEventTimestamp = sortedEvents[0]?.timestamp;
    if (!firstEventTimestamp) return null;

    try {
      return new Date(firstEventTimestamp);
    } catch (e) {
      console.error(
        "Failed to parse initial timestamp:",
        firstEventTimestamp,
        e
      );
      return null;
    }
  }, [events]);

  const activeSourcesInLog = useMemo(() => {
    // Ensure all sources present in the log are known to the config
    // This might seem redundant with the useEffect, but ensures activeSourcesInLog
    // is accurate even if the effect hasn't run yet for a batch of new events.
    // Note: This check *could* modify config if ensureSourceExists adds something,
    // but the subsequent useEffect will handle the state update if needed.
    const sources = new Set<string>();
    events.forEach((event) => {
      if (config) {
        // Check if config is initialized
        config.ensureSourceExists(event.source);
        sources.add(event.source);
      }
    });
    return sources;
    // Depend on events and config state
  }, [events, config]);

  // --- Callbacks --- (Moved layout/collapse toggles to hook)

  // Clear Log callback remains
  const handleClearLog = () => {
    clearLog();
    setSelectedEventIndex(null);
    console.log("Clear log clicked");
  };

  // Copy to Clipboard callback remains (depends on filteredEvents & initTime)
  const handleCopyToClipboard = useCallback(() => {
    if (!initializationTime) {
      console.warn(
        "Initialization time not set, cannot format timestamps accurately."
      );
      return;
    }

    const preambleLines = config
      .getAllSourceIds()
      .map((sourceId) => `${config.getSymbol(sourceId)}: ${sourceId}`);
    const preamble = `Emoji Legend:\n${preambleLines.join("\n")}\n---\n\n`;

    const logLines = filteredEvents
      .map((event) => {
        const timestamp = formatTimeDifference(
          event.timestamp,
          initializationTime
        );
        const symbol = config.getSymbol(event.source);
        const eventName = event.eventName;
        let line = `${timestamp} ${symbol} ${eventName}`;
        if (event.data !== undefined && event.data !== null) {
          const dataString = JSON.stringify(event.data);
          line += ` ${dataString}`;
        }
        return line;
      })
      .join("\n");

    const textToCopy = preamble + logLines;

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        console.log("Filtered log copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy log to clipboard:", err);
      });
  }, [filteredEvents, initializationTime, config]);

  // New callback to toggle lock state
  const toggleLock = () => {
    setIsLocked((prevLocked) => !prevLocked);
  };

  // New callback for locked opacity slider change
  const handleLockedOpacityChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setCurrentLockedOpacity(parseFloat(e.target.value));
  };

  // New callback to toggle slider visibility
  const toggleOpacitySlider = () => {
    setIsOpacitySliderVisible((prev) => !prev);
  };

  // --- NEW: Callback to save current settings to console ---
  const handleSaveSettings = useCallback(() => {
    // Explicitly build lines to ensure literal curly braces
    const settingsLines = [
      `initialX={${Math.round(position.x)}}`,
      `initialY={${Math.round(position.y)}}`,
      `initialWidth={${Math.round(Number(size.width))}}`, // Ensure width is treated as a number
      `initialHeight={${Math.round(Number(size.height))}}`, // Added initialHeight
      `startsOpen={${!isCollapsed}}`,
      `startsLocked={${isLocked}}`,
      `startTreeOpen={${!isFilterCollapsed}}`,
      `startDataOpen={${!isDetailsCollapsed}}`,
      `collapsedOpacity={${collapsedOpacity}}`,
      `lockedOpacity={${currentLockedOpacity.toFixed(2)}}`,
      `hijackConsoleLogs={${hijackConsoleLogs}}`,
    ];
    // Join with newline and add padding for direct pasting
    const settingsString = `\n  ${settingsLines.join("\n  ")}\n`;

    navigator.clipboard
      .writeText(settingsString)
      .then(() => {
        // Log success to the internal event log
        logEvent("GameEventLog", "settingsCopiedToClipboard");
      })
      .catch((err) => {
        // Log error to the internal event log and console
        console.error("Failed to copy settings to clipboard:", err);
        logEvent("GameEventLog", "settingsCopyFailed", { error: String(err) });
      });
  }, [
    position.x,
    position.y,
    size.width,
    size.height, // Added size.height dependency
    isCollapsed,
    isLocked,
    isFilterCollapsed,
    isDetailsCollapsed,
    collapsedOpacity,
    currentLockedOpacity,
    hijackConsoleLogs,
    logEvent,
  ]);

  // --- JSX Rendering ---
  return (
    <Rnd
      size={size} // Use size from hook
      position={position} // Use position from hook
      className={`log-container ${isCollapsed ? "collapsed" : ""} ${
        isLocked ? "locked" : ""
      }`} // Add locked class
      style={{
        opacity: isCollapsed
          ? collapsedOpacity // Use prop for collapsed opacity
          : isLocked
          ? currentLockedOpacity // Use state for locked opacity
          : 1, // Default opacity when expanded and unlocked
      }}
      dragHandleClassName="drag-handle"
      minWidth={250}
      minHeight={isCollapsed ? 50 : 200} // Use isCollapsed from hook
      // Disable resizing if collapsed OR locked
      enableResizing={!isCollapsed && !isLocked}
      onDragStop={handleDragStop} // Use handler from hook
      onResizeStop={handleResizeStop} // Use handler from hook
      bounds="window"
      disableDragging={isLocked} // <-- Disable dragging when locked
      // Prevent drag start when clicking on the slider container
      cancel=".locked-opacity-slider-container"
    >
      <div
        className={`log-content-wrapper ${
          isCollapsed // Use isCollapsed from hook
            ? "log-content-wrapper--collapsed"
            : "log-content-wrapper--expanded"
        }`}
      >
        {/* Header */}
        <div className="log-header drag-handle">
          <div className="log-header-left">
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent header click (if any existed) or drag initiation
                toggleLock();
              }}
              className="log-button lock-button" // Keep lock-button class
              title={isLocked ? "Unlock" : "Lock"}
            >
              {isLocked ? "🔒" : "🔓"}
            </button>
            <button
              onClick={!isLocked ? toggleCollapse : undefined}
              className="log-button log-button--collapse-toggle"
              disabled={isLocked}
              title={
                isLocked
                  ? "Unlock to expand/collapse"
                  : isCollapsed
                  ? "Expand Log"
                  : "Collapse Log"
              }
            >
              {isCollapsed ? "➕" : "➖"}
            </button>
            <h3 className="log-header-title">Game Event Log</h3>
            <span className="log-header-count" style={{ marginLeft: "8px" }}>
              ({filteredEvents.length})
            </span>
          </div>

          <div className="log-header-right">
            {!isCollapsed && (
              <>
                <button
                  onClick={toggleFilterCollapse}
                  className="log-button"
                  style={{ opacity: isFilterCollapsed ? 0.6 : 1 }}
                  title={isFilterCollapsed ? "Show Filters" : "Hide Filters"}
                >
                  ☰
                </button>

                <button
                  onClick={toggleDetailsCollapse}
                  className="log-button"
                  style={{ opacity: isDetailsCollapsed ? 0.6 : 1 }}
                  title={isDetailsCollapsed ? "Show Details" : "Hide Details"}
                >
                  ℹ️
                </button>

                <button
                  onClick={handleCopyToClipboard}
                  className="log-button"
                  title="Copy filtered log to clipboard"
                >
                  📋
                </button>

                {/* NEW Settings Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent drag
                    handleSaveSettings();
                  }}
                  className="log-button"
                  title="Save Current Settings to Console"
                >
                  ⚙️
                </button>

                {/* Locked Opacity Slider - Only show when expanded */}
                <div className="locked-opacity-slider-container">
                  <label
                    htmlFor="lockedOpacitySlider"
                    className="locked-opacity-slider-label"
                    title="Toggle locked opacity slider"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent interfering with drag/other clicks
                      toggleOpacitySlider();
                    }}
                    style={{ cursor: "pointer" }} // Indicate it's clickable
                  >
                    👁️ {/* Eye icon */}
                  </label>
                  {/* Conditionally render the slider */}
                  {isOpacitySliderVisible && (
                    <input
                      type="range"
                      id="lockedOpacitySlider"
                      min="0"
                      max="1"
                      step="0.05" // Adjust step as needed
                      value={currentLockedOpacity}
                      onChange={handleLockedOpacityChange}
                      className="locked-opacity-slider"
                      title={`Adjust locked opacity (${currentLockedOpacity.toFixed(
                        2
                      )})`}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Collapsible Content Area */}
        {!isCollapsed && (
          <div
            className="log-main-content"
            style={{
              height: `calc(100% - 37px)`,
            }}
          >
            {/* Filter Column */}
            <div
              className={`log-column log-column--filter ${
                isFilterCollapsed ? "log-column--filter-collapsed" : ""
              }`}
            >
              {!isFilterCollapsed && (
                <>
                  <div className="filter-name-input">
                    <input
                      type="text"
                      placeholder="Filter by event name..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      className="log-filter-input"
                    />
                    <button
                      onClick={handleClearLog}
                      className="log-button log-button--clear"
                      title="Clear all log entries"
                    >
                      Clear Log
                    </button>
                  </div>
                  <div className="filter-source-list">
                    {config.getSourceTree().map((topLevelNode) => (
                      <TreeNode
                        key={topLevelNode.id}
                        node={topLevelNode}
                        allowedSources={allowedSources}
                        onToggle={handleSourceTreeToggle}
                        activeSourcesInLog={activeSourcesInLog}
                        eventsCountBySource={eventsCountBySource}
                        totalEventsCountBySource={totalEventsCountBySource}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Event List Column */}
            <div
              className={`log-column log-column--list ${
                isDetailsCollapsed ? "log-column--list-no-details" : ""
              }`}
              style={{ flexGrow: isDetailsCollapsed ? 1 : 0 }}
            >
              <ul className="log-event-list">
                {/* Reverse the array before mapping to show newest first */}
                {filteredEvents
                  .slice() // Create a shallow copy to avoid mutating the original
                  .reverse() // Reverse the copy
                  .map((event, index) => {
                    // Calculate the original index if needed for selection (tricky)
                    // For selection, it might be better to use a unique event ID if available
                    // or rethink how selection works if order is reversed.
                    // For now, let's assume selection might be slightly off if relying on reversed index.
                    const originalIndex = filteredEvents.length - 1 - index; // Example: Approximate original index

                    return (
                      <li
                        key={`${event.timestamp}-${event.source}-${event.eventName}-${originalIndex}`}
                        className={`log-event-item ${
                          // Use originalIndex for selection check if required, but ID is safer
                          originalIndex === selectedEventIndex
                            ? "log-event-item--selected"
                            : ""
                        } ${
                          event.data === undefined || event.data === null
                            ? "log-event-item--no-data"
                            : ""
                        }`}
                        onClick={
                          event.data !== undefined && event.data !== null
                            ? () =>
                                setSelectedEventIndex(
                                  // Use originalIndex if selection relies on it
                                  originalIndex === selectedEventIndex
                                    ? null
                                    : originalIndex
                                )
                            : undefined
                        }
                      >
                        <div className="log-event-item-content">
                          <span className="log-event-timestamp">
                            {initializationTime
                              ? formatTimeDifference(
                                  event.timestamp,
                                  initializationTime
                                )
                              : `[${event.timestamp}]`}
                          </span>
                          <span
                            title={event.source}
                            className="log-event-symbol"
                          >
                            {config.getSymbol(event.source)}
                          </span>
                          <span className="log-event-name">
                            {event.eventName}
                            {event.data !== undefined &&
                              event.data !== null && (
                                <span className="log-event-data-indicator">
                                  *
                                </span>
                              )}
                          </span>
                          {isDetailsCollapsed &&
                            event.data !== undefined &&
                            event.data !== null && (
                              <span
                                className="log-event-inline-preview"
                                title={JSON.stringify(event.data)}
                              >
                                {JSON.stringify(event.data, null, 0)}{" "}
                              </span>
                            )}
                        </div>
                      </li>
                    );
                  })}
                {filteredEvents.length === 0 && (
                  <li className="log-event-item log-event-item--no-data">
                    No events match filters.
                  </li>
                )}
              </ul>
            </div>

            {/* Details Column */}
            <div
              className={`log-column log-column--details ${
                isDetailsCollapsed ? "log-column--details-collapsed" : ""
              }`}
              style={{
                flexGrow: isDetailsCollapsed ? 0 : 1,
                flexBasis: isDetailsCollapsed ? "0px" : "auto",
              }}
            >
              {!isDetailsCollapsed && (
                <>
                  {selectedEventIndex !== null &&
                  filteredEvents[selectedEventIndex]?.data !== undefined &&
                  filteredEvents[selectedEventIndex]?.data !== null ? (
                    <div style={{ textAlign: "left" }}>
                      <ReactJson
                        src={filteredEvents[selectedEventIndex].data as object}
                        theme="ocean"
                        collapsed={false}
                        enableClipboard={true}
                        displayDataTypes={true}
                        displayObjectSize={true}
                        name={false}
                        style={{
                          padding: "5px",
                          backgroundColor: "transparent",
                          fontSize: "1em",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="log-details-placeholder">
                      {selectedEventIndex !== null
                        ? "No data for this event."
                        : "Click an event to view details."}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Rnd>
  );
};

// --- Helper Functions (could be moved to utils if needed) ---

// (getAllSourceIds is already defined above)
// No other helpers needed for this refactor

// Ensure EventLogEntry type is correctly referenced if needed elsewhere
// export type { EventLogEntry }; // Re-export if needed by other components
