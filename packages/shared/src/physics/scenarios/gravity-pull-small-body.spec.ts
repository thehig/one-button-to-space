import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";

import { gravityPullSmallBodyScenario } from "./gravity-pull-small-body.scenario";
import { runScenario } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Small)", () => {
  it("should simulate gravitational pull from a small celestial body", () => {
    const scenario = gravityPullSmallBodyScenario;
    const satelliteDef = scenario.initialBodies[0];
    const celestialBodyDef = scenario.celestialBodies![0];

    const initialDistance = Vector.magnitude(
      Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
    );

    const finalSatelliteState = runScenario(scenario, satelliteDef.id);

    const finalDistance = Vector.magnitude(
      Vector.sub(finalSatelliteState.position, celestialBodyDef.position)
    );

    expect(finalDistance).to.be.lessThan(initialDistance);
    expect(finalDistance).to.be.greaterThan(0);
  });
});
