import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
import { IScenario } from "./types";
// PhysicsEngine import removed as it's not directly used

// Import consolidated scenario
import { orbitLargeBodyScenario } from "./orbit-large-body.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Orbit (Large Body)", () => {
  // Removed explicit 1-step assertion test in favor of snapshot test at step 1

  // Dynamically generate snapshot tests
  if (orbitLargeBodyScenario.snapshotSteps) {
    orbitLargeBodyScenario.snapshotSteps.forEach((steps) => {
      it(`should match snapshot after ${steps} steps of orbit (large body)`, () => {
        runTestAndSnapshot(
          orbitLargeBodyScenario,
          orbitLargeBodyScenario.id, // Use scenario ID
          steps
        );
      });
    });
  }
});
