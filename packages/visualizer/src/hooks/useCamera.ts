import { useVisualizerState, CameraState } from "../VisualizerContext";

/**
 * useCamera - Access and update camera state (position and zoom).
 *
 * Example:
 * const { camera, setCamera } = useCamera();
 * camera // { x: 0, y: 0, zoom: 1 }
 * setCamera({ x: 10, y: 5, zoom: 2 })
 */
export function useCamera() {
  const { camera, setCamera } = useVisualizerState();
  return { camera, setCamera };
}
