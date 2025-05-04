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
import type { RndDragCallback, RndResizeCallback } from "react-rnd"; // Adjust based on actual exports
// Remove necessary components and hooks from dnd-kit
// import { DndContext, useDraggable, DragEndEvent } from "@dnd-kit/core";
// import { CSS } from "@dnd-kit/utilities";
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
  const { events, clearLog } = useCommunicationContext();

  // --- Draggable State ---
  const [position, setPosition] = useState({ x: 20, y: 20 });
  // --- Size State ---
  const [size, setSize] = useState({ width: 550, height: 400 }); // Initial size

  // State for collapse
  const [isCollapsed, setIsCollapsed] = useState(false);
  // State to remember the width before collapsing
  const [lastExpandedWidth, setLastExpandedWidth] = useState(size.width);

  // State for filter column collapse
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(false);

  // State for details column collapse
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(false);

  // Keep other state (filters, hover, etc.)
  const [filterName, setFilterName] = useState("");
  const [allowedSources, setAllowedSources] = useState<Set<string>>(
    new Set(getAllSourceIds(sourceTreeData))
  );
  const [selectedEventIndex, setSelectedEventIndex] = useState<number | null>(
    null
  );

  // Ref for the draggable element - Not directly needed by useDraggable in the same way,
  // but can still be useful for other DOM manipulations if required.
  // const nodeRef = useRef(null);
  // const { attributes, listeners, setNodeRef, transform } = useDraggable({
  //   id: draggableId,
  // });

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
    setSelectedEventIndex(null);
    console.log("Clear log clicked");
  };

  // Toggle collapse state
  const toggleCollapse = () => {
    const newCollapsedState = !isCollapsed;

    if (newCollapsedState) {
      // Store current width before collapsing
      setLastExpandedWidth(size.width);
    }

    // Set new size based on collapse state
    setSize((prevSize) => ({
      width: newCollapsedState ? 200 : lastExpandedWidth, // Collapse to 200px, expand to remembered width
      height: newCollapsedState
        ? 50
        : prevSize.height < 200
        ? 400
        : prevSize.height, // Set to minHeight or restore previous/default height
    }));
    setIsCollapsed(newCollapsedState);
  };

  // Transform style for dnd-kit
  // const style = transform
  //   ? {
  //       transform: CSS.Translate.toString(transform),
  //     }
  //   : undefined;

  // Keep the rest of the component rendering logic (JSX)
  // Wrap the draggable element with DndContext
  return (
    <Rnd
      size={{ width: size.width, height: size.height }}
      position={{ x: position.x, y: position.y }}
      style={{
        zIndex: 1000, // Ensure it stays on top
        border: "1px solid #ccc",
        backgroundColor: "rgba(64, 64, 64, 0.9)",
        borderRadius: "5px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        opacity: isCollapsed ? 0.7 : 1, // Make semi-transparent when collapsed
        // Let Rnd handle positioning, remove absolute/left/top from here
      }}
      dragHandleClassName="drag-handle" // Specify the class for the drag handle
      minWidth={250} // Set a reasonable minimum width
      minHeight={isCollapsed ? 50 : 200} // Adjust min height based on collapse state
      enableResizing={!isCollapsed} // Disable resizing when collapsed
      onDragStop={(e, d) => {
        setPosition({ x: d.x, y: d.y });
      }}
      // Update size state on resize stop
      onResizeStop={(e, direction, ref, delta, position) => {
        setSize({
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
        });
        // Also update the remembered expanded width if resizing while expanded
        if (!isCollapsed) {
          setLastExpandedWidth(parseInt(ref.style.width, 10));
        }
        // Also update position if resize moves the element
        setPosition(position);
      }}
      bounds="window" // Keep within viewport
    >
      {/* Remove Draggable wrapper */}
      {/* <Draggable handle=".drag-handle" nodeRef={nodeRef}> */}
      {/* Use a class for the handle */}
      <div
        // ref={setNodeRef} // Remove dnd-kit ref
        style={{
          // Basic positioning styles (can be enhanced)
          // Remove positioning/border/bg/shadow styles managed by Rnd wrapper
          width: isCollapsed ? "auto" : "100%", // Let Rnd control width, take 100% internally
          height: isCollapsed ? "auto" : "100%", // Adjust height based on collapse state
          display: "flex",
          flexDirection: "column",
          fontSize: "0.9em",
          // Remove hardcoded right/top
          // right: "20px",
          // top: "20px",
          overflow: "hidden",
          // ...style, // Apply the transform style from dnd-kit
        }}
        // Spread the listeners onto the element itself if the whole div is draggable
        // {...listeners}
        // {...attributes}
      >
        {/* Header for Title, Collapse Button, and Drag Handle */}
        <div
          className="drag-handle" // Assign the handle class for Rnd
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "5px 10px",
            backgroundColor: "#242424",
            borderBottom: "1px solid #242424",
            cursor: "grab", // Change cursor to indicate draggable area
            borderTopLeftRadius: "5px",
            borderTopRightRadius: "5px",
            touchAction: "none", // Recommended for better mobile dragging
          }}
          // Spread listeners/attributes onto the handle div if only header should drag
          // {...listeners}
          // {...attributes}
        >
          <h3 style={{ margin: 0, fontSize: "1em" }}>Game Event Log</h3>
          <button
            onClick={toggleCollapse}
            style={{ padding: "2px 8px", cursor: "pointer" }}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? "➕" : "➖"} {/* Simple icons */}
          </button>
        </div>

        {/* Collapsible Content Area */}
        {!isCollapsed && (
          <div
            style={{
              padding: "10px", // Apply padding only when expanded
              display: "flex",
              flexDirection: "row",
              gap: "15px",
              flexGrow: 1,
              overflow: "hidden", // Keep hidden, inner columns will scroll
              height: "calc(100% - 40px)", // Fill remaining height after header (adjust 40px if header height changes)
            }}
          >
            {/* Filter Collapse Toggle Button (Moved Outside Left Column) */}
            <button
              onClick={() => setIsFilterCollapsed(!isFilterCollapsed)}
              style={{
                padding: "2px 5px",
                cursor: "pointer",
                height: "fit-content", // Prevent stretching vertically
                alignSelf: "center", // Center vertically in the gap
                margin: "0 5px", // Add some horizontal space
                transform: isFilterCollapsed
                  ? "rotate(180deg)"
                  : "rotate(0deg)",
                transition: "transform 0.3s ease",
                border: "none", // Optional: make it look less like a standard button
                background: "transparent", // Optional
                fontSize: "1.2em", // Make arrow slightly larger
              }}
              title={isFilterCollapsed ? "Expand Filters" : "Collapse Filters"}
            >
              {"<"}
            </button>

            {/* Left Column: Filters & Controls */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                flexShrink: 0, // Correct: Don't shrink
                flexGrow: 0, // Correct: Don't grow
                flexBasis: isFilterCollapsed ? "0px" : "auto", // Correct: Width based on content when expanded
                // minWidth removed, flex-basis:auto handles content width
                paddingRight: isFilterCollapsed ? "0px" : "10px",
                borderRight: isFilterCollapsed ? "none" : "1px solid #eee",
                overflowY: "auto",
                overflowX: "hidden", // Keep hidden as requested
                transition:
                  "width 0.3s ease, padding 0.3s ease, min-width 0.3s ease, flex-basis 0.3s ease", // Correct transition value
              }}
            >
              {/* Conditionally Render Filter Content */}
              {!isFilterCollapsed && (
                <>
                  <input
                    type="text"
                    placeholder="Filter by event name..."
                    value={filterName}
                    onChange={(e) => setFilterName(e.target.value)}
                    style={{ padding: "5px" }}
                  />
                  <div
                    style={{
                      flexGrow: 1,
                      overflowY: "auto",
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
                    onClick={handleClearLog}
                    style={{
                      padding: "5px 10px",
                      marginTop: "auto",
                    }}
                  >
                    Clear Log
                  </button>
                </>
              )}
            </div>

            {/* Center Column: Event List Area (Renamed from Right) */}
            <div
              style={{
                flexBasis: "auto", // Correct: Base size on content
                flexShrink: 0, // Correct: Prevent shrinking below content width
                flexGrow: isDetailsCollapsed ? 1 : 0, // CHANGE: Grow only if Details are collapsed
                overflowY: "auto",
                position: "relative",
                height: "100%", // Explicitly fill parent height
                borderRight: "1px solid #eee", // Separator
              }}
            >
              <ul
                style={{
                  listStyle: "none",
                  padding: "0 5px", // Adjust padding
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
                    onClick={
                      event.data !== undefined && event.data !== null
                        ? () =>
                            setSelectedEventIndex(
                              index === selectedEventIndex ? null : index
                            )
                        : undefined
                    }
                  >
                    <span style={{ color: "#888", marginRight: "5px" }}>
                      {initializationTime
                        ? formatTimeDifference(
                            event.timestamp,
                            initializationTime
                          )
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
                      {/* Restore asterisk indicator */}
                      {event.data !== undefined && event.data !== null && (
                        <span style={{ color: "#aaa", marginLeft: "3px" }}>
                          *
                        </span>
                      )}
                    </span>
                  </li>
                ))}
                {filteredEvents.length === 0 && (
                  <li style={{ color: "#888" }}>No events match filters.</li>
                )}
              </ul>
            </div>

            {/* Details Collapse Toggle Button (New) */}
            <button
              onClick={() => setIsDetailsCollapsed(!isDetailsCollapsed)}
              style={{
                padding: "2px 5px",
                cursor: "pointer",
                height: "fit-content", // Prevent stretching vertically
                alignSelf: "center", // Center vertically in the gap
                margin: "0 5px", // Add some horizontal space
                transform: isDetailsCollapsed
                  ? "rotate(0deg)"
                  : "rotate(180deg)", // Point right when collapsed, left when expanded
                transition: "transform 0.3s ease",
                border: "none",
                background: "transparent",
                fontSize: "1.2em",
              }}
              title={isDetailsCollapsed ? "Expand Details" : "Collapse Details"}
            >
              {"<"}
            </button>

            {/* Right Column: Selected Event Details (Now Collapsible) */}
            <div
              style={{
                flexGrow: isDetailsCollapsed ? 0 : 1, // Correct: Grow when expanded
                flexBasis: isDetailsCollapsed ? "0px" : "0%", // Correct: Start at 0% basis when expanded
                flexShrink: 1, // Correct: Allow shrinking
                minWidth: isDetailsCollapsed ? "0px" : "0px", // CHANGE: Remove minWidth when expanded, rely on flexbox
                overflowY: "auto",
                overflowX: "hidden", // Explicitly hide horizontal overflow
                height: "100%",
                paddingLeft: isDetailsCollapsed ? "0px" : "10px", // Collapse padding
                fontSize: "0.85em",
                backgroundColor: "#2e2e2e", // Slightly different background for details
                transition:
                  "width 0.3s ease, padding 0.3s ease, min-width 0.3s ease, flex-basis 0.3s ease", // Smooth transition
              }}
            >
              {/* Conditionally render content only when not collapsed to avoid layout shifts */}
              {!isDetailsCollapsed && (
                <>
                  {selectedEventIndex !== null &&
                  filteredEvents[selectedEventIndex]?.data !== undefined ? (
                    <pre
                      style={{
                        margin: 0,
                        padding: "5px",
                        color: "#f0f0f0", // Light text on dark background
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                      }}
                    >
                      {JSON.stringify(
                        filteredEvents[selectedEventIndex].data,
                        null,
                        2
                      )}
                    </pre>
                  ) : (
                    <div
                      style={{
                        color: "#888",
                        padding: "5px",
                        fontStyle: "italic",
                      }}
                    >
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
      {/* </Draggable> */}
    </Rnd>
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
