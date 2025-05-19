import React from "react";
import { useSimulationControls } from "../hooks/useSimulationControls";

/**
 * SimulationControls - Play/pause, speed slider, reset button.
 *
 * Example:
 * <SimulationControls />
 */
export const SimulationControls: React.FC = () => {
  const {
    simulationStatus,
    setSimulationStatus,
    simulationSpeed,
    setSimulationSpeed,
  } = useSimulationControls();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button
        onClick={() =>
          setSimulationStatus(
            simulationStatus === "running" ? "paused" : "running"
          )
        }
      >
        {simulationStatus === "running" ? "Pause" : "Play"}
      </button>
      <label>
        Speed:
        <input
          type="range"
          min={0.1}
          max={4}
          step={0.1}
          value={simulationSpeed}
          onChange={(e) => setSimulationSpeed(Number(e.target.value))}
        />
        <span>{simulationSpeed}x</span>
      </label>
      <button
        onClick={() => {
          setSimulationStatus("paused");
          setSimulationSpeed(1);
        }}
      >
        Reset
      </button>
    </div>
  );
};
