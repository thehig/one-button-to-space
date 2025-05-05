import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest"; // Import Vitest's mocking utility
import { TreeNode } from "./TreeNode";
import type { TreeNodeProps } from "./TreeNode";
import type { SourceTreeNode } from "./types";

// --- Mock Data ---
const simpleNode: SourceTreeNode = {
  id: "SourceA",
  label: "Source A", // Use label instead of name
};

const nestedNode: SourceTreeNode = {
  id: "ParentSource",
  label: "Parent Source", // Use label instead of name
  children: [
    { id: "ChildSource1", label: "Child 1" }, // Use label instead of name
    {
      id: "ChildSource2",
      label: "Child 2", // Use label instead of name
      children: [{ id: "Grandchild", label: "GC" }], // Use label instead of name
    },
  ],
};

const mockAllowedSources = new Set(["SourceA", "ChildSource1", "Grandchild"]);
const mockActiveSources = new Set([
  "SourceA",
  "ChildSource1",
  "ChildSource2",
  "Grandchild",
]);
const mockFilteredCounts = { SourceA: 5, ChildSource1: 2, Grandchild: 1 }; // Counts after filtering
const mockTotalCounts: Record<string, number> = {
  SourceA: 10,
  ChildSource1: 3,
  ChildSource2: 4,
  Grandchild: 1,
}; // Total counts

const mockOnToggle = vi.fn();

// Helper to render with default props, allowing overrides
const renderTreeNode = (props: Partial<TreeNodeProps> = {}) => {
  const defaultProps: TreeNodeProps = {
    node: simpleNode,
    allowedSources: mockAllowedSources,
    onToggle: mockOnToggle,
    activeSourcesInLog: mockActiveSources,
    eventsCountBySource: mockFilteredCounts,
    totalEventsCountBySource: mockTotalCounts,
  };
  return render(<TreeNode {...defaultProps} {...props} />);
};

