import { useState, useCallback } from "react";
import type { Position, DraggableData } from "react-rnd"; // Import Rnd specific types

// Define the props the hook accepts
interface UseComponentLayoutProps {
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  startsOpen?: boolean;
  startTreeOpen?: boolean;
  startDataOpen?: boolean;
}

// Define the return type of the hook
interface UseComponentLayoutResult {
  position: Position;
  size: { width: number | string; height: number | string }; // Rnd uses number | string
  isCollapsed: boolean;
  isFilterCollapsed: boolean;
  isDetailsCollapsed: boolean;
  toggleCollapse: () => void;
  toggleFilterCollapse: () => void;
  toggleDetailsCollapse: () => void;
  handleDragStop: (e: any, d: DraggableData) => void; // Use DraggableData type
  handleResizeStop: (
    e: any,
    direction: any,
    ref: HTMLElement,
    delta: any,
    newPosition: Position
  ) => void;
}

export const useComponentLayout = ({
  initialX = 20,
  initialY = 20,
  initialWidth = 600,
  initialHeight = 400,
  startsOpen = false,
  startTreeOpen = false,
  startDataOpen = false,
}: UseComponentLayoutProps): UseComponentLayoutResult => {
  const [position, setPosition] = useState<Position>({
    x: initialX,
    y: initialY,
  });
  const [isCollapsed, setIsCollapsed] = useState(!startsOpen);
  const [size, setSize] = useState({
    width: initialWidth,
    height: isCollapsed ? 50 : initialHeight, // Adjust initial height based on startsOpen
  });
  const [lastExpandedWidth, setLastExpandedWidth] = useState(initialWidth);
  const [isFilterCollapsed, setIsFilterCollapsed] = useState(!startTreeOpen);
  const [isDetailsCollapsed, setIsDetailsCollapsed] = useState(!startDataOpen);

  const toggleCollapse = useCallback(() => {
    const newCollapsedState = !isCollapsed;

    if (newCollapsedState) {
      // Store current width before collapsing
      setLastExpandedWidth(
        typeof size.width === "string" ? parseInt(size.width, 10) : size.width
      );
    }

    // Set new size based on collapse state
    setSize((prevSize) => ({
      width: newCollapsedState ? 200 : lastExpandedWidth,
      height: newCollapsedState
        ? 50
        : (typeof prevSize.height === "string"
            ? parseInt(prevSize.height, 10)
            : prevSize.height) < 200
        ? initialHeight // Expand back to initial height if it was too small
        : prevSize.height,
    }));
    setIsCollapsed(newCollapsedState);
  }, [isCollapsed, size.width, lastExpandedWidth, initialHeight]);

  const toggleFilterCollapse = useCallback(() => {
    setIsFilterCollapsed((prev) => !prev);
  }, []);

  const toggleDetailsCollapse = useCallback(() => {
    setIsDetailsCollapsed((prev) => !prev);
  }, []);

  const handleDragStop = useCallback((e: any, d: DraggableData) => {
    setPosition({ x: d.x, y: d.y });
  }, []);

  const handleResizeStop = useCallback(
    (
      e: any,
      direction: any,
      ref: HTMLElement,
      delta: any,
      newPosition: Position
    ) => {
      const newWidth = parseInt(ref.style.width, 10);
      const newHeight = parseInt(ref.style.height, 10);
      setSize({
        width: newWidth,
        height: newHeight,
      });
      // Also update the remembered expanded width if resizing while expanded
      if (!isCollapsed) {
        setLastExpandedWidth(newWidth);
      }
      // Also update position as resizing can change it
      setPosition(newPosition);
    },
    [isCollapsed] // Dependency on isCollapsed to update lastExpandedWidth correctly
  );

  return {
    position,
    size,
    isCollapsed,
    isFilterCollapsed,
    isDetailsCollapsed,
    toggleCollapse,
    toggleFilterCollapse,
    toggleDetailsCollapse,
    handleDragStop,
    handleResizeStop,
  };
};
