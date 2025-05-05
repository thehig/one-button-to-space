import { useState, useCallback } from "react";
// import type { Position, DraggableData } from "react-rnd"; // Removed unused Rnd specific types

// Define an interface for the layout state
interface LayoutState {
  x: number;
  y: number;
  width: number;
  height: number;
  isLocked: boolean;
  isCollapsed: boolean;
  isDetailsCollapsed: boolean;
  zIndex: number;
}

// Define interface for initial props
interface UseComponentLayoutProps {
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  initialLocked?: boolean;
  initialCollapsed?: boolean;
  initialDetailsCollapsed?: boolean;
}

export const useComponentLayout = ({
  initialX = 10,
  initialY = 10,
  initialWidth = 300, // Default width
  initialHeight = 200, // Default height
  initialLocked = false,
  initialCollapsed = false,
  initialDetailsCollapsed = false,
}: UseComponentLayoutProps = {}) => {
  const [layout, setLayout] = useState<LayoutState>(() => ({
    x: initialX,
    y: initialY,
    width: initialWidth,
    height: initialHeight,
    isLocked: initialLocked,
    isCollapsed: initialCollapsed,
    isDetailsCollapsed: initialDetailsCollapsed,
    zIndex: 1000, // Default zIndex
  }));

  const updateLayout = useCallback((updates: Partial<LayoutState>) => {
    setLayout((prev) => ({ ...prev, ...updates }));
  }, []);

  // Bring to front logic
  const bringToFront = useCallback(() => {
    // Example: Find max zIndex among other components (needs external state access or context)
    // For now, just incrementing a high number
    setLayout((prev) => ({ ...prev, zIndex: Date.now() })); // Simple way to get a high number
  }, []);

  // Toggle lock state
  const toggleLock = useCallback(() => {
    setLayout((prev) => ({ ...prev, isLocked: !prev.isLocked }));
  }, []);

  // Toggle collapse state
  const toggleCollapse = useCallback(() => {
    setLayout((prev) => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  }, []);

  // Toggle details collapse state
  const toggleDetailsCollapse = useCallback(() => {
    setLayout((prev) => ({
      ...prev,
      isDetailsCollapsed: !prev.isDetailsCollapsed,
    }));
  }, []);

  // Handle drag stop from react-rnd
  // Define types for react-rnd event handlers if possible
  // Using unknown for now as specific DraggableEvent/Data might be complex
  const handleDragStop = useCallback(
    (e: unknown, d: { x: number; y: number }) => {
      if (!layout.isLocked) {
        setLayout((prev) => ({ ...prev, x: d.x, y: d.y }));
        bringToFront();
      }
    },
    [layout.isLocked, bringToFront]
  );

  // Handle resize stop from react-rnd
  const handleResizeStop = useCallback(
    (
      e: unknown,
      direction: unknown, // Type this based on react-rnd specifics
      ref: { style: { width: string; height: string } },
      delta: unknown, // Type this based on react-rnd specifics
      position: { x: number; y: number }
    ) => {
      if (!layout.isLocked) {
        setLayout((prev) => ({
          ...prev,
          width: parseInt(ref.style.width, 10),
          height: parseInt(ref.style.height, 10),
          ...position, // Update position based on resize result
        }));
        bringToFront();
      }
    },
    [layout.isLocked, bringToFront]
  );

  return {
    layout,
    setLayout: updateLayout, // Expose the specific update function
    bringToFront,
    toggleLock,
    toggleCollapse,
    toggleDetailsCollapse,
    handleDragStop,
    handleResizeStop,
    // Expose individual states for easier consumption if needed
    isLocked: layout.isLocked,
    isCollapsed: layout.isCollapsed,
    isDetailsCollapsed: layout.isDetailsCollapsed,
  };
};
