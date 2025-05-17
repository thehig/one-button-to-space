import { expect } from "chai";
import "mocha";
// import { Vector } from "matter-js"; // Not directly used in this test's assertions

import { rotationScenario } from "./rotation.scenario";
import { runScenario } from "./test-runner.helper";

describe("PhysicsEngine Basic Actions: Rotation", () => {
  it("should correctly apply rotation to a body", () => {
    const initialScenarioAngle =
      rotationScenario.initialBodies[0].initialAngle || 0;
    const initialScenarioAngularVelocity =
      rotationScenario.initialBodies[0].initialAngularVelocity || 0;

    const finalBoxState = runScenario(rotationScenario, "rotationBox");

    expect(finalBoxState.angle).to.be.greaterThan(initialScenarioAngle);
    expect(finalBoxState.angularVelocity).to.be.greaterThan(
      initialScenarioAngularVelocity
    );
  });
});
