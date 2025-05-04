import React, { useState, useMemo, useEffect, useCallback } from "react";
// Remove EventLogEntry import if context provides it implicitly or type is handled by hook
// import { EventLogEntry } from "./types";
// Restore context import
import { useCommunicationContext } from "./CommunicationContext";

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
  // Remove props from signature
  // Restore context hook
  const { events, clearLog } = useCommunicationContext();

  // Keep other state (filters, hover, etc.)
  const [filterName, setFilterName] = useState("");
  const [allowedSources, setAllowedSources] = useState<Set<string>>(
    new Set(getAllSourceIds(sourceTreeData))
  );
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Keep memos, they now depend on `events` from context
  const initializationTime = useMemo(() => {
    if (events.length === 0) {
      return null;
    }
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
  }, [events]);

  const activeSourcesInLog = useMemo(() => {
    return new Set(events.map((event) => event.source));
  }, [events]);

  // Keep handleSourceTreeToggle callback
  const handleSourceTreeToggle = useCallback(
    (node: SourceTreeNode, isChecked: boolean) => {
      setAllowedSources((prevAllowed) => {
        const newAllowed = new Set(prevAllowed);
        const idsToUpdate = getAllSourceIds([node]);

        idsToUpdate.forEach((id) => {
          if (sourceSymbols[id]) {
            if (isChecked) {
              newAllowed.add(id);
            } else {
              newAllowed.delete(id);
            }
          }
        });

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
  );

  // Keep filteredEvents memo (depends on `events` from context and local filter state)
  const filteredEvents = useMemo(() => {
    return events.filter(
      (event) =>
        allowedSources.has(event.source) &&
        (!filterName ||
          event.eventName.toLowerCase().includes(filterName.toLowerCase()))
    );
  }, [events, allowedSources, filterName]);

  // Keep eventsCountBySource memo (depends on filteredEvents)
  const eventsCountBySource = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((event) => {
      counts[event.source] = (counts[event.source] || 0) + 1;
    });
    return counts;
  }, [filteredEvents]);

  // Restore handleClearLog to use clearLog from context
  const handleClearLog = () => {
    clearLog(); // Use context function
    setHoveredIndex(null);
    console.log("Clear log clicked");
  };

  // Keep the rest of the component rendering logic (JSX)
  return (
    <div
      style={{
        border: "1px solid #ccc",
        padding: "10px",
        margin: "10px",
        maxHeight: "500px",
        display: "flex",
        flexDirection: "column",
        fontSize: "0.9em",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Game Event Log</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "15px",
          flexGrow: 1,
          overflow: "hidden",
        }}
      >
        {/* Left Column: Filters & Controls */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            flexBasis: "250px",
            flexShrink: 0,
            borderRight: "1px solid #ccc",
            paddingRight: "15px",
            overflowY: "auto",
          }}
        >
          <input
            type="text"
            placeholder="Filter by event name..."
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            style={{ padding: "5px", minWidth: "180px" }}
          />
          <div
            style={{
              flexGrow: 1,
              minWidth: "200px",
              overflowY: "auto",
              paddingBottom: "10px",
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
                eventsCountBySource={eventsCountBySource}
              />
            ))}
          </div>
          <button
            onClick={handleClearLog} // Uses context clearLog
            style={{
              padding: "5px 10px",
              marginTop: "auto",
            }}
          >
            Clear Log
          </button>
        </div>
        {/* Right Column: Event List Area */}
        <div
          style={{
            flexGrow: 1,
            overflowY: "auto",
            position: "relative",
          }}
        >
          <ul
            style={{
              listStyle: "none",
              padding: "5px",
              margin: 0,
            }}
          >
            {filteredEvents.map((event, index) => (
              <li
                key={`${event.timestamp}-${event.source}-${event.eventName}-${index}`}
                style={{
                  marginBottom: "3px",
                  fontSize: "0.9em",
                  borderBottom: "1px dotted #eee",
                  paddingBottom: "2px",
                  position: "relative",
                  cursor:
                    event.data !== undefined && event.data !== null
                      ? "pointer"
                      : "default",
                }}
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
                <span style={{ color: "#888", marginRight: "5px" }}>
                  {initializationTime
                    ? formatTimeDifference(event.timestamp, initializationTime)
                    : `[${event.timestamp}]`}
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
                  {event.data !== undefined && event.data !== null && (
                    <span style={{ color: "#aaa", marginLeft: "3px" }}>*</span>
                  )}
                </span>
                {hoveredIndex === index &&
                  event.data !== undefined &&
                  event.data !== null && (
                    <div
                      style={{
                        position: "absolute",
                        left: "10px",
                        top: "100%",
                        backgroundColor: "rgba(248, 248, 248, 0.95)",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        padding: "5px 8px",
                        marginTop: "2px",
                        fontSize: "0.9em",
                        zIndex: 10,
                        maxWidth: "400px",
                        boxShadow: "2px 2px 5px rgba(0,0,0,0.1)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      <pre
                        style={{
                          margin: 0,
                          padding: 0,
                          color: "#333",
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
    if (isNaN(diffMs) || diffMs < 0) return `[${eventTimestampStr}]`;
    const diffSeconds = diffMs / 1000;
    return `+${diffSeconds.toFixed(3)} s`;
  } catch (e) {
    console.error("Failed to parse event timestamp:", eventTimestampStr, e);
    return `[${eventTimestampStr}]`;
  }
};

// (getAllSourceIds is already defined above)
// No other helpers needed for this refactor

// Ensure EventLogEntry type is correctly referenced if needed elsewhere
// export type { EventLogEntry }; // Re-export if needed by other components
