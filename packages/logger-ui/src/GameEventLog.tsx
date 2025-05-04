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
  collapsedOpacity?: number; // New prop: Opacity when collapsed
  lockedOpacity?: number; // New prop: Opacity when locked (and not collapsed)
  startTreeOpen?: boolean; // New prop: Controls initial state of the filter tree section
  startDataOpen?: boolean; // New prop: Controls initial state of the details data section
}

export const GameEventLog: React.FC<GameEventLogProps> = ({
  sourceConfigData, // Destructure optional prop
  startsOpen = false,
  startsLocked = false, // Destructure and default startsLocked
  initialX = 20,
  initialY = 20,
  initialWidth = 600, // Default width when expanded
  collapsedOpacity = 0.7,
  lockedOpacity = 0.8, // Destructure and default lockedOpacity
  startTreeOpen = false, // Default to closed
  startDataOpen = false, // Default to closed
}): React.ReactElement => {
  const { events, clearLog } = useCommunicationContext();

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
          ? lockedOpacity // Use prop for locked opacity
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
                  <button
                    onClick={handleClearLog}
                    className="log-button log-button--clear"
                  >
                    Clear Log
                  </button>
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
                {filteredEvents.map((event, index) => (
                  <li
                    key={`${event.timestamp}-${event.source}-${event.eventName}-${index}`}
                    className={`log-event-item ${
                      index === selectedEventIndex
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
                              index === selectedEventIndex ? null : index
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
                      <span title={event.source} className="log-event-symbol">
                        {config.getSymbol(event.source)}
                      </span>
                      <span className="log-event-name">
                        {event.eventName}
                        {event.data !== undefined && event.data !== null && (
                          <span className="log-event-data-indicator">*</span>
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
                ))}
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
