import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
// import { Vector } from "matter-js"; // Not directly used in existing explicit assertions
import { IScenario } from "./types"; // Import IScenario

import {
  rotationScenario1Step,
  rotationScenario10Steps,
  rotationScenario50Steps,
  rotationScenario100Steps,
} from "./rotation.scenario";
import { runScenario, ScenarioResult } from "./test-runner.helper";

const snapshotDir = path.join(__dirname, "__snapshots__");

// Copied from thrust.spec.ts - consider moving to test-runner.helper.ts if used more widely
const runTestAndSnapshot = (
  scenario: IScenario,
  targetBodyId: string,
  snapshotFileName: string
) => {
  const snapshotFile = path.join(snapshotDir, snapshotFileName);
  const currentResults = runScenario(scenario, targetBodyId);

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
    ) as ScenarioResult;
    expect(currentResults).to.deep.equal(expectedResults);
    return currentResults;
  }
};

describe("PhysicsEngine Basic Actions: Rotation", () => {
  it("should correctly apply rotation to a body (1 step - explicit assertions)", () => {
    const scenario = rotationScenario1Step;
    const initialBoxState = scenario.initialBodies.find(
      (b) => b.id === "rotationBox"
    )!;
    const initialAngle = initialBoxState.initialAngle || 0;
    const initialAngularVelocity = initialBoxState.initialAngularVelocity || 0;

    const finalBoxState = runScenario(scenario, "rotationBox");

    expect(finalBoxState.angle).to.be.greaterThan(initialAngle);
    expect(finalBoxState.angularVelocity).to.be.greaterThan(
      initialAngularVelocity
    );
  });

  it("should match snapshot after 10 steps of rotation", () => {
    runTestAndSnapshot(
      rotationScenario10Steps,
      "rotationBox",
      "rotation.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of rotation", () => {
    runTestAndSnapshot(
      rotationScenario50Steps,
      "rotationBox",
      "rotation.50steps.snap.json"
    );
  });

  it("should match snapshot after 100 steps of rotation", () => {
    runTestAndSnapshot(
      rotationScenario100Steps,
      "rotationBox",
      "rotation.100steps.snap.json"
    );
  });
});
