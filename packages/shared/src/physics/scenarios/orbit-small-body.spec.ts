import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
import * as fs from "fs";
import * as path from "path";
import { IScenario } from "./types";
import { PhysicsEngine } from "../PhysicsEngine";
import {
  orbitSmallBodyScenario1Step,
  orbitSmallBodyScenario10Steps,
  orbitSmallBodyScenario50Steps,
  orbitSmallBodyScenario250Steps,
} from "./orbit-small-body.scenario";
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

describe("PhysicsEngine Celestial Mechanics: Orbit (Small Body)", () => {
  it("should show initial orbital movement for a small body (1 step - explicit assertions)", () => {
    const scenario = orbitSmallBodyScenario1Step;
    const celestialBodyDef = scenario.celestialBodies![0];
    const satelliteDef = scenario.initialBodies[0];

    const engine = new PhysicsEngine(
      scenario.engineSettings?.fixedTimeStepMs,
      scenario.engineSettings?.customG
    );
    if (scenario.engineSettings?.enableInternalLogging) {
      engine.setInternalLogging(true);
    }
    engine.init(scenario.celestialBodies);

    const satellite = engine.createCircle(
      satelliteDef.initialPosition.x,
      satelliteDef.initialPosition.y,
      satelliteDef.radius!,
      { label: satelliteDef.label, ...satelliteDef.options }
    );
    engine.setBodyVelocity(satellite, satelliteDef.initialVelocity!);
    if (satelliteDef.initialAngle) {
      Matter.Body.setAngle(satellite, satelliteDef.initialAngle);
    }
    if (satelliteDef.initialAngularVelocity) {
      Matter.Body.setAngularVelocity(
        satellite,
        satelliteDef.initialAngularVelocity
      );
    }

    engine.fixedStep(scenario.engineSettings?.fixedTimeStepMs || 1000 / 60);

    expect(satellite.position.x).to.be.lessThan(satelliteDef.initialPosition.x);
    expect(satellite.position.y).to.be.greaterThan(
      satelliteDef.initialPosition.y
    );

    const finalDistance = Vector.magnitude(
      Vector.sub(satellite.position, celestialBodyDef.position)
    );
    const initialDistance = Vector.magnitude(
      Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
    );
    expect(finalDistance).to.be.lessThan(initialDistance);
  });

  it("should match snapshot after 10 steps of orbit (small body)", () => {
    runTestAndSnapshot(
      orbitSmallBodyScenario10Steps,
      orbitSmallBodyScenario10Steps.initialBodies[0].id!,
      "orbit-small-body.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of orbit (small body)", () => {
    runTestAndSnapshot(
      orbitSmallBodyScenario50Steps,
      orbitSmallBodyScenario50Steps.initialBodies[0].id!,
      "orbit-small-body.50steps.snap.json"
    );
  });

  it("should match snapshot after 250 steps of orbit (small body)", () => {
    runTestAndSnapshot(
      orbitSmallBodyScenario250Steps,
      orbitSmallBodyScenario250Steps.initialBodies[0].id!,
      "orbit-small-body.250steps.snap.json"
    );
  });
});
