import { renderHook, act } from "@testing-library/react";
import useComponentLayout from "./useComponentLayout";

// Mock window dimensions if needed, e.g., for boundary checks later
// Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
// Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });

describe("useComponentLayout", () => {
  it("should initialize with default values", () => {
    const { result } = renderHook(() => useComponentLayout({}));

    expect(result.current.isVisible).toBe(true);
    expect(result.current.isLocked).toBe(false);
    expect(result.current.position).toEqual({ x: 0, y: 0 }); // Assuming default is 0,0
    expect(result.current.size).toEqual({ width: 300, height: 200 }); // Assuming default size
  });

  it("should initialize with custom initial state", () => {
    const initialProps = {
      initialPosition: { x: 50, y: 100 },
      initialSize: { width: 400, height: 250 },
      startsOpen: false,
      startsLocked: true,
    };
    const { result } = renderHook(() => useComponentLayout(initialProps));

    expect(result.current.isVisible).toBe(false);
    expect(result.current.isLocked).toBe(true);
    expect(result.current.position).toEqual({ x: 50, y: 100 });
    expect(result.current.size).toEqual({ width: 400, height: 250 });
  });

  it("should initialize with partial custom initial state", () => {
    const initialProps = {
      initialPosition: { x: 10, y: 20 },
      startsLocked: true,
    };
    const { result } = renderHook(() => useComponentLayout(initialProps));

    expect(result.current.isVisible).toBe(true); // Default
    expect(result.current.isLocked).toBe(true); // Custom
    expect(result.current.position).toEqual({ x: 10, y: 20 }); // Custom
    expect(result.current.size).toEqual({ width: 300, height: 200 }); // Default
  });

  // --- Tests for toggleVisibility ---
  it("should toggle visibility using toggleVisibility", () => {
    const { result } = renderHook(() =>
      useComponentLayout({ startsOpen: true })
    );

    act(() => {
      result.current.toggleVisibility();
    });
    expect(result.current.isVisible).toBe(false);

    act(() => {
      result.current.toggleVisibility();
    });
    expect(result.current.isVisible).toBe(true);
  });

  // --- Tests for toggleLock ---
  it("should toggle lock state using toggleLock", () => {
    const { result } = renderHook(() =>
      useComponentLayout({ startsLocked: false })
    );

    act(() => {
      result.current.toggleLock();
    });
    expect(result.current.isLocked).toBe(true);

    act(() => {
      result.current.toggleLock();
    });
    expect(result.current.isLocked).toBe(false);
  });

  // --- Tests for handleDragStop ---
  it("should update position on handleDragStop", () => {
    const { result } = renderHook(() => useComponentLayout({}));
    const newPosition = { x: 150, y: 250 };

    act(() => {
      // Simulate the event data structure provided by react-rnd
      result.current.handleDragStop(null as any, {
        x: newPosition.x,
        y: newPosition.y,
      });
    });

    expect(result.current.position).toEqual(newPosition);
  });

  it("should NOT update position on handleDragStop if locked", () => {
    const initialPosition = { x: 10, y: 10 };
    const { result } = renderHook(() =>
      useComponentLayout({ initialPosition, startsLocked: true })
    );
    const newPosition = { x: 150, y: 250 };

    act(() => {
      result.current.handleDragStop(null as any, {
        x: newPosition.x,
        y: newPosition.y,
      });
    });

    expect(result.current.position).toEqual(initialPosition); // Position should remain unchanged
  });

  // --- Tests for handleResizeStop ---
  it("should update size on handleResizeStop", () => {
    const { result } = renderHook(() => useComponentLayout({}));
    const newSize = { width: 500, height: 400 };
    const delta = { width: 200, height: 200 }; // Change from default 300x200
    const position = { x: 0, y: 0 }; // Assuming initial position is 0,0

    act(() => {
      // Simulate the event data structure provided by react-rnd
      // ref, direction, and delta are key for resize
      const mockRef = {
        style: { width: `${newSize.width}px`, height: `${newSize.height}px` },
      } as HTMLElement;
      result.current.handleResizeStop(
        null as any,
        "bottomRight" as any,
        mockRef,
        delta,
        position
      );
    });

    expect(result.current.size).toEqual(newSize);
  });

  it("should NOT update size on handleResizeStop if locked", () => {
    const initialSize = { width: 300, height: 200 };
    const { result } = renderHook(() =>
      useComponentLayout({ initialSize, startsLocked: true })
    );
    const newSize = { width: 500, height: 400 };
    const delta = { width: 200, height: 200 };
    const position = { x: 0, y: 0 };

    act(() => {
      const mockRef = {
        style: { width: `${newSize.width}px`, height: `${newSize.height}px` },
      } as HTMLElement;
      result.current.handleResizeStop(
        null as any,
        "bottomRight" as any,
        mockRef,
        delta,
        position
      );
    });

    expect(result.current.size).toEqual(initialSize); // Size should remain unchanged
  });

  // Add more tests for boundary checks later...
});
