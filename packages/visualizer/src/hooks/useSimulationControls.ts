import { useVisualizerState } from "../VisualizerContext";

/**
 * useSimulationControls - Access and update simulation status and speed.
 *
 * Example:
 * const { simulationStatus, setSimulationStatus, simulationSpeed, setSimulationSpeed } = useSimulationControls();
 * simulationStatus // 'paused'
 * setSimulationStatus('running')
 * simulationSpeed // 1
 * setSimulationSpeed(2)
 */
export function useSimulationControls() {
  const {
    simulationStatus,
    setSimulationStatus,
    simulationSpeed,
    setSimulationSpeed,
  } = useVisualizerState();
  return {
    simulationStatus,
    setSimulationStatus,
    simulationSpeed,
    setSimulationSpeed,
  };
}
