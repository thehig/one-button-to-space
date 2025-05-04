import React, { useState, useMemo, useEffect, useCallback } from "react";
// EventLogEntry type is implicitly used via context, no need for direct import if not used elsewhere
// import { EventLogEntry } from "../types/events";
import { useCommunicationContext } from "../contexts/CommunicationContext"; // Import the hook and type

// TODO: Define an interface for the event log entry
// Remove the duplicate inline interface definition
/*
interface EventLogEntry {
  timestamp: string;
  source: string;
  eventName: string;
  data?: unknown;
}
*/

// --- Configuration ---

// 1. Source-Emoji/Symbol Mapping
const sourceSymbols: Record<string, string> = {
  LifecycleManager: "⚙️", // Gear
  PhysicsManager: "🏈", // Football (Matter.js shape) / Could use ന്യ or other physics symbol
  EntityManager: "🧍", // Person Standing
  InputManager: "🖱️", // Mouse
  NetworkManager: "🌐", // Globe with Meridians
  CameraManager: "📷", // Camera
  UIManager: "📊", // Bar Chart
  AudioManager: "🔊", // Speaker High Volume
  CommunicationManager: "💬", // Speech Bubble
  BootScene: "🚀", // Rocket
  MainMenuScene: "🏠", // House
  GameScene: "🎮", // Video Game
  Scene: "🎬", // Clapper Board (Generic scene events)
  // Add more as needed
};

// Helper to get symbol or fallback
const getSymbol = (source: string) => sourceSymbols[source] || "❓"; // Question mark fallback

// 2. Hierarchical Source Filter Definition
interface SourceTreeNode {
  id: string; // Unique identifier (usually the source name)
  label: string; // Display name (usually the source name)
  symbol?: string; // Emoji/Symbol
  children?: SourceTreeNode[];
}

const sourceTreeData: SourceTreeNode[] = [
  // Moved CommunicationManager and LifecycleManager under Managers
  // { id: "CommunicationManager", label: "CommunicationManager", symbol: getSymbol("CommunicationManager") },
  {
    id: "Scenes",
    label: "Scenes",
    symbol: "🎬", // Use Scene symbol for the group
    children: [
      { id: "BootScene", label: "BootScene", symbol: getSymbol("BootScene") },
      {
        id: "MainMenuScene",
        label: "MainMenuScene",
        symbol: getSymbol("MainMenuScene"),
      },
      { id: "GameScene", label: "GameScene", symbol: getSymbol("GameScene") },
      { id: "Scene", label: "Scene", symbol: getSymbol("Scene") }, // Generic
    ],
  },
  // { id: "LifecycleManager", label: "LifecycleManager", symbol: getSymbol("LifecycleManager") },
  {
    id: "Managers",
    label: "Managers",
    symbol: "🛠️", // Hammer and Wrench for the group
    children: [
      // Added LifecycleManager and CommunicationManager here
      {
        id: "LifecycleManager",
        label: "LifecycleManager",
        symbol: getSymbol("LifecycleManager"),
      },
      {
        id: "CommunicationManager",
        label: "CommunicationManager",
        symbol: getSymbol("CommunicationManager"),
      },
      {
        id: "PhysicsManager",
        label: "PhysicsManager",
        symbol: getSymbol("PhysicsManager"),
      },
      {
        id: "EntityManager",
        label: "EntityManager",
        symbol: getSymbol("EntityManager"),
      },
      {
        id: "InputManager",
        label: "InputManager",
        symbol: getSymbol("InputManager"),
      },
      {
        id: "NetworkManager",
        label: "NetworkManager",
        symbol: getSymbol("NetworkManager"),
      },
      {
        id: "CameraManager",
        label: "CameraManager",
        symbol: getSymbol("CameraManager"),
      },
      { id: "UIManager", label: "UIManager", symbol: getSymbol("UIManager") },
      {
        id: "AudioManager",
        label: "AudioManager",
        symbol: getSymbol("AudioManager"),
      },
    ],
  },
];

// Function to get all source IDs from the tree (including children)
const getAllSourceIds = (nodes: SourceTreeNode[]): string[] => {
  let ids: string[] = [];
  nodes.forEach((node) => {
    // Only add leaf nodes or nodes without children explicitly defined in treeData
    // Parent nodes like "Scenes", "Managers" are not real sources themselves
    if (!node.children || node.children.length === 0) {
      if (sourceSymbols[node.id]) {
        // Only add if it's a known source type
        ids.push(node.id);
      }
    }
    if (node.children) {
      ids = ids.concat(getAllSourceIds(node.children));
    }
  });
  return ids;
};

