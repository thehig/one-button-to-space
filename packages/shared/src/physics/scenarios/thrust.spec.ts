import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { Vector } from "matter-js";
import { IScenario } from "./types";

import {
  thrustScenario1Step,
  thrustScenario10Steps,
  thrustScenario50Steps,
  thrustScenario100Steps,
} from "./thrust.scenario";
import { runScenario, ScenarioResult } from "./test-runner.helper"; // Assuming ScenarioResult is exported

const snapshotDir = path.join(__dirname, "__snapshots__");

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
    return currentResults; // Return for any immediate assertions if needed
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

describe("PhysicsEngine Basic Actions: Thrust", () => {
  it("should correctly apply thrust to a body (1 step - explicit assertions)", () => {
    const scenario = thrustScenario1Step;
    const initialRocketState = scenario.initialBodies.find(
      (b) => b.id === "thrustRocket"
    )!;
    const initialVelocityY = initialRocketState.initialVelocity?.y || 0;
    const initialPositionY = initialRocketState.initialPosition.y;

    const finalRocketState = runScenario(scenario, "thrustRocket");

    expect(finalRocketState.velocity.y).to.be.lessThan(initialVelocityY);
    expect(finalRocketState.position.y).to.be.lessThan(initialPositionY);

    const initialVelocityX = initialRocketState.initialVelocity?.x || 0;
    const initialPositionX = initialRocketState.initialPosition.x;
    expect(finalRocketState.velocity.x).to.be.closeTo(initialVelocityX, 1e-9);
    expect(finalRocketState.position.x).to.be.closeTo(initialPositionX, 1e-9);
  });

  it("should match snapshot after 10 steps of thrust", () => {
    runTestAndSnapshot(
      thrustScenario10Steps,
      "thrustRocket",
      "thrust.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of thrust", () => {
    runTestAndSnapshot(
      thrustScenario50Steps,
      "thrustRocket",
      "thrust.50steps.snap.json"
    );
  });

  it("should match snapshot after 100 steps of thrust", () => {
    runTestAndSnapshot(
      thrustScenario100Steps,
      "thrustRocket",
      "thrust.100steps.snap.json"
    );
  });
});
