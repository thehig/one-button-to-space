import { IScenario } from "./types";

import { atmosphericDragScenario } from "./scenarios/atmospheric-drag.scenario";
import { atmosphericHeatingScenario } from "./scenarios/atmospheric-heating.scenario";
import { denseAtmosphereDragScenario } from "./scenarios/dense-atmosphere-drag.scenario";
import { determinismBaseScenario } from "./scenarios/determinism.scenario";
import { eccentricOrbitScenario } from "./scenarios/eccentric-orbit.scenario";
import { gravityPullLargeBodyScenario } from "./scenarios/gravity-pull-large-body.scenario";
import { gravityPullSmallBodyScenario } from "./scenarios/gravity-pull-small-body.scenario";
import { gravityPullVeryLargeBodyScenario } from "./scenarios/gravity-pull-very-large-body.scenario";
import { orbitLargeBodyScenario } from "./scenarios/orbit-large-body.scenario";
import { orbitSmallBodyScenario } from "./scenarios/orbit-small-body.scenario";
import { rotationScenario } from "./scenarios/rotation.scenario";
import { thrustScenario } from "./scenarios/thrust.scenario";

export interface ScenarioEntry {
  scenario: IScenario;
  baseSnapshotName: string;
}

export const scenariosToRun: ScenarioEntry[] = [
  {
    scenario: atmosphericDragScenario,
    baseSnapshotName: atmosphericDragScenario.id,
  },
  {
    scenario: atmosphericHeatingScenario,
    baseSnapshotName: atmosphericHeatingScenario.id,
  },
  {
    scenario: denseAtmosphereDragScenario,
    baseSnapshotName: denseAtmosphereDragScenario.id,
  },
  {
    scenario: determinismBaseScenario,
    baseSnapshotName: "PhysicsEngine.determinism",
  },
  {
    scenario: eccentricOrbitScenario,
    baseSnapshotName: eccentricOrbitScenario.id,
  },
  {
    scenario: gravityPullLargeBodyScenario,
    baseSnapshotName: gravityPullLargeBodyScenario.id,
  },
  {
    scenario: gravityPullSmallBodyScenario,
    baseSnapshotName: gravityPullSmallBodyScenario.id,
  },
  {
    scenario: gravityPullVeryLargeBodyScenario,
    baseSnapshotName: gravityPullVeryLargeBodyScenario.id,
  },
  {
    scenario: orbitLargeBodyScenario,
    baseSnapshotName: orbitLargeBodyScenario.id,
  },
  {
    scenario: orbitSmallBodyScenario,
    baseSnapshotName: orbitSmallBodyScenario.id,
  },
  { scenario: rotationScenario, baseSnapshotName: rotationScenario.id },
  { scenario: thrustScenario, baseSnapshotName: thrustScenario.id },
];
