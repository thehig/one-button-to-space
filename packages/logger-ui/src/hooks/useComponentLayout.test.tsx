import { renderHook, act } from "@testing-library/react";
import { useComponentLayout, LayoutState } from "./useComponentLayout";

// Mock window dimensions if needed, e.g., for boundary checks later
// Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
// Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

describe("useComponentLayout", () => {
  // Default state from hook: initialX=10, initialY=10, initialWidth=300, initialHeight=200, initialCollapsed=false
  it("should initialize with default values from hook", () => {
    const { result } = renderHook(() => useComponentLayout({}));

    // Default is now not collapsed
    expect(result.current.isCollapsed).toBe(false);
    // Default position from hook
    expect(result.current.layout.x).toEqual(10);
    expect(result.current.layout.y).toEqual(10);
    // Default size
    expect(result.current.layout.width).toEqual(300);
    expect(result.current.layout.height).toEqual(200);
    // Default lock/details states
    expect(result.current.isLocked).toBe(false);
    expect(result.current.isDetailsCollapsed).toBe(false);
  });

  it("should initialize with custom initial state", () => {
    const initialProps = {
      initialX: 50,
      initialY: 100,
      initialWidth: 400,
      initialHeight: 250,
      initialLocked: true,
      initialCollapsed: true,
      initialDetailsCollapsed: true,
    };
    const { result } = renderHook(() => useComponentLayout(initialProps));

    expect(result.current.isCollapsed).toBe(true);
    expect(result.current.isLocked).toBe(true);
    expect(result.current.isDetailsCollapsed).toBe(true);
    expect(result.current.layout.x).toEqual(50);
    expect(result.current.layout.y).toEqual(100);
    expect(result.current.layout.width).toEqual(400);
    expect(result.current.layout.height).toEqual(250);
  });

  it("should initialize with partial custom initial state", () => {
    const initialProps = {
      initialX: 15,
      initialY: 25,
      initialLocked: true, // Test starting locked
    };
    const { result } = renderHook(() => useComponentLayout(initialProps));

    expect(result.current.isCollapsed).toBe(false); // Default
    expect(result.current.isLocked).toBe(true); // Custom
    expect(result.current.isDetailsCollapsed).toBe(false); // Default
    expect(result.current.layout.x).toEqual(15); // Custom
    expect(result.current.layout.y).toEqual(25); // Custom
    expect(result.current.layout.width).toEqual(300); // Default
    expect(result.current.layout.height).toEqual(200); // Default
  });

  // --- Tests for toggleCollapse --- uses top-level isCollapsed
  it("should toggle collapse state using toggleCollapse", () => {
    const { result } = renderHook(() => useComponentLayout({})); // Starts not collapsed
    expect(result.current.isCollapsed).toBe(false);

    act(() => {
      result.current.toggleCollapse();
    });
    expect(result.current.isCollapsed).toBe(true);

    act(() => {
      result.current.toggleCollapse();
    });
    expect(result.current.isCollapsed).toBe(false);
  });

  // --- Tests for toggleLock --- uses top-level isLocked
  it("should toggle lock state using toggleLock", () => {
    const { result } = renderHook(() => useComponentLayout({})); // Starts unlocked
    expect(result.current.isLocked).toBe(false);

    act(() => {
      result.current.toggleLock();
    });
    expect(result.current.isLocked).toBe(true);

    act(() => {
      result.current.toggleLock();
    });
    expect(result.current.isLocked).toBe(false);
  });

  // --- Tests for handleDragStop --- uses layout.x/y
  it("should update position on handleDragStop", () => {
    const { result } = renderHook(() => useComponentLayout({}));
    const newPosition = { x: 150, y: 250 };

    act(() => {
      // Simulate react-rnd event data structure
      result.current.handleDragStop(null as unknown, {
        x: newPosition.x,
        y: newPosition.y,
      });
    });

    expect(result.current.layout.x).toEqual(newPosition.x);
    expect(result.current.layout.y).toEqual(newPosition.y);
  });

  it("should NOT update position on handleDragStop if locked", () => {
    const initialX = 10,
      initialY = 10;
    const { result } = renderHook(() =>
      useComponentLayout({ initialX, initialY, initialLocked: true })
    );
    const newPosition = { x: 150, y: 250 };

    act(() => {
      result.current.handleDragStop(null as unknown, {
        x: newPosition.x,
        y: newPosition.y,
      });
    });

    // Position should remain unchanged
    expect(result.current.layout.x).toEqual(initialX);
    expect(result.current.layout.y).toEqual(initialY);
  });

  // --- Tests for handleResizeStop --- uses layout.width/height and layout.x/y from position update
  it("should update size and position on handleResizeStop", () => {
    const { result } = renderHook(() =>
      useComponentLayout({ initialX: 10, initialY: 10 })
    );
    const newSize = { width: 500, height: 350 };
    const newPosition = { x: 5, y: 5 }; // Resize can change position

    act(() => {
      // Simulate react-rnd event data structure
      const mockRef = {
        style: { width: `${newSize.width}px`, height: `${newSize.height}px` },
      } as { style: { width: string; height: string } }; // Cast for type safety
      result.current.handleResizeStop(
        null as unknown,
        "bottomRight" as unknown,
        mockRef,
        null as unknown, // Delta not used in current hook logic
        newPosition
      );
    });

    expect(result.current.layout.width).toEqual(newSize.width);
    expect(result.current.layout.height).toEqual(newSize.height);
    expect(result.current.layout.x).toEqual(newPosition.x);
    expect(result.current.layout.y).toEqual(newPosition.y);
  });

  it("should NOT update size or position on handleResizeStop if locked", () => {
    const initialWidth = 300,
      initialHeight = 200,
      initialX = 10,
      initialY = 10;
    const { result } = renderHook(() =>
      useComponentLayout({
        initialX,
        initialY,
        initialWidth,
        initialHeight,
        initialLocked: true,
      })
    );
    const newSize = { width: 500, height: 350 };
    const newPosition = { x: 5, y: 5 };

    act(() => {
      const mockRef = {
        style: { width: `${newSize.width}px`, height: `${newSize.height}px` },
      } as { style: { width: string; height: string } };
      result.current.handleResizeStop(
        null as unknown,
        "bottomRight" as unknown,
        mockRef,
        null as unknown,
        newPosition
      );
    });

    // Size and Position should remain unchanged
    expect(result.current.layout.width).toEqual(initialWidth);
    expect(result.current.layout.height).toEqual(initialHeight);
    expect(result.current.layout.x).toEqual(initialX);
    expect(result.current.layout.y).toEqual(initialY);
  });

  // --- Tests for toggleDetailsCollapse --- uses top-level isDetailsCollapsed
  it("should toggle details collapse state using toggleDetailsCollapse", () => {
    const { result } = renderHook(() => useComponentLayout({})); // Starts not collapsed
    expect(result.current.isDetailsCollapsed).toBe(false);

    act(() => {
      result.current.toggleDetailsCollapse();
    });
    expect(result.current.isDetailsCollapsed).toBe(true);

    act(() => {
      result.current.toggleDetailsCollapse();
    });
    expect(result.current.isDetailsCollapsed).toBe(false);
  });

  // Test case: Position update when dimensions change (via setLayout)
  // This test might be redundant if direct toggle/drag/resize tests pass
  it("should reflect width/height changes made via setLayout", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { result, rerender } = renderHook(() =>
      useComponentLayout({ initialWidth: 100, initialHeight: 50 })
    );

    act(() => {
      result.current.setLayout({ width: 200, height: 100 }); // Use Partial<LayoutState>
    });

    expect(result.current.layout.width).toBe(200);
    expect(result.current.layout.height).toBe(100);
  });

  // Test case: Handling no initial dimensions - check defaults
  it("should handle missing initial dimensions gracefully by using defaults", () => {
    const { result } = renderHook(() => useComponentLayout({}));
    expect(result.current.layout.width).toBe(300); // Default
    expect(result.current.layout.height).toBe(200); // Default
    expect(result.current.layout.x).toBe(10); // Default
    expect(result.current.layout.y).toBe(10); // Default
  });

  // Test case: Ensuring setLayout updates state correctly
  it("should update layout state via setLayout", () => {
    const { result } = renderHook(() => useComponentLayout({}));
    const partialUpdate = { x: 50, y: 50, width: 150, height: 75 };
    const expectedState: LayoutState = {
      ...result.current.layout, // Start with current state (includes defaults)
      ...partialUpdate, // Apply the updates
    };

    act(() => {
      result.current.setLayout(partialUpdate);
    });

    expect(result.current.layout).toEqual(expectedState);
  });

  // Test using toggleLock was added above

  // Test using toggleDetailsCollapse was added above
});
