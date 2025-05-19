import React from "react";
import { useCamera } from "../hooks/useCamera";

/**
 * CameraControls - Pan (arrows), zoom (slider), reset button.
 *
 * Example:
 * <CameraControls />
 */
export const CameraControls: React.FC = () => {
  const { camera, setCamera } = useCamera();
  const pan = (dx: number, dy: number) =>
    setCamera({ ...camera, x: camera.x + dx, y: camera.y + dy });
  const zoom = (z: number) => setCamera({ ...camera, zoom: z });
  const reset = () => setCamera({ x: 0, y: 0, zoom: 1 });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={() => pan(-10, 0)}>←</button>
      <button onClick={() => pan(10, 0)}>→</button>
      <button onClick={() => pan(0, -10)}>↑</button>
      <button onClick={() => pan(0, 10)}>↓</button>
      <label>
        Zoom:
        <input
          type="range"
          min={0.1}
          max={4}
          step={0.1}
          value={camera.zoom}
          onChange={(e) => zoom(Number(e.target.value))}
        />
        <span>{camera.zoom}x</span>
      </label>
      <button onClick={reset}>Reset</button>
    </div>
  );
};
