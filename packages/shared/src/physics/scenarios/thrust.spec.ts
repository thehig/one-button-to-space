import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js"; // Vector is used for assertions

import { thrustScenario } from "./thrust.scenario";
import { runScenario } from "./test-runner.helper";

describe("PhysicsEngine Basic Actions: Thrust", () => {
  it("should correctly apply thrust to a body", () => {
    const initialScenarioVelocityY =
      thrustScenario.initialBodies[0].initialVelocity?.y || 0;
    const initialScenarioPositionY =
      thrustScenario.initialBodies[0].initialPosition.y;

    const finalRocketState = runScenario(thrustScenario, "thrustRocket");

    expect(finalRocketState.velocity.y).to.be.lessThan(
      initialScenarioVelocityY
    );
    expect(finalRocketState.position.y).to.be.lessThan(
      initialScenarioPositionY
    );

    const initialScenarioVelocityX =
      thrustScenario.initialBodies[0].initialVelocity?.x || 0;
    const initialScenarioPositionX =
      thrustScenario.initialBodies[0].initialPosition.x;
    expect(finalRocketState.velocity.x).to.be.closeTo(
      initialScenarioVelocityX,
      1e-9
    );
    expect(finalRocketState.position.x).to.be.closeTo(
      initialScenarioPositionX,
      1e-9
    );
  });
});
