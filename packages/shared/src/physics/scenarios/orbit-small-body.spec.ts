import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
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
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

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
    runTestAndSnapshot(orbitSmallBodyScenario10Steps, "orbit-small-body", 10);
  });

  it("should match snapshot after 50 steps of orbit (small body)", () => {
    runTestAndSnapshot(orbitSmallBodyScenario50Steps, "orbit-small-body", 50);
  });

  it("should match snapshot after 250 steps of orbit (small body)", () => {
    runTestAndSnapshot(orbitSmallBodyScenario250Steps, "orbit-small-body", 250);
  });
});
