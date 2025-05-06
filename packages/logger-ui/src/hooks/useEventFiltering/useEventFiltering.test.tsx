import { renderHook, act } from "@testing-library/react";
import { useEventFiltering } from "./useEventFiltering";
import type { EventLogEntry, SourceTreeNode } from "../../types"; // Assuming types are in ../types

// Mock Data
const mockEvents: EventLogEntry[] = [
  {
    timestamp: new Date(1678886400000).toISOString(),
    source: "PhysicsManager",
    eventName: "Init",
    data: { setting: "gravity", value: 9.8 },
  },
  {
    timestamp: new Date(1678886401000).toISOString(),
    source: "EntityManager",
    eventName: "EntityCreated",
    data: { entityId: "player1", type: "Player" },
  },
  {
    timestamp: new Date(1678886402000).toISOString(),
    source: "InputManager",
    eventName: "KeyDown",
    data: { key: "ArrowUp" },
  },
  {
    timestamp: new Date(1678886403000).toISOString(),
    source: "PhysicsManager",
    eventName: "CollisionStart",
    data: { bodyA: "player1", bodyB: "wall" },
  },
  {
    timestamp: new Date(1678886404000).toISOString(),
    source: "NetworkManager",
    eventName: "StateUpdate",
    data: { latency: 50 },
  },
];

const mockAllSourceIds = [
  "PhysicsManager",
  "EntityManager",
  "InputManager",
  "NetworkManager",
];

// Mock SourceTreeNode - needed for handleSourceTreeToggle tests later
// You might need a more complex structure depending on your actual config
const mockSourceTreeRoot: SourceTreeNode = {
  id: "root",
  label: "All Sources",
  children: [
    { id: "PhysicsManager", label: "Physics" },
    { id: "EntityManager", label: "Entities" },
    { id: "InputManager", label: "Input" },
    { id: "NetworkManager", label: "Network" },
  ],
};

// --- Mock Data for Nested Test ---
const mockNestedSourceIds = [
  "PhysicsManager",
  "PhysicsManager.Collisions",
  "PhysicsManager.Forces",
  "EntityManager",
  "InputManager",
];

const mockNestedEvents: EventLogEntry[] = [
  {
    timestamp: new Date(1).toISOString(),
    source: "PhysicsManager",
    eventName: "Init",
    data: {},
  },
  {
    timestamp: new Date(2).toISOString(),
    source: "PhysicsManager.Collisions",
    eventName: "CollisionStart",
    data: {},
  },
  {
    timestamp: new Date(3).toISOString(),
    source: "PhysicsManager.Collisions",
    eventName: "CollisionEnd",
    data: {},
  },
  {
    timestamp: new Date(4).toISOString(),
    source: "PhysicsManager.Forces",
    eventName: "ApplyForce",
    data: {},
  },
  {
    timestamp: new Date(5).toISOString(),
    source: "EntityManager",
    eventName: "EntityCreated",
    data: {},
  },
  {
    timestamp: new Date(6).toISOString(),
    source: "InputManager",
    eventName: "KeyDown",
    data: {},
  },
];

const mockNestedSourceTree: SourceTreeNode[] = [
  {
    id: "PhysicsManager",
    label: "Physics",
    children: [
      { id: "PhysicsManager.Collisions", label: "Collisions" },
      { id: "PhysicsManager.Forces", label: "Forces" },
    ],
  },
  { id: "EntityManager", label: "Entities" },
  { id: "InputManager", label: "Input" },
  { id: "NetworkManager", label: "Network" },
];
// --- End Mock Data for Nested Test ---