// --- TreeNode Component for Hierarchical Filter ---
interface TreeNodeProps {
  node: SourceTreeNode;
  allowedSources: Set<string>;
  onToggle: (node: SourceTreeNode, isChecked: boolean) => void;
  activeSourcesInLog: Set<string>; // Sources currently present in the unfiltered log
  eventsCountBySource: Record<string, number>; // New prop: Counts per source in filtered log
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  allowedSources,
  onToggle,
  activeSourcesInLog,
  eventsCountBySource, // Destructure new prop
}) => {
  const isParent = !!node.children && node.children.length > 0;

  // Determine checkbox state: checked, unchecked, or indeterminate
  const nodeAndChildrenIds = isParent ? getAllSourceIds([node]) : [node.id];

  let checkboxState: "checked" | "unchecked" | "indeterminate" = "unchecked";
  // Only consider nodes that are actual sources (exist in sourceSymbols) for determining state
  const relevantIds = nodeAndChildrenIds.filter((id) => sourceSymbols[id]);

  if (relevantIds.length > 0) {
    const checkedCount = relevantIds.filter((id) =>
      allowedSources.has(id)
    ).length;
    if (checkedCount === relevantIds.length) {
      checkboxState = "checked";
    } else if (checkedCount > 0) {
      checkboxState = "indeterminate";
    } else {
      checkboxState = "unchecked";
    }
  } else if (isParent) {
    // Handle parent nodes like "Scenes" or "Managers" which don't have direct sourceSymbols mapping
    // Their state depends entirely on children
    const childSourceIds = getAllSourceIds(node.children || []);
    const checkedChildCount = childSourceIds.filter((id) =>
      allowedSources.has(id)
    ).length;
    if (childSourceIds.length > 0) {
      if (checkedChildCount === childSourceIds.length) {
        checkboxState = "checked";
      } else if (checkedChildCount > 0) {
        checkboxState = "indeterminate";
      }
    }
    // else remains 'unchecked' if no children or no checkable children
  } else {
    // Leaf node that is not in sourceSymbols (should not happen with current logic, but safety check)
    checkboxState = allowedSources.has(node.id) ? "checked" : "unchecked";
  }

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(node, e.target.checked);
  };

  // Ref for indeterminate state
  const checkboxRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.checked = checkboxState === "checked";
      checkboxRef.current.indeterminate = checkboxState === "indeterminate";
    }
  }, [checkboxState]);

  // Determine if the node should be greyed out
  const isNodeActive = nodeAndChildrenIds.some((id) =>
    activeSourcesInLog.has(id)
  );

  return (
    <div style={{ marginLeft: isParent ? "0px" : "20px" }}>
      {" "}
      {/* Indent children */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          marginBottom: "3px",
          whiteSpace: "nowrap",
          // Apply greyed-out style if node (or its children) have no active events
          color: isNodeActive ? "inherit" : "#999",
          opacity: isNodeActive ? 1 : 0.6,
        }}
        title={node.id} // Show ID on hover for clarity if needed
      >
        <input
          ref={checkboxRef}
          type="checkbox"
          // checked={checkboxState === 'checked'} // Handled by useEffect and ref
          // indeterminate={checkboxState === 'indeterminate'} // Handled by useEffect and ref
          onChange={handleCheckboxChange}
          style={{ marginRight: "5px" }}
        />
        <span
          style={{
            marginRight: "5px",
            minWidth: "1.2em",
            display: "inline-block",
            textAlign: "center",
          }}
        >
          {node.symbol || (isParent ? "📁" : "")}{" "}
          {/* Folder for parents without symbol */}
        </span>
        {node.label}
        {/* Display Count */}
        <span style={{ marginLeft: "5px", fontSize: "0.9em", color: "#777" }}>
          (
          {isParent
            ? getAllSourceIds([node]).reduce(
                (sum, id) => sum + (eventsCountBySource[id] || 0),
                0
              )
            : eventsCountBySource[node.id] || 0}
          )
        </span>
      </label>
      {isParent && (
        <div
          style={{
            marginLeft: "20px",
            borderLeft: "1px solid #eee",
            paddingLeft: "10px",
          }}
        >
          {" "}
          {/* Visual indent for children */}
          {node.children?.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              allowedSources={allowedSources}
              onToggle={onToggle}
              activeSourcesInLog={activeSourcesInLog}
              eventsCountBySource={eventsCountBySource} // Pass down counts
            />
          ))}
        </div>
      )}
    </div>
  );
};

