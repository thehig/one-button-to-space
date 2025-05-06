import { useState, useCallback, useRef } from "react";
// import type { Position, DraggableData } from "react-rnd"; // Removed unused Rnd specific types

// --- NEW: Define a constant for collapsed height ---
const COLLAPSED_HEIGHT = 50; // Or your desired collapsed height in pixels

// Define an interface for the layout state
// Export the interface
export interface LayoutState {
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
  // Initialize height based on initialCollapsed state
  const [layout, setLayout] = useState<LayoutState>(() => ({
    x: initialX,
    y: initialY,
    width: initialWidth,
    // Set initial height correctly based on collapsed state
    height: initialCollapsed ? COLLAPSED_HEIGHT : initialHeight,
    isLocked: initialLocked,
    isCollapsed: initialCollapsed,
    isDetailsCollapsed: initialDetailsCollapsed,
    zIndex: 1000,
  }));

  // --- NEW: Ref to store height before collapsing ---
  // Use useRef to store the pre-collapse height without causing re-renders on its own change
  const expandedHeightRef = useRef<number>(
    initialCollapsed ? initialHeight : layout.height // Store the intended expanded height initially
  );

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
    setLayout((prev) => {
      const nextIsCollapsed = !prev.isCollapsed;
      let nextHeight: number;

      if (nextIsCollapsed) {
        // Collapsing: Store current height and set to collapsed height
        expandedHeightRef.current = prev.height; // Store the current height
        nextHeight = COLLAPSED_HEIGHT;
      } else {
        // Expanding: Restore the stored height
        nextHeight = expandedHeightRef.current; // Restore the stored expanded height
      }

      return {
        ...prev,
        isCollapsed: nextIsCollapsed,
        height: nextHeight, // Set the new height
      };
    });
  }, []); // No dependencies needed as it only uses the previous state and ref

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
      // --- MODIFICATION: Only update if not collapsed ---
      if (!layout.isLocked && !layout.isCollapsed) {
        const newWidth = parseInt(ref.style.width, 10);
        const newHeight = parseInt(ref.style.height, 10);

        setLayout((prev) => ({
          ...prev,
          width: newWidth,
          height: newHeight,
          ...position,
        }));

        // --- NEW: Update the stored expanded height if resizing when expanded ---
        expandedHeightRef.current = newHeight;

        bringToFront();
      }
      // If it's collapsed, resizing is disabled by <Rnd> anyway, but this adds safety
    },
    [layout.isLocked, layout.isCollapsed, bringToFront] // Add isCollapsed dependency
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
