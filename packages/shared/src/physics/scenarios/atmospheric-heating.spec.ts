import { expect } from "chai";
import "mocha";
import Matter from "matter-js"; // Matter needed for Vector, Body etc.
// import * as fs from "fs"; // No longer needed
// import * as path from "path"; // No longer needed
import {
  IScenario,
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
} from "./types";
import { PhysicsEngine, ICustomBodyPlugin } from "../PhysicsEngine"; // PhysicsEngine unused

import {
  atmosphericHeatingScenario1Step,
  atmosphericHeatingScenario10Steps,
  atmosphericHeatingScenario50Steps,
  atmosphericHeatingScenario100Steps,
} from "./atmospheric-heating.scenario";
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

// const snapshotDir = path.join(__dirname, "__snapshots__"); // No longer needed

// // Local runTestAndSnapshot removed
// const runTestAndSnapshot = (
//   // ... implementation removed ...
// );

describe("PhysicsEngine Environmental Effects: Atmospheric Heating", () => {
  it("should simulate atmospheric heating (1 step - explicit assertions)", () => {
    const scenario = atmosphericHeatingScenario1Step;
    const celestialBodyDef = scenario.celestialBodies![0];
    const bodyDef = scenario.initialBodies[0];
    const targetBodyLabel = bodyDef.label || bodyDef.id;
    const noseRadius = bodyDef.options!.plugin!.effectiveNoseRadius!;
    const bodyInitialSpeed = Math.abs(bodyDef.initialVelocity!.x!); // Speed is magnitude

    const altitude = bodyDef.initialPosition.x - celestialBodyDef.radius!;
    const rho =
      celestialBodyDef.surfaceAirDensity! *
      Math.exp(-Math.max(0, altitude) / celestialBodyDef.scaleHeight!);
    const V = bodyInitialSpeed;
    const Rn = noseRadius;
    const C_heating = 1.83e-4;
    const expectedHeatFlux = C_heating * Math.sqrt(rho / Rn) * Math.pow(V, 3);

    const finalState = runScenario(scenario);
    const finalTestBody = finalState.world.bodies.find(
      (b) => b.label === targetBodyLabel
    );

    if (!finalTestBody) {
      throw new Error(
        `Test body with label ${targetBodyLabel} not found in final state.`
      );
    }

    const calculatedHeatFlux = finalTestBody.plugin.currentHeatFlux;

    expect(calculatedHeatFlux).to.be.a(
      "number",
      "currentHeatFlux should be calculated"
    );
    expect(calculatedHeatFlux).to.not.be.null;
    if (calculatedHeatFlux !== null) {
      expect(calculatedHeatFlux).to.be.closeTo(
        expectedHeatFlux,
        expectedHeatFlux * 0.1 // Allow 10% tolerance
      );
    }
  });

  it("should match snapshot after 10 steps of atmospheric heating", () => {
    runTestAndSnapshot(
      atmosphericHeatingScenario10Steps,
      "atmospheric-heating",
      10
    );
  });

  it("should match snapshot after 50 steps of atmospheric heating", () => {
    runTestAndSnapshot(
      atmosphericHeatingScenario50Steps,
      "atmospheric-heating",
      50
    );
  });

  it("should match snapshot after 100 steps of atmospheric heating", () => {
    runTestAndSnapshot(
      atmosphericHeatingScenario100Steps,
      "atmospheric-heating",
      100
    );
  });
});
