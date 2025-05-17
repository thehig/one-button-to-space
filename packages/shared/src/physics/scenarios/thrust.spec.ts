import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { Vector } from "matter-js";
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";

import {
  thrustScenario1Step,
  thrustScenario10Steps,
  thrustScenario50Steps,
  thrustScenario100Steps,
} from "./thrust.scenario";
import { runScenario } from "./test-runner.helper";

const snapshotDir = path.join(__dirname, "__snapshots__");

const runTestAndSnapshot = (
  scenario: IScenario,
  snapshotFileName: string
): ISerializedPhysicsEngineState => {
  const snapshotFile = path.join(snapshotDir, snapshotFileName);
  const currentResults = runScenario(scenario);

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
    ) as ISerializedPhysicsEngineState;
    expect(currentResults).to.deep.equal(expectedResults);
    return currentResults;
  }
};

describe("PhysicsEngine Basic Actions: Thrust", () => {
  it("should correctly apply thrust to a body (1 step - explicit assertions)", () => {
    const scenario = thrustScenario1Step;
    const targetBodyLabel = scenario.initialBodies[0].label;
    if (!targetBodyLabel) {
      throw new Error("Target body label is undefined in the scenario.");
    }

    const initialRocketStateDef = scenario.initialBodies.find(
      (b) => b.label === targetBodyLabel
    )!;
    const initialVelocityY = initialRocketStateDef.initialVelocity?.y || 0;
    const initialPositionY = initialRocketStateDef.initialPosition.y;
    const initialVelocityX = initialRocketStateDef.initialVelocity?.x || 0;
    const initialPositionX = initialRocketStateDef.initialPosition.x;

    const fullFinalState = runScenario(scenario);
    const finalRocket = fullFinalState.world.bodies.find(
      (b) => b.label === targetBodyLabel
    );

    if (!finalRocket) {
      throw new Error(
        `Body with label ${targetBodyLabel} not found in final state.`
      );
    }

    expect(finalRocket.velocity.y).to.be.lessThan(initialVelocityY);
    expect(finalRocket.position.y).to.be.lessThan(initialPositionY);
    expect(finalRocket.velocity.x).to.be.closeTo(initialVelocityX, 1e-9);
    expect(finalRocket.position.x).to.be.closeTo(initialPositionX, 1e-9);
  });

  it("should match snapshot after 10 steps of thrust", () => {
    runTestAndSnapshot(thrustScenario10Steps, "thrust.10steps.snap.json");
  });

  it("should match snapshot after 50 steps of thrust", () => {
    runTestAndSnapshot(thrustScenario50Steps, "thrust.50steps.snap.json");
  });

  it("should match snapshot after 100 steps of thrust", () => {
    runTestAndSnapshot(thrustScenario100Steps, "thrust.100steps.snap.json");
  });
});
