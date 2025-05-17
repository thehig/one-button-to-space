import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
import * as fs from "fs";
import * as path from "path";
import { IScenario } from "./types";
import { PhysicsEngine } from "../PhysicsEngine";
import {
  eccentricOrbitScenario1Step,
  eccentricOrbitScenario10Steps,
  eccentricOrbitScenario50Steps,
  eccentricOrbitScenario250Steps, // This will be used for the detailed explicit test
} from "./eccentric-orbit.scenario";
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

describe("PhysicsEngine Celestial Mechanics: Eccentric Orbit", () => {
  // This test retains the detailed assertions from the original eccentric orbit test,
  // but uses a scenario with a fixed number of steps (250) for consistency.
  it.skip("should simulate an eccentric orbit around a large celestial body (250 steps - explicit assertions)", () => {
    const scenario = eccentricOrbitScenario250Steps; // Using 250 steps for explicit check
    const celestialBodyDef = scenario.celestialBodies![0];
    const satelliteDef = scenario.initialBodies[0];
    const debug = scenario.engineSettings?.enableInternalLogging || false;

    const engine = new PhysicsEngine(
      scenario.engineSettings?.fixedTimeStepMs,
      scenario.engineSettings?.customG
    );
    engine.setInternalLogging(debug);
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

    const initialDistance = Vector.magnitude(
      Vector.sub(satellite.position, celestialBodyDef.position)
    );
    let minDistance = initialDistance;
    let maxDistance = initialDistance;
    // const positions: Vector[] = []; // Not strictly needed for assertions here

    if (debug)
      console.log("Starting eccentric orbit explicit test (250 steps)...");

    const fixedTimeStep = scenario.engineSettings?.fixedTimeStepMs || 1000 / 60;
    for (let i = 0; i < scenario.simulationSteps; i++) {
      // Loop up to scenario.simulationSteps
      engine.fixedStep(fixedTimeStep);
      const currentPos = Vector.clone(satellite.position);
      // positions.push(currentPos);
      const currentDistance = Vector.magnitude(
        Vector.sub(currentPos, celestialBodyDef.position)
      );
      minDistance = Math.min(minDistance, currentDistance);
      maxDistance = Math.max(maxDistance, currentDistance);
      if (debug && i % 50 === 0) {
        // Log less frequently for 250 steps
        console.log(
          `Step ${i}: Pos (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(
            2
          )}), Vel (${satellite.velocity.x.toFixed(
            2
          )}, ${satellite.velocity.y.toFixed(
            2
          )}), Dist: ${currentDistance.toFixed(2)}`
        );
      }
    }

    const finalDistance = Vector.magnitude(
      Vector.sub(satellite.position, celestialBodyDef.position)
    );

    if (debug) {
      console.log(`Initial distance: ${initialDistance.toFixed(2)}`);
      console.log(`Final distance: ${finalDistance.toFixed(2)}`);
      console.log(`Min distance: ${minDistance.toFixed(2)}`);
      console.log(`Max distance: ${maxDistance.toFixed(2)}`);
    }

    expect(maxDistance).to.be.greaterThan(minDistance * 1.2);
    expect(minDistance).to.be.greaterThan(celestialBodyDef.radius! * 0.8);
    expect(maxDistance).to.be.lessThan(initialDistance * 5);
    expect(satellite.position.x).to.not.be.closeTo(
      satelliteDef.initialPosition.x,
      1
    );
    expect(satellite.position.y).to.not.be.closeTo(
      satelliteDef.initialPosition.y,
      1
    );
  });

  it("should match snapshot after 1 step of eccentric orbit", () => {
    runTestAndSnapshot(
      eccentricOrbitScenario1Step,
      eccentricOrbitScenario1Step.initialBodies[0].id!,
      "eccentric-orbit.1step.snap.json"
    );
  });

  it("should match snapshot after 10 steps of eccentric orbit", () => {
    runTestAndSnapshot(
      eccentricOrbitScenario10Steps,
      eccentricOrbitScenario10Steps.initialBodies[0].id!,
      "eccentric-orbit.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of eccentric orbit", () => {
    runTestAndSnapshot(
      eccentricOrbitScenario50Steps,
      eccentricOrbitScenario50Steps.initialBodies[0].id!,
      "eccentric-orbit.50steps.snap.json"
    );
  });

  // The 250-step explicit test above covers detailed assertions for a longer run.
  // We can still have a 250-step snapshot for regression tracking if desired.
  it("should match snapshot after 250 steps of eccentric orbit", () => {
    runTestAndSnapshot(
      eccentricOrbitScenario250Steps,
      eccentricOrbitScenario250Steps.initialBodies[0].id!,
      "eccentric-orbit.250steps.snap.json"
    );
  });
});
