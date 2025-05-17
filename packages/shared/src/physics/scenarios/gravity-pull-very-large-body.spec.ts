import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";

import { gravityPullVeryLargeBodyScenario } from "./gravity-pull-very-large-body.scenario";
import { runScenario } from "./test-runner.helper";

describe("PhysicsEngine Celestial Mechanics: Gravity Pull (Very Large)", () => {
  it("should simulate gravitational pull from a VERY large celestial body", () => {
    const scenario = gravityPullVeryLargeBodyScenario;
    const satelliteDef = scenario.initialBodies[0];
    const celestialBodyDef = scenario.celestialBodies![0];

    const initialDistance = Vector.magnitude(
      Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
    );

    const finalSatelliteState = runScenario(scenario, satelliteDef.id);

    const finalDistance = Vector.magnitude(
      Vector.sub(finalSatelliteState.position, celestialBodyDef.position)
    );

    // Expect the satellite to have moved towards the celestial body
    expect(finalDistance).to.be.lessThan(initialDistance);
    // Expect the satellite not to have passed through or landed exactly on the center (unless intended)
    expect(finalDistance).to.be.greaterThan(0);
  });
});
