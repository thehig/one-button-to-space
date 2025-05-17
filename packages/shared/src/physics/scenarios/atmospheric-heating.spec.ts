import { expect } from "chai";
import "mocha";
import Matter from "matter-js"; // Matter needed for Vector, Body etc.
import { PhysicsEngine, ICustomBodyPlugin } from "../PhysicsEngine";

import { atmosphericHeatingScenario } from "./atmospheric-heating.scenario";
// runScenario is not used by this test directly

describe("PhysicsEngine Environmental Effects: Atmospheric Heating", () => {
  it("should simulate atmospheric heating", () => {
    const scenario = atmosphericHeatingScenario;
    const celestialBodyDef = scenario.celestialBodies![0];
    const bodyDef = scenario.initialBodies[0];
    const noseRadius = bodyDef.options!.plugin!.effectiveNoseRadius!;
    const bodyInitialSpeed = Math.abs(bodyDef.initialVelocity!.x!); // Speed is magnitude

    const engine = new PhysicsEngine(
      scenario.engineSettings?.fixedTimeStepMs,
      scenario.engineSettings?.customG
    );
    if (scenario.engineSettings?.enableInternalLogging) {
      engine.setInternalLogging(true);
    }
    engine.init(scenario.celestialBodies);

    const testBody = engine.createBox(
      bodyDef.initialPosition.x,
      bodyDef.initialPosition.y,
      bodyDef.width!,
      bodyDef.height!,
      {
        label: bodyDef.label,
        plugin: bodyDef.options!.plugin as ICustomBodyPlugin,
      }
    );
    engine.setBodyVelocity(testBody, bodyDef.initialVelocity!);

    const altitude = bodyDef.initialPosition.x - celestialBodyDef.radius!;
    const rho =
      celestialBodyDef.surfaceAirDensity! *
      Math.exp(-Math.max(0, altitude) / celestialBodyDef.scaleHeight!);
    const V = bodyInitialSpeed;
    const Rn = noseRadius;
    const C_heating = 1.83e-4;
    const expectedHeatFlux = C_heating * Math.sqrt(rho / Rn) * Math.pow(V, 3);

    engine.fixedStep(scenario.engineSettings?.fixedTimeStepMs || 1000 / 60);

    const calculatedHeatFlux = (testBody.plugin as ICustomBodyPlugin)
      .currentHeatFlux;

    expect(calculatedHeatFlux).to.be.a(
      "number",
      "currentHeatFlux should be calculated"
    );
    expect(calculatedHeatFlux).to.be.closeTo(
      expectedHeatFlux,
      expectedHeatFlux * 0.1
    );
  });
});
