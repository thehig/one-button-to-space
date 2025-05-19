export interface ScenarioCardDef {
  id: string;
  type: "simulationControls" | "cameraControls" | "infoPanel" | "custom";
  title: string;
  props?: Record<string, unknown>;
}

/**
 * DEFAULT_CARDS: Used as fallback for all scenarios unless a custom layout is provided.
 * Does NOT include the scenario picker card.
 */
export const DEFAULT_CARDS: ScenarioCardDef[] = [
  { id: "sim", type: "simulationControls", title: "Simulation" },
  { id: "camera", type: "cameraControls", title: "Camera" },
  {
    id: "info",
    type: "infoPanel",
    title: "Info",
    props: { info: { objects: 0, time: 0, status: "ready" } },
  },
];

/**
 * scenarioCardLayout: Add custom layouts for specific scenario IDs here if needed.
 * If a scenario is not present, DEFAULT_CARDS will be used.
 * Do NOT include the scenario picker card here.
 */
export const scenarioCardLayout: Record<string, ScenarioCardDef[]> = {
  // Example:
  // "some-scenario-id": [ ...custom cards... ],
};