describe("useEventFiltering", () => {
  it("should initialize with no filters applied", () => {
    const { result } = renderHook(() =>
      useEventFiltering(mockEvents, mockAllSourceIds)
    );

    // Initial state checks
    expect(result.current.filterName).toBe("");
    expect(result.current.allowedSources).toEqual(new Set(mockAllSourceIds));
    expect(result.current.filteredEvents).toEqual(mockEvents); // Initially, all events should pass
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 2,
      EntityManager: 1,
      InputManager: 1,
      NetworkManager: 1,
    });
  });

  // --- Tests for text filtering ---
  it("should filter events by eventName (case-insensitive)", () => {
    const { result } = renderHook(() =>
      useEventFiltering(mockEvents, mockAllSourceIds)
    );

    act(() => {
      result.current.setFilterName("init");
    });

    expect(result.current.filterName).toBe("init");
    expect(result.current.filteredEvents).toHaveLength(1);
    expect(result.current.filteredEvents[0].eventName).toBe("Init");
    expect(result.current.filteredEvents[0].source).toBe("PhysicsManager");
    // Check counts after filtering
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 1, // Only the 'Init' event remains
      EntityManager: 0,
      InputManager: 0,
      NetworkManager: 0,
    });

    // Test case-insensitivity
    act(() => {
      result.current.setFilterName("COLLISIONSTART");
    });

    expect(result.current.filterName).toBe("COLLISIONSTART");
    expect(result.current.filteredEvents).toHaveLength(1);
    expect(result.current.filteredEvents[0].eventName).toBe("CollisionStart");
    expect(result.current.filteredEvents[0].source).toBe("PhysicsManager");
    // Check counts after filtering
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 1, // Only the 'CollisionStart' event remains
      EntityManager: 0,
      InputManager: 0,
      NetworkManager: 0,
    });
  });

  it("should return all events when text filter is cleared", () => {
    const { result } = renderHook(() =>
      useEventFiltering(mockEvents, mockAllSourceIds)
    );

    // Apply a filter first
    act(() => {
      result.current.setFilterName("KeyDown");
    });
    expect(result.current.filteredEvents).toHaveLength(1);

    // Clear the filter
    act(() => {
      result.current.setFilterName("");
    });

    expect(result.current.filterName).toBe("");
    expect(result.current.filteredEvents).toHaveLength(mockEvents.length);
    expect(result.current.filteredEvents).toEqual(mockEvents);
    // Check counts are back to original
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 2,
      EntityManager: 1,
      InputManager: 1,
      NetworkManager: 1,
    });
  });

  // --- Tests for source filtering (handleSourceTreeToggle) ---
  it("should filter events by source using handleSourceTreeToggle", () => {
    const { result } = renderHook(() =>
      useEventFiltering(mockEvents, mockAllSourceIds)
    );

    // Find the node to toggle (e.g., PhysicsManager)
    const physicsNode = mockSourceTreeRoot.children?.find(
      (node) => node.id === "PhysicsManager"
    );
    expect(physicsNode).toBeDefined();
    if (!physicsNode) return; // Type guard

    // --- Disable PhysicsManager ---
    act(() => {
      result.current.handleSourceTreeToggle(physicsNode, false); // isChecked = false
    });

    // Check allowedSources
    const expectedSourcesAfterDisable = new Set(mockAllSourceIds);
    expectedSourcesAfterDisable.delete("PhysicsManager");
    expect(result.current.allowedSources).toEqual(expectedSourcesAfterDisable);

    // Check filteredEvents
    expect(result.current.filteredEvents).toHaveLength(3); // 2 Physics events removed
    result.current.filteredEvents.forEach((event) => {
      expect(event.source).not.toBe("PhysicsManager");
    });

    // Check counts
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 0, // Disabled
      EntityManager: 1,
      InputManager: 1,
      NetworkManager: 1,
    });

    // --- Re-enable PhysicsManager ---
    act(() => {
      result.current.handleSourceTreeToggle(physicsNode, true); // isChecked = true
    });

    // Check allowedSources (back to original)
    expect(result.current.allowedSources).toEqual(new Set(mockAllSourceIds));

    // Check filteredEvents (back to original)
    expect(result.current.filteredEvents).toHaveLength(mockEvents.length);
    expect(result.current.filteredEvents).toEqual(mockEvents);

    // Check counts (back to original)
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 2,
      EntityManager: 1,
      InputManager: 1,
      NetworkManager: 1,
    });
  });

  // TODO: Add test for toggling parent node and descendant effects
  it("should handle toggling parent source node and affect descendants", () => {
    const { result } = renderHook(() =>
      useEventFiltering(mockNestedEvents, mockNestedSourceIds)
    );

    // Find the parent node (PhysicsManager)
    const physicsParentNode = mockNestedSourceTree.find(
      (node) => node.id === "PhysicsManager"
    );
    expect(physicsParentNode).toBeDefined();
    if (!physicsParentNode) return;

    // --- Disable PhysicsManager (Parent) ---
    act(() => {
      result.current.handleSourceTreeToggle(physicsParentNode, false); // isChecked = false
    });

    // Check allowedSources (Parent and descendants should be removed)
    const expectedSourcesAfterDisable = new Set([
      // "PhysicsManager", // Removed
      // "PhysicsManager.Collisions", // Removed
      // "PhysicsManager.Forces", // Removed
      "EntityManager",
      "InputManager",
    ]);
    expect(result.current.allowedSources).toEqual(expectedSourcesAfterDisable);

    // Check filteredEvents (Only non-Physics events remain)
    expect(result.current.filteredEvents).toHaveLength(2);
    expect(result.current.filteredEvents[0].source).toBe("EntityManager");
    expect(result.current.filteredEvents[1].source).toBe("InputManager");

    // --- Re-enable PhysicsManager (Parent) ---
    act(() => {
      result.current.handleSourceTreeToggle(physicsParentNode, true); // isChecked = true
    });

    // Check allowedSources (back to original)
    expect(result.current.allowedSources).toEqual(new Set(mockNestedSourceIds));

    // Check filteredEvents (back to original)
    expect(result.current.filteredEvents).toHaveLength(mockNestedEvents.length);
    // Sort results for consistent comparison
    const sortedResult = [...result.current.filteredEvents].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const sortedExpected = [...mockNestedEvents].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    expect(sortedResult).toEqual(sortedExpected);
  });

  // --- Tests for combined filtering ---
  it("should handle combined text and source filtering", () => {
    const { result } = renderHook(() =>
      useEventFiltering(mockEvents, mockAllSourceIds)
    );

    // 1. Apply text filter ("start")
    act(() => {
      result.current.setFilterName("start");
    });
    // Should match: PhysicsManager/CollisionStart
    expect(result.current.filteredEvents).toHaveLength(1);
    expect(result.current.filteredEvents[0].eventName).toBe("CollisionStart");

    // 2. Disable the source of the matched event (PhysicsManager)
    const physicsNode = mockSourceTreeRoot.children?.find(
      (node) => node.id === "PhysicsManager"
    );
    expect(physicsNode).toBeDefined();
    if (!physicsNode) return;

    act(() => {
      result.current.handleSourceTreeToggle(physicsNode, false);
    });

    // Now, no events should match both filters
    expect(result.current.filteredEvents).toHaveLength(0);

    // Check counts (all 0 for sources that had events)
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 0,
      EntityManager: 0,
      InputManager: 0,
      NetworkManager: 0,
    });

    // 3. Re-enable the source (PhysicsManager)
    act(() => {
      result.current.handleSourceTreeToggle(physicsNode, true);
    });

    // Should go back to only text filter matching
    expect(result.current.filteredEvents).toHaveLength(1);
    expect(result.current.filteredEvents[0].eventName).toBe("CollisionStart");
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 1, // CollisionStart
      EntityManager: 0,
      InputManager: 0,
      NetworkManager: 0,
    });

    // 4. Clear text filter
    act(() => {
      result.current.setFilterName("");
    });

    // Should return to initial state (all events, all sources enabled)
    expect(result.current.filteredEvents).toEqual(mockEvents);
    expect(result.current.allowedSources).toEqual(new Set(mockAllSourceIds));
    expect(result.current.eventsCountBySource).toEqual({
      PhysicsManager: 2,
      EntityManager: 1,
      InputManager: 1,
      NetworkManager: 1,
    });
  });
});
