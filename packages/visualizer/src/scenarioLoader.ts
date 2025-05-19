// scenarioLoader.ts
// Dynamically loads all scenarios from the shared physics engine
import { scenariosToRun } from "@obts/shared/physics/scenarios";

export interface ScenarioMeta {
  id: string;
  name: string;
}

/**
 * ALL_SCENARIOS: Array of all available scenarios with id and name.
 * Use this for scenario selection and lookup.
 */
export const ALL_SCENARIOS: ScenarioMeta[] = scenariosToRun.map((entry) => ({
  id: entry.scenario.id,
  name: entry.scenario.name,
}));
