import React from "react";
// import { useSimulationControls } from "../hooks/useSimulationControls"; // Will be replaced
import { useVisualizerState } from "../VisualizerContext";

/**
 * SimulationControls - Play/pause, speed slider, reset button.
 *
 * Example:
 * <SimulationControls />
 */
export const SimulationControls: React.FC = () => {
  // const {
  //   simulationStatus,
  //   setSimulationStatus,
  //   simulationSpeed,
  //   setSimulationSpeed,
  // } = useSimulationControls(); // Old hook replaced

  const {
    isPlaying,
    play,
    pause,
    speed,
    setSpeed,
    reset,
    // scenario, // For context if needed for reset logic, though reset() should handle it
  } = useVisualizerState();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={() => {
          if (isPlaying) {
            pause();
          } else {
            play();
          }
        }}
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <label>
        Speed:
        <input
          type="range"
          min={0.1} // Consider if min should be 1, or if physics engine handles <1 speeds gracefully
          max={4} // Max speed from usePhysicsEngine is 10, can adjust here if desired
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        <span>{speed}x</span>
      </label>
      <button
        onClick={() => {
          reset(); // Directly call the reset from the physics engine hook
        }}
      >
        Reset
      </button>
    </div>
  );
};
