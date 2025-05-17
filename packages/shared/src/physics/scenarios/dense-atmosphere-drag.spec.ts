import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";

import { denseAtmosphereDragScenario } from "./dense-atmosphere-drag.scenario";
import { runScenario } from "./test-runner.helper";

describe("PhysicsEngine Environmental Effects: Dense Atmospheric Drag", () => {
  it("should simulate atmospheric drag in a VERY dense atmosphere", () => {
    const scenarioBody = denseAtmosphereDragScenario.initialBodies.find(
      (b) => b.id === "denseDragTestBody"
    );
    if (!scenarioBody || !scenarioBody.initialVelocity) {
      throw new Error(
        "Dense drag test scenario body or initial velocity not defined correctly."
      );
    }
    const initialSpeed = Vector.magnitude(scenarioBody.initialVelocity);

    const finalBodyState = runScenario(
      denseAtmosphereDragScenario,
      "denseDragTestBody"
    );
    const finalSpeed = Vector.magnitude(finalBodyState.velocity);

    expect(finalSpeed).to.be.lessThan(initialSpeed);
    expect(finalBodyState.velocity.x).to.be.greaterThan(-initialSpeed);
    expect(finalSpeed).to.be.lessThan(initialSpeed * 0.9);
  });
});
