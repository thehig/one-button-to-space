import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";

import {
  gravityPullSmallBodyScenario1Step,
  gravityPullSmallBodyScenario10Steps,
  gravityPullSmallBodyScenario50Steps,
  gravityPullSmallBodyScenario100Steps,
} from "./gravity-pull-small-body.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Small)", () => {
  it("should simulate gravitational pull from a small celestial body (1 step - explicit assertions)", () => {
    const scenario = gravityPullSmallBodyScenario1Step;
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

  it("should match snapshot after 10 steps of gravity pull (small body)", () => {
    runTestAndSnapshot(
      gravityPullSmallBodyScenario10Steps,
      "gravity-pull-small-body",
      10
    );
  });

  it("should match snapshot after 50 steps of gravity pull (small body)", () => {
    runTestAndSnapshot(
      gravityPullSmallBodyScenario50Steps,
      "gravity-pull-small-body",
      50
    );
  });

  it("should match snapshot after 100 steps of gravity pull (small body)", () => {
    runTestAndSnapshot(
      gravityPullSmallBodyScenario100Steps,
      "gravity-pull-small-body",
      100
    );
  });
});
