import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
import { IScenario } from "./types";
import { orbitSmallBodyScenario } from "./orbit-small-body.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Orbit (Small Body)", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  if (orbitSmallBodyScenario.snapshotSteps) {
    orbitSmallBodyScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of orbit (small body)`, () => {
        runTestAndSnapshot(
          orbitSmallBodyScenario,
          orbitSmallBodyScenario.id,
          steps
        );
      });
    });
  }
});
