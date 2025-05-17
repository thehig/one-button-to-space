import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import * as fs from "fs";
import * as path from "path";
import { IScenario } from "./types";

import {
  gravityPullLargeBodyScenario1Step,
  gravityPullLargeBodyScenario10Steps,
  gravityPullLargeBodyScenario50Steps,
  gravityPullLargeBodyScenario100Steps,
} from "./gravity-pull-large-body.scenario";
import { runScenario, ScenarioResult } from "./test-runner.helper";

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

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Large)", () => {
  it("should simulate gravitational pull from a large celestial body (1 step - explicit assertions)", () => {
    const scenario = gravityPullLargeBodyScenario1Step;
    const satelliteDef = scenario.initialBodies[0];
    const celestialBodyDef = scenario.celestialBodies![0];

    const initialDistance = Vector.magnitude(
      Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
    );

    const finalSatelliteState = runScenario(scenario, satelliteDef.id!);

    const finalDistance = Vector.magnitude(
      Vector.sub(finalSatelliteState.position, celestialBodyDef.position)
    );

    expect(finalDistance).to.be.lessThan(initialDistance);
    expect(finalDistance).to.be.greaterThan(0);
    expect(finalSatelliteState.position.x).to.be.lessThan(
      satelliteDef.initialPosition.x
    );
    expect(finalSatelliteState.position.y).to.be.closeTo(
      satelliteDef.initialPosition.y,
      0.01
    );
  });

  it("should match snapshot after 10 steps of gravity pull (large body)", () => {
    runTestAndSnapshot(
      gravityPullLargeBodyScenario10Steps,
      gravityPullLargeBodyScenario10Steps.initialBodies[0].id!,
      "gravity-pull-large-body.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of gravity pull (large body)", () => {
    runTestAndSnapshot(
      gravityPullLargeBodyScenario50Steps,
      gravityPullLargeBodyScenario50Steps.initialBodies[0].id!,
      "gravity-pull-large-body.50steps.snap.json"
    );
  });

  it("should match snapshot after 100 steps of gravity pull (large body)", () => {
    runTestAndSnapshot(
      gravityPullLargeBodyScenario100Steps,
      gravityPullLargeBodyScenario100Steps.initialBodies[0].id!,
      "gravity-pull-large-body.100steps.snap.json"
    );
  });
});
