import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
import { PhysicsEngine } from "../PhysicsEngine";
import { orbitSmallBodyScenario } from "./orbit-small-body.scenario";

describe("PhysicsEngine Celestial Mechanics: Orbit (Small Body)", () => {
  it("should simulate an object orbiting a small celestial body", () => {
    const scenario = orbitSmallBodyScenario;
    const celestialBodyDef = scenario.celestialBodies![0];
    const satelliteDef = scenario.initialBodies[0];

    const engine = new PhysicsEngine(
      scenario.engineSettings?.fixedTimeStepMs,
      scenario.engineSettings?.customG
    );
    if (scenario.engineSettings?.enableInternalLogging) {
      engine.setInternalLogging(true);
    }
    engine.init(scenario.celestialBodies);

    const satellite = engine.createCircle(
      satelliteDef.initialPosition.x,
      satelliteDef.initialPosition.y,
      satelliteDef.radius!,
      { label: satelliteDef.label, ...satelliteDef.options }
    );
    engine.setBodyVelocity(satellite, satelliteDef.initialVelocity!);
    if (satelliteDef.initialAngle) {
      Matter.Body.setAngle(satellite, satelliteDef.initialAngle);
    }
    if (satelliteDef.initialAngularVelocity) {
      Matter.Body.setAngularVelocity(
        satellite,
        satelliteDef.initialAngularVelocity
      );
    }

    const initialDistance = Vector.magnitude(
      Vector.sub(satellite.position, celestialBodyDef.position)
    );
    let minDistance = initialDistance;
    let maxDistance = initialDistance;

    const fixedTimeStep = scenario.engineSettings?.fixedTimeStepMs || 1000 / 60;
    for (let i = 0; i < scenario.simulationSteps; i++) {
      engine.fixedStep(fixedTimeStep);
      const currentDistance = Vector.magnitude(
        Vector.sub(satellite.position, celestialBodyDef.position)
      );
      minDistance = Math.min(minDistance, currentDistance);
      maxDistance = Math.max(maxDistance, currentDistance);
    }

    const finalDistance = Vector.magnitude(
      Vector.sub(satellite.position, celestialBodyDef.position)
    );

    expect(finalDistance).to.be.greaterThan(celestialBodyDef.radius! * 0.8);
    expect(finalDistance).to.be.lessThan(initialDistance * 3);
    expect(satellite.position.y).to.not.be.closeTo(
      satelliteDef.initialPosition.y,
      0.1
    );
    expect(minDistance).to.be.greaterThan(initialDistance * 0.3);
    expect(maxDistance).to.be.lessThan(initialDistance * 3);
  });
});
