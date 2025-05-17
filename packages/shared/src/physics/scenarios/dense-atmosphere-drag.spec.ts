import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";

import {
  denseAtmosphereDragScenario1Step,
  denseAtmosphereDragScenario10Steps,
  denseAtmosphereDragScenario50Steps,
  denseAtmosphereDragScenario100Steps,
} from "./dense-atmosphere-drag.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Environmental Effects: Dense Atmospheric Drag", () => {
  it("should simulate atmospheric drag in a VERY dense atmosphere (1 step - explicit assertions)", () => {
    const scenario = denseAtmosphereDragScenario1Step;
    const targetBodyLabel = scenario.initialBodies[0].label;
    if (!targetBodyLabel) {
      throw new Error("Target body label is undefined in the scenario.");
    }

    const scenarioBody = scenario.initialBodies.find(
      (b) => b.label === targetBodyLabel
    );
    if (!scenarioBody || !scenarioBody.initialVelocity) {
      throw new Error(
        "Dense drag test scenario body or initial velocity not defined correctly."
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

    const finalSpeed = Vector.magnitude(finalBody.velocity as Vector);

    expect(finalSpeed).to.be.lessThan(initialSpeed);
    expect(finalBody.velocity.x).to.be.greaterThan(-initialSpeed);
    expect(finalSpeed).to.be.lessThan(initialSpeed * 0.9);
  });

  it("should match snapshot after 10 steps of dense atmospheric drag", () => {
    runTestAndSnapshot(
      denseAtmosphereDragScenario10Steps,
      "dense-atmospheric-drag",
      10
    );
  });

  it("should match snapshot after 50 steps of dense atmospheric drag", () => {
    runTestAndSnapshot(
      denseAtmosphereDragScenario50Steps,
      "dense-atmospheric-drag",
      50
    );
  });

  it("should match snapshot after 100 steps of dense atmospheric drag", () => {
    runTestAndSnapshot(
      denseAtmosphereDragScenario100Steps,
      "dense-atmospheric-drag",
      100
    );
  });
});