// --- Tests ---
describe("TreeNode Component", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockOnToggle.mockClear();
  });

  it("should render a simple node with its ID and total count", () => {
    renderTreeNode({ node: simpleNode });

    // Check if the node ID is displayed
    expect(screen.getByText(simpleNode.id)).toBeInTheDocument();

    // Check if the total count is displayed correctly (sum of node + descendants)
    const expectedTotalCount = mockTotalCounts[simpleNode.id] || 0;
    expect(screen.getByText(`(${expectedTotalCount})`)).toBeInTheDocument();
  });

  it("should render nested nodes correctly", () => {
    renderTreeNode({ node: nestedNode });

    // Check parent node
    expect(screen.getByText(nestedNode.id)).toBeInTheDocument();
    const expectedParentTotal =
      (mockTotalCounts["ParentSource"] || 0) +
      (mockTotalCounts["ChildSource1"] || 0) +
      (mockTotalCounts["ChildSource2"] || 0) +
      (mockTotalCounts["Grandchild"] || 0);
    expect(screen.getByText(`(${expectedParentTotal})`)).toBeInTheDocument();

    // Check direct children
    expect(screen.getByText("ChildSource1")).toBeInTheDocument();
    expect(screen.getByText("ChildSource2")).toBeInTheDocument();

    // Check grandchild (might be nested visually)
    expect(screen.getByText("Grandchild")).toBeInTheDocument();
  });

  // --- Checkbox State Tests ---
  it("should render checkbox as checked if node and all relevant descendants are allowed", () => {
    // SourceA has count > 0, is in allowedSources
    renderTreeNode({ node: simpleNode, allowedSources: new Set(["SourceA"]) });
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();
    expect(checkbox).not.toBePartiallyChecked(); // Vitest/jest-dom uses this for indeterminate
  });

  it("should render checkbox as unchecked if node and all relevant descendants are not allowed", () => {
    // SourceA has count > 0, but NOT in allowedSources
    renderTreeNode({ node: simpleNode, allowedSources: new Set() }); // Empty set
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(checkbox).not.toBePartiallyChecked();
  });

  it("should render checkbox as indeterminate if some relevant descendants are allowed", () => {
    // ParentSource itself isn't in mockTotalCounts, but children ChildSource1 & Grandchild are.
    // We allow ChildSource1 and Grandchild, but not ChildSource2 (which also has counts).
    const partialAllowed = new Set(["ChildSource1", "Grandchild"]);
    renderTreeNode({
      node: nestedNode,
      allowedSources: partialAllowed,
      // Ensure all descendants have total counts > 0 to be relevant
      totalEventsCountBySource: {
        ChildSource1: 1,
        ChildSource2: 1,
        Grandchild: 1,
      },
      // Ensure active status doesn't interfere
      activeSourcesInLog: new Set([
        "ChildSource1",
        "ChildSource2",
        "Grandchild",
      ]),
    });
    // Scope the search to the specific label for the parent node
    const parentLabel = screen
      .getByText(nestedNode.id, { exact: false })
      .closest("label");
    expect(parentLabel).toBeInTheDocument();
    if (!parentLabel) return; // Type guard

    const checkbox = within(parentLabel).getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toBePartiallyChecked(); // Check for indeterminate
  });

  // --- Interaction Tests ---
  it("should call onToggle with correct arguments when checkbox is clicked", async () => {
    const user = userEvent.setup();
    // Start with SourceA unchecked
    // Get rerender function from the initial render
    const { rerender } = renderTreeNode({
      node: simpleNode,
      allowedSources: new Set(),
    });

    // Find the specific label and checkbox for simpleNode
    const labelUnchecked = screen
      .getByText(simpleNode.id, { exact: false })
      .closest("label");
    expect(labelUnchecked).toBeInTheDocument();
    if (!labelUnchecked) return;
    const checkboxUnchecked = within(labelUnchecked).getByRole("checkbox");

    expect(checkboxUnchecked).not.toBeChecked();

    // Click to check
    await user.click(checkboxUnchecked);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith(simpleNode, true); // node, isChecked=true

    mockOnToggle.mockClear(); // Clear previous calls

    // Re-render the SAME component instance with SourceA checked using rerender
    const newProps: TreeNodeProps = {
      node: simpleNode,
      allowedSources: new Set(["SourceA"]),
      onToggle: mockOnToggle, // Keep the same mock
      // Include other required props from default
      activeSourcesInLog: mockActiveSources,
      eventsCountBySource: mockFilteredCounts,
      totalEventsCountBySource: mockTotalCounts,
    };
    rerender(<TreeNode {...newProps} />);

    // Find the label and checkbox again within the updated component
    const labelChecked = screen
      .getByText(simpleNode.id, { exact: false })
      .closest("label"); // Should find the same label element
    expect(labelChecked).toBeInTheDocument();
    if (!labelChecked) return;
    const checkboxChecked = within(labelChecked).getByRole("checkbox");

    expect(checkboxChecked).toBeChecked();

    // Click to uncheck
    await user.click(checkboxChecked);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
    expect(mockOnToggle).toHaveBeenCalledWith(simpleNode, false); // node, isChecked=false
  });

  // --- Styling/Attribute Tests ---
  it("should disable checkbox if node and descendants are not relevant", () => {
    const irrelevantNode: SourceTreeNode = { id: "Irrelevant", label: "Nope" }; // Use label instead of name
    renderTreeNode({
      node: irrelevantNode,
      allowedSources: new Set(),
      activeSourcesInLog: new Set(["SomeOtherSource"]), // Ensure node isn't active
      eventsCountBySource: {}, // No filtered counts
      totalEventsCountBySource: {}, // No total counts
    });

    const label = screen.getByText(irrelevantNode.id).closest("label");
    expect(label).toBeInTheDocument();
    if (!label) return;
    const checkbox = within(label).getByRole("checkbox");
    expect(checkbox).toBeDisabled();
  });

  it("should apply active styles when node or descendant is active and has filtered counts", () => {
    // SourceA is active, allowed, and has filtered counts
    renderTreeNode({
      node: simpleNode,
      allowedSources: new Set(["SourceA"]),
      activeSourcesInLog: new Set(["SourceA"]),
      eventsCountBySource: { SourceA: 5 }, // Has filtered count
      totalEventsCountBySource: { SourceA: 10 },
    });

    const label = screen.getByText(simpleNode.id).closest("label");
    expect(label).toBeInTheDocument();
    if (!label) return;

    // Check for active styles (bold, not greyed out)
    expect(label).toHaveStyle("font-weight: bold");
    expect(label).not.toHaveStyle("color: #999");
    expect(label).not.toHaveStyle("opacity: 0.6");
  });

  it("should apply inactive styles when node and descendants are not active", () => {
    // SourceA has counts but is NOT active in the log
    renderTreeNode({
      node: simpleNode,
      allowedSources: new Set(["SourceA"]),
      activeSourcesInLog: new Set(["SomeOtherSource"]), // SourceA not active
      eventsCountBySource: { SourceA: 5 },
      totalEventsCountBySource: { SourceA: 10 },
    });

    const label = screen.getByText(simpleNode.id).closest("label");
    expect(label).toBeInTheDocument();
    if (!label) return;

    // Check for inactive styles (greyed out)
    expect(label).toHaveStyle("color: #999");
    expect(label).toHaveStyle("opacity: 0.6");
    // Should *still* be bold if inactive but has filtered counts
    expect(label).toHaveStyle("font-weight: bold");
  });

  it("should NOT apply bold style if node is active but has zero filtered count", () => {
    // SourceA is active, but has no filtered events
    renderTreeNode({
      node: simpleNode,
      allowedSources: new Set(["SourceA"]),
      activeSourcesInLog: new Set(["SourceA"]), // Active
      eventsCountBySource: { SourceA: 0 }, // Zero filtered count
      totalEventsCountBySource: { SourceA: 10 },
    });

    const label = screen.getByText(simpleNode.id).closest("label");
    expect(label).toBeInTheDocument();
    if (!label) return;

    // Should be active (not grey) but not bold
    expect(label).not.toHaveStyle("color: #999");
    expect(label).not.toHaveStyle("opacity: 0.6");
    expect(label).toHaveStyle("font-weight: normal");
  });
});
