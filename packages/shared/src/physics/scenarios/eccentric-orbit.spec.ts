import { expect } from "chai";
import "mocha";
import Matter, { Vector } from "matter-js";
import { PhysicsEngine } from "../PhysicsEngine";
import { eccentricOrbitScenario } from "./eccentric-orbit.scenario";

describe("PhysicsEngine Celestial Mechanics: Eccentric Orbit", () => {
  it("should simulate an eccentric orbit around a large celestial body", () => {
    const scenario = eccentricOrbitScenario;
    const celestialBodyDef = scenario.celestialBodies![0];
    const satelliteDef = scenario.initialBodies[0];
    const debug = scenario.engineSettings?.enableInternalLogging || false;

    const engine = new PhysicsEngine(
      scenario.engineSettings?.fixedTimeStepMs,
      scenario.engineSettings?.customG
    );
    engine.setInternalLogging(debug); // Use the scenario flag
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
    const positions: Vector[] = [];

    if (debug) console.log("Starting eccentric orbit test...");

    const fixedTimeStep = scenario.engineSettings?.fixedTimeStepMs || 1000 / 60;
    for (let i = 0; i < scenario.simulationSteps; i++) {
      engine.fixedStep(fixedTimeStep);
      const currentPos = Vector.clone(satellite.position);
      positions.push(currentPos);
      const currentDistance = Vector.magnitude(
        Vector.sub(currentPos, celestialBodyDef.position)
      );
      minDistance = Math.min(minDistance, currentDistance);
      maxDistance = Math.max(maxDistance, currentDistance);
      if (debug && i % 100 === 0) {
        console.log(
          `Step ${i}: Pos (${currentPos.x.toFixed(2)}, ${currentPos.y.toFixed(
            2
          )}), Vel (${satellite.velocity.x.toFixed(
            2
          )}, ${satellite.velocity.y.toFixed(
            2
          )}), Dist: ${currentDistance.toFixed(2)}`
        );
      }
    }

    const finalDistance = Vector.magnitude(
      Vector.sub(satellite.position, celestialBodyDef.position)
    );

    if (debug) {
      console.log(`Initial distance: ${initialDistance.toFixed(2)}`);
      console.log(`Final distance: ${finalDistance.toFixed(2)}`);
      console.log(`Min distance: ${minDistance.toFixed(2)}`);
      console.log(`Max distance: ${maxDistance.toFixed(2)}`);
      // console.log("Positions:", positions.map(p => `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`).join(", "));
    }

    // For an eccentric orbit, min and max distance should be notably different
    expect(maxDistance).to.be.greaterThan(minDistance * 1.2); // At least 20% difference for eccentricity
    // Satellite should not have crashed
    expect(minDistance).to.be.greaterThan(celestialBodyDef.radius! * 0.8);
    // Satellite should not have escaped (e.g., not more than 5x initial distance for this test)
    expect(maxDistance).to.be.lessThan(initialDistance * 5);
    // It has moved significantly
    expect(satellite.position.x).to.not.be.closeTo(
      satelliteDef.initialPosition.x,
      1
    );
    expect(satellite.position.y).to.not.be.closeTo(
      satelliteDef.initialPosition.y,
      1
    );
  });
});
