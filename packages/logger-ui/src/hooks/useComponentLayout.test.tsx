import { renderHook, act } from "@testing-library/react";
import { useComponentLayout } from "./useComponentLayout";

// Mock window dimensions if needed, e.g., for boundary checks later
// Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
// Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

describe("useComponentLayout", () => {
  // Note: The hook uses isCollapsed internally, which is the inverse of the test's original isVisible concept.
  // Default state from hook: initialX=20, initialY=20, initialWidth=600, initialHeight=400, startsOpen=false
  // Default derived state: isCollapsed=true, size={width: 300, height: 50}
  it("should initialize with default values from hook", () => {
    const { result } = renderHook(() => useComponentLayout({}));

    // Check isCollapsed (hook default startsOpen=false -> isCollapsed=true)
    expect(result.current.isCollapsed).toBe(true);
    // Default position from hook
    expect(result.current.position).toEqual({ x: 20, y: 20 });
    // Default size when collapsed
    expect(result.current.size).toEqual({ width: 300, height: 50 });
  });

  it("should initialize with custom initial state", () => {
    const initialProps = {
      // Use individual props as expected by the hook
      initialX: 50,
      initialY: 100,
      initialWidth: 400,
      initialHeight: 250,
      startsOpen: true, // If startsOpen=true, isCollapsed should be false
      // startsLocked: true, // Hook doesn't use startsLocked
    };
    const { result } = renderHook(() => useComponentLayout(initialProps));

    expect(result.current.isCollapsed).toBe(false); // Derived from startsOpen: true
    // expect(result.current.isLocked).toBe(true); // Hook doesn't return isLocked
    expect(result.current.position).toEqual({ x: 50, y: 100 });
    expect(result.current.size).toEqual({ width: 400, height: 250 }); // Uses initial size when startsOpen=true
  });

  it("should initialize with partial custom initial state", () => {
    const initialProps = {
      initialX: 10,
      initialY: 20,
      // startsLocked: true, // Hook doesn't use startsLocked
      startsOpen: true, // Test starting open
    };
    const { result } = renderHook(() => useComponentLayout(initialProps));

    expect(result.current.isCollapsed).toBe(false); // Derived from startsOpen: true
    // expect(result.current.isLocked).toBe(true); // Hook doesn't return isLocked
    expect(result.current.position).toEqual({ x: 10, y: 20 }); // Custom
    expect(result.current.size).toEqual({ width: 600, height: 400 }); // Default size when startsOpen=true
  });

  // --- Tests for toggleCollapse (formerly toggleVisibility) ---
  it("should toggle collapse state using toggleCollapse", () => {
    // Start open (isCollapsed = false)
    const { result } = renderHook(() =>
      useComponentLayout({ startsOpen: true })
    );
    expect(result.current.isCollapsed).toBe(false);

    act(() => {
      result.current.toggleCollapse(); // Use the correct function name
    });
    expect(result.current.isCollapsed).toBe(true);

    act(() => {
      result.current.toggleCollapse(); // Use the correct function name
    });
    expect(result.current.isCollapsed).toBe(false);
  });

  // --- Tests for toggleLock (REMOVED as hook doesn't support locking) ---
  // it('should toggle lock state using toggleLock', () => { ... });

  // --- Tests for handleDragStop ---
  it("should update position on handleDragStop", () => {
    // Start at default 20,20
    const { result } = renderHook(() => useComponentLayout({}));
    const newPosition = { x: 150, y: 250 };

    act(() => {
      result.current.handleDragStop(null as any, {
        x: newPosition.x,
        y: newPosition.y,
      });
    });

    expect(result.current.position).toEqual(newPosition);
  });

  // --- Test for handleDragStop when locked (REMOVED as hook doesn't support locking) ---
  // it('should NOT update position on handleDragStop if locked', () => { ... });

  // --- Tests for handleResizeStop ---
  it("should update size on handleResizeStop", () => {
    // Start open (isCollapsed=false) to have initial non-collapsed size
    const initialWidth = 600;
    const initialHeight = 400;
    const { result } = renderHook(() =>
      useComponentLayout({ startsOpen: true, initialWidth, initialHeight })
    );
    const newSize = { width: 500, height: 350 };
    const delta = {
      width: newSize.width - initialWidth,
      height: newSize.height - initialHeight,
    };
    const position = { x: 20, y: 20 }; // Default initial position

    act(() => {
      const mockRef = {
        style: { width: `${newSize.width}px`, height: `${newSize.height}px` },
      } as HTMLElement;
      result.current.handleResizeStop(
        null as any,
        "bottomRight" as any,
        mockRef,
        delta,
        position // Pass the current position
      );
    });

    expect(result.current.size).toEqual(newSize);
  });

  // --- Test for handleResizeStop when locked (REMOVED as hook doesn't support locking) ---
  // it('should NOT update size on handleResizeStop if locked', () => { ... });

  // Add more tests for boundary checks later...
  // Add tests for toggleFilterCollapse and toggleDetailsCollapse...

  // --- Tests for toggleFilterCollapse ---
  it("should toggle filter collapse state using toggleFilterCollapse", () => {
    // Hook defaults startTreeOpen=false -> isFilterCollapsed=true
    const { result } = renderHook(() => useComponentLayout({}));
    expect(result.current.isFilterCollapsed).toBe(true);

    act(() => {
      result.current.toggleFilterCollapse();
    });
    expect(result.current.isFilterCollapsed).toBe(false);

    act(() => {
      result.current.toggleFilterCollapse();
    });
    expect(result.current.isFilterCollapsed).toBe(true);
  });

  // --- Tests for toggleDetailsCollapse ---
  it("should toggle details collapse state using toggleDetailsCollapse", () => {
    // Hook defaults startDataOpen=false -> isDetailsCollapsed=true
    const { result } = renderHook(() => useComponentLayout({}));
    expect(result.current.isDetailsCollapsed).toBe(true);

    act(() => {
      result.current.toggleDetailsCollapse();
    });
    expect(result.current.isDetailsCollapsed).toBe(false);

    act(() => {
      result.current.toggleDetailsCollapse();
    });
    expect(result.current.isDetailsCollapsed).toBe(true);
  });
});
