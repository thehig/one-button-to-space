import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
// import { Vector } from "matter-js"; // Not directly used
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types"; // Added ISerializedTypes

import {
  rotationScenario1Step,
  rotationScenario10Steps,
  rotationScenario50Steps,
  rotationScenario100Steps,
} from "./rotation.scenario";
import { runScenario } from "./test-runner.helper"; // ScenarioResult removed

const snapshotDir = path.join(__dirname, "__snapshots__");

const runTestAndSnapshot = (
  scenario: IScenario,
  // targetBodyId: string, // Removed
  snapshotFileName: string
): ISerializedPhysicsEngineState => {
  // Updated return type
  const snapshotFile = path.join(snapshotDir, snapshotFileName);
  const currentResults = runScenario(scenario); // Removed targetBodyId

  if (process.env.UPDATE_SNAPSHOTS === "true") {
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    fs.writeFileSync(snapshotFile, JSON.stringify(currentResults, null, 2));
    console.log(`  Snapshot updated: ${snapshotFileName}`);
    return currentResults;
  } else {
    if (!fs.existsSync(snapshotFile)) {
      throw new Error(
        `Snapshot file not found: ${snapshotFileName}. Run with UPDATE_SNAPSHOTS=true to create it.`
      );
    }
    const expectedResults = JSON.parse(
      fs.readFileSync(snapshotFile, "utf-8")
    ) as ISerializedPhysicsEngineState; // Updated type cast
    expect(currentResults).to.deep.equal(expectedResults);
    return currentResults;
  }
};

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

    // Ensure angle and angularVelocity are not null before comparison if their type allows null
    // ISerializedMatterBody has angle: number | null and angularVelocity: number | null
    expect(finalBox.angle).to.not.be.null;
    expect(finalBox.angularVelocity).to.not.be.null;

    if (finalBox.angle !== null) {
      // Type guard for Chai
      expect(finalBox.angle).to.be.greaterThan(initialAngle);
    }
    if (finalBox.angularVelocity !== null) {
      // Type guard for Chai
      expect(finalBox.angularVelocity).to.be.greaterThan(
        initialAngularVelocity
      );
    }
  });

  it("should match snapshot after 10 steps of rotation", () => {
    runTestAndSnapshot(
      rotationScenario10Steps,
      // "rotationBox", // Removed
      "rotation.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of rotation", () => {
    runTestAndSnapshot(
      rotationScenario50Steps,
      // "rotationBox", // Removed
      "rotation.50steps.snap.json"
    );
  });

  it("should match snapshot after 100 steps of rotation", () => {
    runTestAndSnapshot(
      rotationScenario100Steps,
      // "rotationBox", // Removed
      "rotation.100steps.snap.json"
    );
  });
});
