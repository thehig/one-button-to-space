import { expect } from "chai";
import "mocha";
import { Vector } from "matter-js";
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";

import {
  thrustScenario1Step,
  thrustScenario10Steps,
  thrustScenario50Steps,
  thrustScenario100Steps,
} from "./thrust.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("PhysicsEngine Basic Actions: Thrust", () => {
  it("should correctly apply thrust to a body (1 step - explicit assertions)", () => {
    const scenario = thrustScenario1Step;
    const targetBodyLabel = scenario.initialBodies[0].label;
    if (!targetBodyLabel) {
      throw new Error("Target body label is undefined in the scenario.");
    }

    const initialRocketStateDef = scenario.initialBodies.find(
      (b) => b.label === targetBodyLabel
    )!;
    const initialVelocityY = initialRocketStateDef.initialVelocity?.y || 0;
    const initialPositionY = initialRocketStateDef.initialPosition.y;
    const initialVelocityX = initialRocketStateDef.initialVelocity?.x || 0;
    const initialPositionX = initialRocketStateDef.initialPosition.x;

    const fullFinalState = runScenario(scenario);
    const finalRocket = fullFinalState.world.bodies.find(
      (b) => b.label === targetBodyLabel
    );

    if (!finalRocket) {
      throw new Error(
        `Body with label ${targetBodyLabel} not found in final state.`
      );
    }

    expect(finalRocket.velocity.y).to.be.lessThan(initialVelocityY);
    expect(finalRocket.position.y).to.be.lessThan(initialPositionY);
    expect(finalRocket.velocity.x).to.be.closeTo(initialVelocityX, 1e-9);
    expect(finalRocket.position.x).to.be.closeTo(initialPositionX, 1e-9);
  });

  it("should match snapshot after 10 steps of thrust", () => {
    runTestAndSnapshot(thrustScenario10Steps, "thrust", 10);
  });

  it("should match snapshot after 50 steps of thrust", () => {
    runTestAndSnapshot(thrustScenario50Steps, "thrust", 50);
  });

  it("should match snapshot after 100 steps of thrust", () => {
    runTestAndSnapshot(thrustScenario100Steps, "thrust", 100);
  });
});
