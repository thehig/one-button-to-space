import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import * as fs from "fs";
import * as path from "path";
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";

import {
  gravityPullVeryLargeBodyScenario1Step,
  gravityPullVeryLargeBodyScenario10Steps,
  gravityPullVeryLargeBodyScenario50Steps,
  gravityPullVeryLargeBodyScenario100Steps,
} from "./gravity-pull-very-large-body.scenario";
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

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Very Large)", () => {
  it("should simulate gravitational pull from a VERY large celestial body (1 step - explicit assertions)", () => {
    const scenario = gravityPullVeryLargeBodyScenario1Step;
    const satelliteDef = scenario.initialBodies[0];
    const targetSatelliteLabel = satelliteDef.label || satelliteDef.id;
    const celestialBodyDef = scenario.celestialBodies![0];

    const initialDistance = Vector.magnitude(
      Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
    );

    const fullFinalState = runScenario(scenario);
    const finalSatellite = fullFinalState.world.bodies.find(
      (b) => b.label === targetSatelliteLabel
    );

    if (!finalSatellite) {
      throw new Error(
        `Satellite body with label ${targetSatelliteLabel} not found in final state.`
      );
    }

    const finalDistance = Vector.magnitude(
      Vector.sub(finalSatellite.position as Vector, celestialBodyDef.position)
    );

    expect(finalDistance).to.be.lessThan(initialDistance);
    expect(finalDistance).to.be.greaterThan(0);
    expect(finalSatellite.position.x).to.be.lessThan(
      satelliteDef.initialPosition.x
    );
    expect(finalSatellite.position.y).to.be.closeTo(
      satelliteDef.initialPosition.y,
      0.01
    );
  });

  it("should match snapshot after 10 steps of gravity pull (very large body)", () => {
    runTestAndSnapshot(
      gravityPullVeryLargeBodyScenario10Steps,
      "gravity-pull-very-large-body.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of gravity pull (very large body)", () => {
    runTestAndSnapshot(
      gravityPullVeryLargeBodyScenario50Steps,
      "gravity-pull-very-large-body.50steps.snap.json"
    );
  });

  it("should match snapshot after 100 steps of gravity pull (very large body)", () => {
    runTestAndSnapshot(
      gravityPullVeryLargeBodyScenario100Steps,
      "gravity-pull-very-large-body.100steps.snap.json"
    );
  });
});
