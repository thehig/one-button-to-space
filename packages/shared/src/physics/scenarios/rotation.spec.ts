import { expect } from "chai";
import "mocha";
// import * as fs from "fs"; // No longer needed
// import * as path from "path"; // No longer needed
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";

import {
  rotationScenario1Step,
  rotationScenario10Steps,
  rotationScenario50Steps,
  rotationScenario100Steps,
} from "./rotation.scenario";
// Import runTestAndSnapshot from the helper
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

// const snapshotDir = path.join(__dirname, "__snapshots__"); // No longer needed

// // Local runTestAndSnapshot removed
// const runTestAndSnapshot = (
//   // ... implementation removed ...
// );

describe("PhysicsEngine Basic Actions: Rotation", () => {
  it("should correctly apply rotation to a body (1 step - explicit assertions)", () => {
    const scenario = rotationScenario1Step;
    const targetBodyLabel = scenario.initialBodies[0].label;
    if (!targetBodyLabel) {
      throw new Error("Target body label is undefined in the scenario.");
    }

    const initialBoxStateDef = scenario.initialBodies.find(
      (b) => b.label === targetBodyLabel
    )!;
    const initialAngle = initialBoxStateDef.initialAngle || 0;
    const initialAngularVelocity =
      initialBoxStateDef.initialAngularVelocity || 0;

    const fullFinalState = runScenario(scenario);
    const finalBox = fullFinalState.world.bodies.find(
      (b) => b.label === targetBodyLabel
    );

    if (!finalBox) {
      throw new Error(
        `Body with label ${targetBodyLabel} not found in final state.`
      );
    }

    expect(finalBox.angle).to.not.be.null;
    expect(finalBox.angularVelocity).to.not.be.null;

    if (finalBox.angle !== null) {
      expect(finalBox.angle).to.be.greaterThan(initialAngle);
    }
    if (finalBox.angularVelocity !== null) {
      expect(finalBox.angularVelocity).to.be.greaterThan(
        initialAngularVelocity
      );
    }
  });

  it("should match snapshot after 10 steps of rotation", () => {
    runTestAndSnapshot(rotationScenario10Steps, "rotation", 10);
  });

  it("should match snapshot after 50 steps of rotation", () => {
    runTestAndSnapshot(rotationScenario50Steps, "rotation", 50);
  });

  it("should match snapshot after 100 steps of rotation", () => {
    runTestAndSnapshot(rotationScenario100Steps, "rotation", 100);
  });
});
