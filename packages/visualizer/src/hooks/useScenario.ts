import { useVisualizerState } from "../VisualizerContext";

/**
 * useScenario - Access and update the current scenario.
 *
 * Example:
 * const { scenario, setScenario } = useScenario();
 * scenario // 'default'
 * setScenario('gravity')
 */
export function useScenario() {
  const { currentScenario, setCurrentScenario } = useVisualizerState();
  return {
    scenario: currentScenario,
    setScenario: setCurrentScenario,
  };
}