// --- Main GameEventLog Component ---
export const GameEventLog: React.FC = () => {
  const { events, clearLog } = useCommunicationContext(); // Use the context hook
  // Remove filterSourceText state
  // const [filterSourceText, setFilterSourceText] = useState("");
  const [filterName, setFilterName] = useState("");

  // State to keep track of which sources are currently allowed/checked
  // Initialize with all known sources from the tree definition
  const [allowedSources, setAllowedSources] = useState<Set<string>>(
    new Set(getAllSourceIds(sourceTreeData)) // Start with all known sources checked
  );

  // Hover state for displaying data payload
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Determine the timestamp of the first event (earliest)
  const initializationTime = useMemo(() => {
    if (events.length === 0) {
      return null;
    }
    // Since events are prepended, the last event is the earliest
    const firstEventTimestamp = events[events.length - 1].timestamp;
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
  }, [events]); // Recalculate only when events array fundamentally changes (length becomes > 0)

  // Recalculate unique sources present in the *current unfiltered* events
  const activeSourcesInLog = useMemo(() => {
    return new Set(events.map((event) => event.source));
  }, [events]);

  // Handler for toggling sources via the tree
  const handleSourceTreeToggle = useCallback(
    (node: SourceTreeNode, isChecked: boolean) => {
      setAllowedSources((prevAllowed) => {
        const newAllowed = new Set(prevAllowed);
        const idsToUpdate = getAllSourceIds([node]); // Get this node and all its descendants

        idsToUpdate.forEach((id) => {
          // Only modify sources that are known/mappable
          if (sourceSymbols[id]) {
            if (isChecked) {
              newAllowed.add(id);
            } else {
              newAllowed.delete(id);
            }
          }
        });

        // Also handle toggling parent nodes ("Scenes", "Managers") based on children
        if (node.children && node.children.length > 0) {
          const childSourceIds = getAllSourceIds(node.children);
          childSourceIds.forEach((childId) => {
            if (sourceSymbols[childId]) {
              if (isChecked) {
                newAllowed.add(childId);
              } else {
                newAllowed.delete(childId);
              }
            }
          });
        }

        return newAllowed;
      });
    },
    []
  ); // No dependencies needed as logic is self-contained

  // Memoize the filtered events list
  const filteredEvents = useMemo(() => {
    return events.filter(
      (event) =>
        allowedSources.has(event.source) && // Check if source is allowed by checkbox tree
        // Remove filterSourceText check
        // (!filterSourceText ||
        //   event.source
        //     .toLowerCase()
        //     .includes(filterSourceText.toLowerCase())) &&
        (!filterName ||
          event.eventName.toLowerCase().includes(filterName.toLowerCase())) // Keep name filter
    );
  }, [events, allowedSources, /* removed filterSourceText */ filterName]);

  // Calculate counts based on the *filtered* events
  const eventsCountBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((event) => {
      counts[event.source] = (counts[event.source] || 0) + 1;
    });
    return counts;
  }, [filteredEvents]); // Recalculate when filtered events change

  const handleClearLog = () => {
    clearLog();
    setHoveredIndex(null); // Clear hover state on log clear
    // Use CommunicationManager for logging user actions if possible/desired
    // CommunicationManager.getInstance().logEvent('GameEventLog', 'clearLogClicked');
    console.log("Clear log clicked"); // Keep console log for basic feedback
  };

  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "10px",
        margin: "10px",
        maxHeight: "500px", // Increased height a bit more for tree
        display: "flex",
        flexDirection: "column",
        fontSize: "0.9em", // Slightly smaller base font
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Game Event Log</h3>

      {/* Main Layout: Filters (Left) | Log (Right) */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "15px",
          flexGrow: 1,
          overflow: "hidden" /* Prevent parent overflow */,
        }}
      >
        {/* Left Column: Filters & Controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            flexBasis: "250px" /* Adjust width as needed */,
            flexShrink: 0,
            borderRight: "1px solid #ccc",
            paddingRight: "15px",
            overflowY: "auto",
          }}
        >
          {/* Event Name Filter */}
          <input
            type="text"
            placeholder="Filter by event name..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            style={{ padding: "5px", minWidth: "180px" }}
          />

          {/* Source Tree Filter */}
          <div
            style={{
              flexGrow: 1, // Allow tree to take available space in column
              minWidth: "200px", // Ensure minimum width
              overflowY: "auto", // Scroll tree if needed
              paddingBottom: "10px", // Space at the bottom
            }}
          >
            <span
              style={{
                fontWeight: "bold",
                marginBottom: "5px",
                display: "block",
              }}
            >
              Filter Sources:
            </span>
            {sourceTreeData.map((node) => (
              <TreeNode
                key={node.id}
                node={node}
                allowedSources={allowedSources}
                onToggle={handleSourceTreeToggle}
                activeSourcesInLog={activeSourcesInLog}
                eventsCountBySource={eventsCountBySource} // Pass down counts
              />
            ))}
            {/* TODO: Add handling for dynamically discovered sources ('Other' category?) */}
          </div>

          {/* Clear Button (at the bottom of left col) */}
          <button
            onClick={handleClearLog}
            style={{
              padding: "5px 10px",
              marginTop: "auto" /* Push to bottom */,
            }}
          >
            Clear Log
          </button>
        </div>

        {/* Right Column: Event List Area */}
        <div
          style={{
            flexGrow: 1,
            overflowY: "auto" /* Make log scrollable */,
            position: "relative" /* Keep for hover */,
          }}
        >
          <ul
            style={{
              listStyle: "none",
              padding: "5px",
              margin: 0,
              // Removed flexGrow, borderTop, paddingTop as they are handled by the parent div
            }}
          >
            {filteredEvents.map((event, index) => (
              <li
                key={`${event.timestamp}-${event.source}-${event.eventName}-${index}`} // Simple key for now
                style={{
                  marginBottom: "3px", // More compact
                  fontSize: "0.9em", // Inherit smaller font
                  borderBottom: "1px dotted #eee", // Dotted line for less visual weight
                  paddingBottom: "2px",
                  position: "relative", // For hover positioning context
                  // Only set cursor to pointer if there's data to show
                  cursor:
                    event.data !== undefined && event.data !== null
                      ? "pointer"
                      : "default",
                }}
                // Only attach hover handlers if there is data
                onMouseEnter={
                  event.data !== undefined && event.data !== null
                    ? () => setHoveredIndex(index)
                    : undefined
                }
                onMouseLeave={
                  event.data !== undefined && event.data !== null
                    ? () => setHoveredIndex(null)
                    : undefined
                }
              >
                {/* Compact Event Line */}
                <span style={{ color: "#888", marginRight: "5px" }}>
                  {/* Calculate and display time since init */}
                  {
                    initializationTime
                      ? formatTimeDifference(
                          event.timestamp,
                          initializationTime
                        )
                      : `[${event.timestamp}]` /* Fallback to original */
                  }
                </span>
                <span
                  title={event.source}
                  style={{
                    marginRight: "5px",
                    display: "inline-block",
                    minWidth: "1.5em",
                    textAlign: "center",
                  }}
                >
                  {getSymbol(event.source)}
                </span>
                <span>
                  {event.eventName}
                  {/* Add asterisk if data payload exists */}
                  {event.data !== undefined && event.data !== null && (
                    <span style={{ color: "#aaa", marginLeft: "3px" }}>*</span>
                  )}
                </span>

                {/* Hover Data Payload */}
                {hoveredIndex === index &&
                  event.data !== undefined &&
                  event.data !== null && (
                    <div
                      style={{
                        position: "absolute",
                        left: "10px", // Position relative to the li
                        top: "100%", // Position below the li
                        backgroundColor: "rgba(248, 248, 248, 0.95)", // Slightly transparent background
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        padding: "5px 8px",
                        marginTop: "2px",
                        fontSize: "0.9em", // Keep consistent small font
                        zIndex: 10, // Ensure it's above other list items
                        maxWidth: "400px", // Prevent excessive width
                        boxShadow: "2px 2px 5px rgba(0,0,0,0.1)",
                        // Ensure preformatted text wraps correctly
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      <pre
                        style={{
                          margin: 0,
                          padding: 0,
                          color: "#333" /* Add dark color for readability */,
                        }}
                      >
                        {JSON.stringify(event.data, null, 2)}
                      </pre>
                    </div>
                  )}
              </li>
            ))}
            {filteredEvents.length === 0 && (
              <li style={{ color: "#888" }}>No events match filters.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

// --- Helper Functions (could be moved to utils if needed) ---

// Helper to format time difference
const formatTimeDifference = (
  eventTimestampStr: string,
  initTime: Date
): string => {
  try {
    const eventTime = new Date(eventTimestampStr);
    const diffMs = eventTime.getTime() - initTime.getTime();
    if (isNaN(diffMs) || diffMs < 0) return `[${eventTimestampStr}]`; // Fallback on parse error or negative diff

    const diffSeconds = diffMs / 1000;
    return `+${diffSeconds.toFixed(3)} s`;
  } catch (e) {
    console.error("Failed to parse event timestamp:", eventTimestampStr, e);
    return `[${eventTimestampStr}]`; // Fallback
  }
};

// (getAllSourceIds is already defined above)
// No other helpers needed for this refactor

// Ensure EventLogEntry type is correctly referenced if needed elsewhere
// export type { EventLogEntry }; // Re-export if needed by other components
