import React, { useEffect, useMemo, useRef } from "react";
import { SourceTreeNode } from "./types"; // Only import the type

// --- Helper function to get all descendant IDs (including self) ---
const getAllDescendantIds = (node: SourceTreeNode): string[] => {
  let ids = [node.id];
  if (node.children) {
    node.children.forEach((child) => {
      ids = ids.concat(getAllDescendantIds(child));
    });
  }
  return ids;
};

// --- TreeNode Component for Hierarchical Filter ---
export interface TreeNodeProps {
  node: SourceTreeNode;
  allowedSources: Set<string>;
  onToggle: (node: SourceTreeNode, isChecked: boolean) => void;
  activeSourcesInLog: Set<string>; // Sources currently present in the unfiltered log
  eventsCountBySource: Record<string, number>; // Counts per source in *filtered* log
  totalEventsCountBySource: Record<string, number>; // Counts per source in *unfiltered* log
}

export const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  allowedSources,
  onToggle,
  activeSourcesInLog,
  eventsCountBySource,
  totalEventsCountBySource,
}) => {
  const isParent = !!node.children && node.children.length > 0;

  // Get all IDs for this node and its descendants directly from the node prop
  const nodeAndDescendantIds = useMemo(() => getAllDescendantIds(node), [node]);

  // Filter to only include IDs that actually have events logged against them
  // (These are the only ones relevant for filtering state)
  const relevantIds = useMemo(
    () =>
      nodeAndDescendantIds.filter(
        (id) =>
          eventsCountBySource[id] !== undefined || activeSourcesInLog.has(id)
      ),
    [nodeAndDescendantIds, eventsCountBySource, activeSourcesInLog]
  );

  // Determine checkbox state based on relevant IDs and allowedSources prop
  const checkboxState = useMemo<
    "checked" | "unchecked" | "indeterminate"
  >(() => {
    if (relevantIds.length === 0) {
      // If no relevant descendants (or self), it cannot be checked or indeterminate
      return "unchecked";
    }

    const checkedCount = relevantIds.filter((id) =>
      allowedSources.has(id)
    ).length;

    if (checkedCount === relevantIds.length) {
      return "checked";
    } else if (checkedCount > 0) {
      return "indeterminate";
    } else {
      return "unchecked";
    }
  }, [relevantIds, allowedSources]);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onToggle(node, e.target.checked);
  };

  // Ref for indeterminate state
  const checkboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.checked = checkboxState === "checked";
      checkboxRef.current.indeterminate = checkboxState === "indeterminate";
    }
  }, [checkboxState]);

  // Determine if the node (or any descendant) is active in the log
  const isNodeOrDescendantActive = useMemo(
    () => nodeAndDescendantIds.some((id) => activeSourcesInLog.has(id)),
    [nodeAndDescendantIds, activeSourcesInLog]
  );

  // Calculate total count for this node and its descendants based on FILTERED events (for highlighting)
  const filteredCount = useMemo(
    () =>
      nodeAndDescendantIds.reduce(
        (sum, id) => sum + (eventsCountBySource[id] || 0),
        0
      ),
    [nodeAndDescendantIds, eventsCountBySource]
  );

  // Calculate display count for this node and its descendants based on UNFILTERED events (for display)
  const displayCount = useMemo(
    () =>
      nodeAndDescendantIds.reduce(
        (sum, id) => sum + (totalEventsCountBySource[id] || 0),
        0
      ),
    [nodeAndDescendantIds, totalEventsCountBySource]
  );

  return (
    <div
      style={{
        marginLeft: isParent ? "0px" : "20px",
        overflowX: "hidden",
      }}
    >
      {" "}
      {/* Indent children */}
      <label
        style={{
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          marginBottom: "3px",
          // Apply greyed-out style if node (or its children) have no FILTERED events
          fontWeight: filteredCount > 0 ? "bold" : "normal",
          color: isNodeOrDescendantActive ? "inherit" : "#999",
          opacity: isNodeOrDescendantActive ? 1 : 0.6,
        }}
        title={node.id} // Show ID on hover for clarity if needed
      >
        <input
          ref={checkboxRef}
          type="checkbox"
          onChange={handleCheckboxChange}
          style={{ marginRight: "5px" }}
          disabled={relevantIds.length === 0} // Disable checkbox if no relevant sources
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
        {node.id} {/* Display ID directly since label is optional */}
        {/* Display Count based on UNFILTERED logs */}
        <span style={{ marginLeft: "5px", fontSize: "0.9em", color: "#777" }}>
          ({displayCount})
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
          {node.children?.map((child: SourceTreeNode) => (
            <TreeNode
              key={child.id}
              node={child}
              allowedSources={allowedSources}
              onToggle={onToggle}
              activeSourcesInLog={activeSourcesInLog}
              eventsCountBySource={eventsCountBySource} // Pass down counts
              totalEventsCountBySource={totalEventsCountBySource} // Pass down total counts
            />
          ))}
        </div>
      )}
    </div>
  );
};
