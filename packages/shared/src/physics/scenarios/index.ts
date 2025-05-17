import type { IScenario } from "./types";

// Import each scenario module.
// Note: The variable names used here for import (e.g., eccentricOrbitModule) are just for intermediate holding.
// We will access the actual scenario object from the named export within each module.

import * as eccentricOrbitModule from "./eccentric-orbit.scenario.ts";
import * as orbitSmallBodyModule from "./orbit-small-body.scenario.ts";
import * as orbitLargeBodyModule from "./orbit-large-body.scenario.ts";
import * as atmosphericHeatingModule from "./atmospheric-heating.scenario.ts";
import * as gravityPullSmallBodyModule from "./gravity-pull-small-body.scenario.ts";
import * as gravityPullVeryLargeBodyModule from "./gravity-pull-very-large-body.scenario.ts";
import * as gravityPullLargeBodyModule from "./gravity-pull-large-body.scenario.ts";
import * as denseAtmosphereDragModule from "./dense-atmosphere-drag.scenario.ts";
import * as atmosphericDragModule from "./atmospheric-drag.scenario.ts";
import * as rotationModule from "./rotation.scenario.ts";
import * as thrustModule from "./thrust.scenario.ts";
import * as determinismModule from "./determinism.scenario.ts";

interface ScenarioModule {
  // This is a flexible type, assuming each module exports at least one IScenario
  [key: string]: IScenario | any;
}

const modules: Record<string, ScenarioModule> = {
  eccentricOrbit: eccentricOrbitModule,
  orbitSmallBody: orbitSmallBodyModule,
  orbitLargeBody: orbitLargeBodyModule,
  atmosphericHeating: atmosphericHeatingModule,
  gravityPullSmallBody: gravityPullSmallBodyModule,
  gravityPullVeryLargeBody: gravityPullVeryLargeBodyModule,
  gravityPullLargeBody: gravityPullLargeBodyModule,
  denseAtmosphereDrag: denseAtmosphereDragModule,
  atmosphericDrag: atmosphericDragModule,
  rotation: rotationModule,
  thrust: thrustModule,
  determinism: determinismModule,
};

export const scenariosMap: Map<string, IScenario> = new Map();

for (const moduleKey in modules) {
  const scenarioModule = modules[moduleKey];
  let foundScenario: IScenario | null = null;
  let scenarioNameForMap = moduleKey; // Default name for map

  for (const exportKey in scenarioModule) {
    if (Object.prototype.hasOwnProperty.call(scenarioModule, exportKey)) {
      const exportedItem = scenarioModule[exportKey];
      // Heuristic to find the IScenario object: check for id and initialBodies properties.
      if (
        exportedItem &&
        typeof exportedItem === "object" &&
        "id" in exportedItem &&
        "description" in exportedItem &&
        "initialBodies" in exportedItem &&
        "simulationSteps" in exportedItem
      ) {
        foundScenario = exportedItem as IScenario;
        // Prefer scenario's own ID for the map key if it's unique and simple
        if (foundScenario.id && !scenariosMap.has(foundScenario.id)) {
          scenarioNameForMap = foundScenario.id;
        } else if (scenariosMap.has(scenarioNameForMap)) {
          // if moduleKey (e.g. "determinism") is already taken, append exportKey
          scenarioNameForMap = `${moduleKey}_${exportKey}`;
        }
        break;
      }
    }
  }

  if (foundScenario) {
    if (scenariosMap.has(scenarioNameForMap)) {
      console.warn(
        `Scenario key "${scenarioNameForMap}" conflict. Overwriting. Module: ${moduleKey}`
      );
    }
    scenariosMap.set(scenarioNameForMap, foundScenario);
  } else {
    console.warn(`No IScenario object found in module: ${moduleKey}`);
  }
}

if (scenariosMap.size === 0) {
  console.warn(
    "No scenarios were loaded into scenariosMap. Check exports in *.scenario.ts files and the logic in scenarios/index.ts"
  );
}
