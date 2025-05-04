import React, { useEffect } from "react";
import {
  SourceTreeNode,
  getAllSourceIds,
  sourceSymbols,
} from "./GameEventLogConfig"; // Adjust path if needed

// --- TreeNode Component for Hierarchical Filter ---
export interface TreeNodeProps {
  node: SourceTreeNode;
  allowedSources: Set<string>;
  onToggle: (node: SourceTreeNode, isChecked: boolean) => void;
  activeSourcesInLog: Set<string>; // Sources currently present in the unfiltered log
  eventsCountBySource: Record<string, number>; // New prop: Counts per source in filtered log
}

export const TreeNode: React.FC<TreeNodeProps> = ({
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
  const relevantIds = nodeAndChildrenIds.filter(
    (id: string) => sourceSymbols[id]
  );

  if (relevantIds.length > 0) {
    const checkedCount = relevantIds.filter((id: string) =>
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
    const checkedChildCount = childSourceIds.filter((id: string) =>
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
  const isNodeActive = nodeAndChildrenIds.some((id: string) =>
    activeSourcesInLog.has(id)
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
                (sum: number, id: string) =>
                  sum + (eventsCountBySource[id] || 0),
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
          {node.children?.map((child: SourceTreeNode) => (
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
