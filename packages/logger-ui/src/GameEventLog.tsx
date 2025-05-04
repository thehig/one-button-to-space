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

// --- Main GameEventLog Component ---

// Define props interface
interface GameEventLogProps {
  sourceConfigData: SourceTreeNode[]; // New prop: Source tree config
  startsOpen?: boolean; // New prop: Controls initial open state
  initialX?: number; // New prop: Initial X coordinate
  initialY?: number; // New prop: Initial Y coordinate
  initialWidth?: number; // New prop: Initial width when expanded
  collapsedOpacity?: number; // New prop: Opacity when collapsed
  startTreeOpen?: boolean; // New prop: Controls initial state of the filter tree section
  startDataOpen?: boolean; // New prop: Controls initial state of the details data section
}

export const GameEventLog: React.FC<GameEventLogProps> = ({
  sourceConfigData, // Destructure new prop
  startsOpen = false,
  initialX = 20,
  initialY = 20,
  initialWidth = 600, // Default width when expanded
  collapsedOpacity = 0.7,
  startTreeOpen = false, // Default to closed
  startDataOpen = false, // Default to closed
}): React.ReactElement => {
  const { events, clearLog } = useCommunicationContext();

  // Instantiate the config based on the prop
  const config = useMemo(
    () => new GameEventLogConfig(sourceConfigData),
    [sourceConfigData]
  );

  // --- Filtering State & Logic Hook ---
  const {
    filterName,
    setFilterName,
    allowedSources,
    handleSourceTreeToggle,
    filteredEvents,
    eventsCountBySource,
  } = useEventFiltering(events, config.getAllSourceIds());

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
    return new Set(events.map((event) => event.source));
  }, [events]);

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

  // --- JSX Rendering ---
  return (
    <Rnd
      size={size} // Use size from hook
      position={position} // Use position from hook
      className="log-container"
      style={{
        opacity: isCollapsed ? collapsedOpacity : 1, // Use isCollapsed from hook
      }}
      dragHandleClassName="drag-handle"
      minWidth={250}
      minHeight={isCollapsed ? 50 : 200} // Use isCollapsed from hook
      enableResizing={!isCollapsed} // Use isCollapsed from hook
      onDragStop={handleDragStop} // Use handler from hook
      onResizeStop={handleResizeStop} // Use handler from hook
      bounds="window"
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
              onClick={toggleCollapse} // Use handler from hook
              className="log-button log-button--collapse-toggle"
              title={isCollapsed ? "Expand Log" : "Collapse Log"} // Use isCollapsed from hook
            >
              {isCollapsed ? "➕" : "➖"} {/* Use isCollapsed from hook */}
            </button>
            <h3 className="log-header-title">Game Event Log</h3>
          </div>

          <div className="log-header-right">
            {!isCollapsed && ( // Use isCollapsed from hook
              <>
                {/* Filter Panel Toggle */}
                <button
                  onClick={toggleFilterCollapse} // Use handler from hook
                  className="log-button"
                  style={{ opacity: isFilterCollapsed ? 0.6 : 1 }} // Use isFilterCollapsed from hook
                  title={isFilterCollapsed ? "Show Filters" : "Hide Filters"} // Use isFilterCollapsed from hook
                >
                  ☰
                </button>

                {/* Details Panel Toggle */}
                <button
                  onClick={toggleDetailsCollapse} // Use handler from hook
                  className="log-button"
                  style={{ opacity: isDetailsCollapsed ? 0.6 : 1 }} // Use isDetailsCollapsed from hook
                  title={isDetailsCollapsed ? "Show Details" : "Hide Details"} // Use isDetailsCollapsed from hook
                >
                  ℹ️
                </button>

                {/* Copy Button */}
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
        {!isCollapsed && ( // Use isCollapsed from hook
          <div
            className="log-main-content"
            style={{ height: `calc(100% - 37px)` }}
          >
            {/* Filter Column */}
            <div
              className={`log-column log-column--filter ${
                isFilterCollapsed ? "log-column--filter-collapsed" : ""
              }`}
            >
              {!isFilterCollapsed && ( // Use isFilterCollapsed from hook
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
                    {/* Map over the top-level nodes from the config */}
                    {config.getSourceTree().map((topLevelNode) => (
                      <TreeNode
                        key={topLevelNode.id} // Use node ID as key
                        node={topLevelNode} // Pass the individual node
                        allowedSources={allowedSources}
                        onToggle={handleSourceTreeToggle}
                        // Pass down necessary props needed by TreeNode and its children
                        activeSourcesInLog={activeSourcesInLog}
                        eventsCountBySource={eventsCountBySource}
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
              style={{ flexGrow: isDetailsCollapsed ? 1 : 0 }} // Use isDetailsCollapsed from hook
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
                      {isDetailsCollapsed && // Use isDetailsCollapsed from hook
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
                flexGrow: isDetailsCollapsed ? 0 : 1, // Use isDetailsCollapsed from hook
                flexBasis: isDetailsCollapsed ? "0px" : "auto", // Use isDetailsCollapsed from hook
              }}
            >
              {!isDetailsCollapsed && ( // Use isDetailsCollapsed from hook
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
