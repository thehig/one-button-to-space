import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import { IScenario, ISerializedPhysicsEngineState } from "./types";

import {
  atmosphericDragScenario1Step,
  atmosphericDragScenario10Steps,
  atmosphericDragScenario50Steps,
  atmosphericDragScenario100Steps,
} from "./atmospheric-drag.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Environmental Effects: Atmospheric Drag", () => {
  it("should simulate atmospheric drag (1 step - explicit assertions)", () => {
    const scenario = atmosphericDragScenario1Step;
    const targetBodyLabel = scenario.initialBodies[0].label;
    if (!targetBodyLabel) {
      throw new Error("Target body label is undefined in the scenario.");
    }

    const scenarioBody = scenario.initialBodies.find(
      (b) => b.label === targetBodyLabel
    );
    if (!scenarioBody || !scenarioBody.initialVelocity) {
      throw new Error(
        "Drag test scenario body or initial velocity not defined correctly."
      );
    }
    const initialSpeed = Vector.magnitude(scenarioBody.initialVelocity);

    const fullFinalState = runScenario(scenario);
    const finalBody = fullFinalState.world.bodies.find(
      (b) => b.label === targetBodyLabel
    );

    if (!finalBody) {
      throw new Error(
        `Body with label ${targetBodyLabel} not found in final state.`
      );
    }

    const finalSpeed = Vector.magnitude(finalBody.velocity as Matter.Vector);

    expect(finalSpeed).to.be.lessThan(initialSpeed);
    expect(finalSpeed).to.be.greaterThan(0);
  });

  it("should match snapshot after 10 steps of atmospheric drag", () => {
    runTestAndSnapshot(atmosphericDragScenario10Steps, "atmospheric-drag", 10);
  });

  it("should match snapshot after 50 steps of atmospheric drag", () => {
    runTestAndSnapshot(atmosphericDragScenario50Steps, "atmospheric-drag", 50);
  });

  it("should match snapshot after 100 steps of atmospheric drag", () => {
    runTestAndSnapshot(
      atmosphericDragScenario100Steps,
      "atmospheric-drag",
      100
    );
  });
});
