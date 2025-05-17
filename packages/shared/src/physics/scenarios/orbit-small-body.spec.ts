import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
import * as fs from "fs";
import * as path from "path";
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";
import { PhysicsEngine } from "../PhysicsEngine";
import {
  orbitSmallBodyScenario1Step,
  orbitSmallBodyScenario10Steps,
  orbitSmallBodyScenario50Steps,
  orbitSmallBodyScenario250Steps,
} from "./orbit-small-body.scenario";
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

describe("PhysicsEngine Celestial Mechanics: Orbit (Small Body)", () => {
  it("should show initial orbital movement for a small body (1 step - explicit assertions)", () => {
    const scenario = orbitSmallBodyScenario1Step;
    const celestialBodyDef = scenario.celestialBodies![0];
    const satelliteDef = scenario.initialBodies[0];
    const targetSatelliteLabel = satelliteDef.label || satelliteDef.id;

    const fullFinalState = runScenario(scenario);
    const finalSatellite = fullFinalState.world.bodies.find(
      (b) => b.label === targetSatelliteLabel
    );

    if (!finalSatellite) {
      throw new Error(
        `Satellite body with label ${targetSatelliteLabel} not found in final state.`
      );
    }

    expect(finalSatellite.position.x).to.be.lessThan(
      satelliteDef.initialPosition.x
    );
    expect(finalSatellite.position.y).to.be.greaterThan(
      satelliteDef.initialPosition.y
    );

    const finalDistance = Vector.magnitude(
      Vector.sub(finalSatellite.position as Vector, celestialBodyDef.position)
    );
    const initialDistance = Vector.magnitude(
      Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
    );
    expect(finalDistance).to.be.lessThan(initialDistance);
  });

  it("should match snapshot after 10 steps of orbit (small body)", () => {
    runTestAndSnapshot(
      orbitSmallBodyScenario10Steps,
      "orbit-small-body.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of orbit (small body)", () => {
    runTestAndSnapshot(
      orbitSmallBodyScenario50Steps,
      "orbit-small-body.50steps.snap.json"
    );
  });

  it("should match snapshot after 250 steps of orbit (small body)", () => {
    runTestAndSnapshot(
      orbitSmallBodyScenario250Steps,
      "orbit-small-body.250steps.snap.json"
    );
  });
});
