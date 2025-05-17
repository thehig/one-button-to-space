import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";

import { atmosphericDragScenario } from "./atmospheric-drag.scenario";
import { runScenario } from "./test-runner.helper";

describe("PhysicsEngine Environmental Effects: Atmospheric Drag", () => {
  it("should simulate atmospheric drag", () => {
    const scenarioBody = atmosphericDragScenario.initialBodies.find(
      (b) => b.id === "dragTestBody"
    );
    if (!scenarioBody || !scenarioBody.initialVelocity) {
      throw new Error(
        "Drag test scenario body or initial velocity not defined correctly."
      );
    }
    const initialSpeed = Vector.magnitude(scenarioBody.initialVelocity);

    const finalBodyState = runScenario(atmosphericDragScenario, "dragTestBody");
    const finalSpeed = Vector.magnitude(finalBodyState.velocity);

    expect(finalSpeed).to.be.lessThan(initialSpeed);
    expect(finalSpeed).to.be.greaterThan(0);
  });
});
