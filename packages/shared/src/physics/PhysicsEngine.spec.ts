import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import Matter, { Vector } from "matter-js"; // Import Matter and Vector namespaces
import {
  PhysicsEngine,
  ICelestialBody,
  ICustomBodyPlugin,
} from "./PhysicsEngine"; // Assuming PhysicsEngine.ts is in the same directory
import {
  IScenario,
  ScenarioBodyInitialState,
  ScenarioAction,
  determinismBaseScenario,
  thrustScenario,
  rotationScenario,
  atmosphericDragScenario,
  atmosphericHeatingScenario,
  denseAtmosphereDragScenario,
  gravityPullLargeBodyScenario,
  gravityPullVeryLargeBodyScenario,
  gravityPullSmallBodyScenario,
  orbitLargeBodyScenario,
  orbitSmallBodyScenario,
  eccentricOrbitScenario,
} from "./PhysicsEngine.scenarios"; // Import scenario types and specific scenario

// Define the structure for the result of runScenario, specific to determinism tests
interface ScenarioResult {
  position: Matter.Vector;
  velocity: Matter.Vector;
  angle: number;
  angularVelocity: number;
}

/**
 * Runs a defined physics scenario and returns the state of a target body.
 * @param scenario The scenario definition.
 * @param targetBodyIdToTrack The ID of the body whose final state is to be returned.
 * @returns The final state (position, velocity, angle, angularVelocity) of the target body.
 */
const runScenario = (
  scenario: IScenario,
  targetBodyIdToTrack: string
): ScenarioResult => {
  const engineSettings = scenario.engineSettings;
  const engine = new PhysicsEngine(
    engineSettings?.fixedTimeStepMs,
    engineSettings?.customG
  );
  if (engineSettings?.enableInternalLogging !== undefined) {
    engine.setInternalLogging(engineSettings.enableInternalLogging);
  }

  engine.init(scenario.celestialBodies);

  const createdBodies: Map<string, Matter.Body> = new Map();

  for (const bodyDef of scenario.initialBodies) {
    let body: Matter.Body;
    const optionsWithLabel = { ...bodyDef.options, label: bodyDef.label }; // Ensure label is passed

    switch (bodyDef.type) {
      case "box":
        body = engine.createBox(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.width!,
          bodyDef.height!,
          optionsWithLabel
        );
        break;
      case "circle":
        body = engine.createCircle(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.radius!,
          optionsWithLabel
        );
        break;
      case "rocket":
        // Assuming createRocketBody doesn't take a general options object in the same way,
        // or that its specific options are handled internally or are not part of this scenario type yet.
        // For now, a simple creation. If options are needed, adjust createRocketBody or scenario structure.
        body = engine.createRocketBody(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y
        );
        // If rocket needs options like label, density from scenario, apply them post-creation if possible
        // e.g., if (optionsWithLabel.label) body.label = optionsWithLabel.label;
        // Matter.Body.setDensity(body, optionsWithLabel.density || default_density_for_rocket);
        break;
      default:
        throw new Error(`Unsupported body type in scenario: ${bodyDef.type}`);
    }

    if (bodyDef.initialVelocity) {
      engine.setBodyVelocity(body, bodyDef.initialVelocity);
    }
    if (bodyDef.initialAngle !== undefined) {
      Matter.Body.setAngle(body, bodyDef.initialAngle);
    }
    if (bodyDef.initialAngularVelocity !== undefined) {
      Matter.Body.setAngularVelocity(body, bodyDef.initialAngularVelocity);
    }
    createdBodies.set(bodyDef.id, body);
  }

  const fixedTimeStep = engineSettings?.fixedTimeStepMs || 1000 / 60;

  for (let i = 0; i < scenario.simulationSteps; i++) {
    // Apply actions scheduled for this step
    if (scenario.actions) {
      for (const action of scenario.actions) {
        if (action.step === i) {
          const targetBody = createdBodies.get(action.targetBodyId);
          if (!targetBody) {
            console.warn(
              `Action target body ID ${action.targetBodyId} not found in created bodies.`
            );
            continue;
          }
          switch (action.actionType) {
            case "applyForce":
              if (action.force && action.applicationPoint) {
                // Use the engine's applyForceToBody which handles scaling
                engine.applyForceToBody(
                  targetBody,
                  action.applicationPoint,
                  action.force
                );
              } else {
                console.warn(
                  "applyForce action missing force or applicationPoint"
                );
              }
              break;
            // Future action types can be added here
            default:
              console.warn(`Unsupported action type: ${action.actionType}`);
          }
        }
      }
    }
    engine.fixedStep(fixedTimeStep); // Step the engine
  }

  const finalBodyState = createdBodies.get(targetBodyIdToTrack);
  if (!finalBodyState) {
    throw new Error(
      `Target body ID ${targetBodyIdToTrack} for result tracking not found.`
    );
  }

  return {
    position: { x: finalBodyState.position.x, y: finalBodyState.position.y },
    velocity: { x: finalBodyState.velocity.x, y: finalBodyState.velocity.y },
    angle: finalBodyState.angle,
    angularVelocity: finalBodyState.angularVelocity,
  };
};

describe("PhysicsEngine", () => {
  describe("determinism", () => {
    it("should produce identical results for identical inputs across multiple runs", () => {
      const results1 = runScenario(determinismBaseScenario, "testBox1");
      const results2 = runScenario(determinismBaseScenario, "testBox1");

      expect(results1.position).to.deep.equal(results2.position);
      expect(results1.velocity).to.deep.equal(results2.velocity);
      expect(results1.angle).to.equal(results2.angle);
      expect(results1.angularVelocity).to.equal(results2.angularVelocity);

      if (JSON.stringify(results1) !== JSON.stringify(results2)) {
        console.log("Run 1:", results1);
        console.log("Run 2:", results2);
      }
    });

    it("should match known good simulation data (snapshot)", () => {
      const snapshotDir = path.join(__dirname, "__snapshots__");
      const snapshotFileName = "PhysicsEngine.determinism.snap.json";
      const snapshotFile = path.join(snapshotDir, snapshotFileName);

      const currentResults = runScenario(determinismBaseScenario, "testBox1");

      if (process.env.UPDATE_SNAPSHOTS === "true") {
        if (!fs.existsSync(snapshotDir)) {
          fs.mkdirSync(snapshotDir, { recursive: true });
        }
        fs.writeFileSync(snapshotFile, JSON.stringify(currentResults, null, 2));
        console.log(`Snapshot updated: ${snapshotFile}`);
        expect(true).to.equal(true);
      } else {
        if (!fs.existsSync(snapshotFile)) {
          throw new Error(
            `Snapshot file not found: ${snapshotFile}. Run with UPDATE_SNAPSHOTS=true to create it.`
          );
        }
        const expectedResults = JSON.parse(
          fs.readFileSync(snapshotFile, "utf-8")
        );
        expect(currentResults).to.deep.equal(expectedResults);
      }
    });
  });

  describe("basic actions", () => {
    it("should correctly apply thrust to a body", () => {
      // Initial conditions from the scenario definition
      const initialScenarioVelocityY =
        thrustScenario.initialBodies[0].initialVelocity?.y || 0;
      const initialScenarioPositionY =
        thrustScenario.initialBodies[0].initialPosition.y;

      // Run the scenario and get the final state of the rocket
      const finalRocketState = runScenario(thrustScenario, "thrustRocket");

      // Assertions based on the final state compared to known initial state
      expect(finalRocketState.velocity.y).to.be.lessThan(
        initialScenarioVelocityY
      );
      expect(finalRocketState.position.y).to.be.lessThan(
        initialScenarioPositionY
      );

      // Check that X velocity and position haven't changed significantly if no X force applied
      const initialScenarioVelocityX =
        thrustScenario.initialBodies[0].initialVelocity?.x || 0;
      const initialScenarioPositionX =
        thrustScenario.initialBodies[0].initialPosition.x;
      expect(finalRocketState.velocity.x).to.be.closeTo(
        initialScenarioVelocityX,
        1e-9
      );
      expect(finalRocketState.position.x).to.be.closeTo(
        initialScenarioPositionX,
        1e-9
      );
    });

    it("should correctly apply rotation to a body", () => {
      // Initial conditions from the scenario definition (angle and angularVelocity default to 0 if not set)
      const initialScenarioAngle =
        rotationScenario.initialBodies[0].initialAngle || 0;
      const initialScenarioAngularVelocity =
        rotationScenario.initialBodies[0].initialAngularVelocity || 0;

      // Run the scenario and get the final state of the box
      const finalBoxState = runScenario(rotationScenario, "rotationBox");

      // Assertions based on the final state compared to known initial state
      // Positive torque (force right, applied above CM) causes clockwise rotation (angle increases).
      expect(finalBoxState.angle).to.be.greaterThan(initialScenarioAngle);
      expect(finalBoxState.angularVelocity).to.be.greaterThan(
        initialScenarioAngularVelocity
      );
    });
  });

  describe("environmental effects", () => {
    it("should simulate atmospheric drag", () => {
      // Initial speed from the scenario definition
      const scenarioBody = atmosphericDragScenario.initialBodies.find(
        (b) => b.id === "dragTestBody"
      );
      if (!scenarioBody || !scenarioBody.initialVelocity) {
        throw new Error(
          "Drag test scenario body or initial velocity not defined correctly."
        );
      }
      const initialSpeed = Vector.magnitude(scenarioBody.initialVelocity);

      // Run the scenario
      const finalBodyState = runScenario(
        atmosphericDragScenario,
        "dragTestBody"
      );
      const finalSpeed = Vector.magnitude(finalBodyState.velocity);

      expect(finalSpeed).to.be.lessThan(initialSpeed);
      expect(finalSpeed).to.be.greaterThan(0); // Ensure it didn't overshoot and reverse
    });

    it("should simulate atmospheric heating", () => {
      // Get setup from the scenario definition
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

      // --- Expected Calculation (using scenario data) ---
      const altitude = bodyDef.initialPosition.x - celestialBodyDef.radius!; // Altitude from planet center
      const rho =
        celestialBodyDef.surfaceAirDensity! *
        Math.exp(-Math.max(0, altitude) / celestialBodyDef.scaleHeight!);
      const V = bodyInitialSpeed;
      const Rn = noseRadius;
      const C_heating = 1.83e-4;
      const expectedHeatFlux = C_heating * Math.sqrt(rho / Rn) * Math.pow(V, 3);

      // --- Simulation Step (matches scenario.simulationSteps which should be 1) ---
      engine.fixedStep(scenario.engineSettings?.fixedTimeStepMs || 1000 / 60); // Use scenario step or default

      const calculatedHeatFlux = (testBody.plugin as ICustomBodyPlugin)
        .currentHeatFlux;

      expect(calculatedHeatFlux).to.be.a(
        "number",
        "currentHeatFlux should be calculated"
      );
      expect(calculatedHeatFlux).to.be.closeTo(
        expectedHeatFlux,
        expectedHeatFlux * 0.1 // 10% tolerance
      );
    });

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
      // Original test had: expect(testBody.velocity.x).to.be.greaterThan(-initialSpeed);
      // This check is implicitly covered by finalSpeed > 0 if initial Y velocity is 0 and X is negative.
      // If we want to be explicit about X velocity:
      expect(finalBodyState.velocity.x).to.be.greaterThan(-initialSpeed); // Body is moving in -X
      expect(finalSpeed).to.be.lessThan(initialSpeed * 0.9); // Expect speed to reduce by at least 10%
    });
  });

  describe("celestial mechanics", () => {
    it("should simulate gravitational pull from a large celestial body", () => {
      const scenario = gravityPullLargeBodyScenario;
      const satelliteDef = scenario.initialBodies[0];
      const celestialBodyDef = scenario.celestialBodies![0];

      const initialDistance = Vector.magnitude(
        Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
      );

      const finalSatelliteState = runScenario(scenario, satelliteDef.id);

      const finalDistance = Vector.magnitude(
        Vector.sub(finalSatelliteState.position, celestialBodyDef.position)
      );

      expect(finalDistance).to.be.lessThan(initialDistance);
      expect(finalDistance).to.be.greaterThan(0);
    });

    it("should simulate gravitational pull from a VERY large celestial body", () => {
      const scenario = gravityPullVeryLargeBodyScenario;
      const satelliteDef = scenario.initialBodies[0];
      const celestialBodyDef = scenario.celestialBodies![0];

      const initialDistance = Vector.magnitude(
        Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
      );

      const finalSatelliteState = runScenario(scenario, satelliteDef.id);

      const finalDistance = Vector.magnitude(
        Vector.sub(finalSatelliteState.position, celestialBodyDef.position)
      );

      expect(finalDistance).to.be.lessThan(initialDistance);
      expect(finalDistance).to.be.greaterThan(0);
    });

    it("should simulate gravitational pull from a SMALL celestial body", () => {
      const scenario = gravityPullSmallBodyScenario;
      const satelliteDef = scenario.initialBodies[0];
      const celestialBodyDef = scenario.celestialBodies![0];

      const initialDistance = Vector.magnitude(
        Vector.sub(satelliteDef.initialPosition, celestialBodyDef.position)
      );

      const finalSatelliteState = runScenario(scenario, satelliteDef.id);

      const finalDistance = Vector.magnitude(
        Vector.sub(finalSatelliteState.position, celestialBodyDef.position)
      );

      expect(finalDistance).to.be.lessThan(initialDistance);
      expect(finalDistance).to.be.greaterThan(0);
    });

    it("should simulate an object orbiting a large celestial body", () => {
      const scenario = orbitLargeBodyScenario;
      const G = scenario.engineSettings!.customG!;
      const celestialBodyDef = scenario.celestialBodies![0];
      const satelliteDef = scenario.initialBodies[0];
      const orbitalRadius = satelliteDef.initialPosition.x; // Taken from scenario

      const engine = new PhysicsEngine(
        scenario.engineSettings?.fixedTimeStepMs,
        G
      );
      if (scenario.engineSettings?.enableInternalLogging) {
        engine.setInternalLogging(true);
      }
      engine.init(scenario.celestialBodies);

      // Calculate required tangential velocity for a circular orbit: v = sqrt((G * M) / r)
      const requiredSpeed = Math.sqrt(
        (G * celestialBodyDef.mass) / orbitalRadius
      );

      const satellite = engine.createCircle(
        satelliteDef.initialPosition.x,
        satelliteDef.initialPosition.y,
        satelliteDef.radius!,
        {
          label: satelliteDef.label,
          density: satelliteDef.options!.density,
          frictionAir: satelliteDef.options!.frictionAir,
        }
      );

      engine.setBodyVelocity(satellite, { x: 0, y: requiredSpeed });

      const numSteps = scenario.simulationSteps;
      const positions: Matter.Vector[] = [];
      positions.push({ ...satellite.position });

      for (let i = 0; i < numSteps; i++) {
        engine.fixedStep(scenario.engineSettings?.fixedTimeStepMs || 1000 / 60); // Use scenario step or default
        positions.push({ ...satellite.position });
      }

      const initialPosition = positions[0];
      const finalPosition = positions[numSteps];

      const initialDistance = Vector.magnitude(
        Vector.sub(initialPosition, celestialBodyDef.position)
      );
      const finalDistance = Vector.magnitude(
        Vector.sub(finalPosition, celestialBodyDef.position)
      );

      expect(finalDistance).to.be.closeTo(
        initialDistance,
        orbitalRadius * 0.25
      );
      expect(finalDistance).to.be.greaterThan(
        celestialBodyDef.radius! * 0.5,
        "Satellite crashed into Earth or got too close"
      );

      const angleInitial = Math.atan2(
        initialPosition.y - celestialBodyDef.position.y,
        initialPosition.x - celestialBodyDef.position.x
      );
      const angleFinal = Math.atan2(
        finalPosition.y - celestialBodyDef.position.y,
        finalPosition.x - celestialBodyDef.position.x
      );
      let angleDiff = angleFinal - angleInitial;
      while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

      const omega = requiredSpeed / orbitalRadius;
      const theoreticalAngularDisplacement = omega * numSteps;

      expect(angleDiff).to.be.closeTo(
        theoreticalAngularDisplacement,
        theoreticalAngularDisplacement * 0.5
      );
    });

    it("should simulate an object orbiting a SMALL celestial body", () => {
      const scenario = orbitSmallBodyScenario;
      const G = scenario.engineSettings!.customG!;
      const celestialBodyDef = scenario.celestialBodies![0];
      const satelliteDef = scenario.initialBodies[0];
      const orbitalRadius = satelliteDef.initialPosition.x;

      const engine = new PhysicsEngine(
        scenario.engineSettings?.fixedTimeStepMs,
        G
      );
      if (scenario.engineSettings?.enableInternalLogging) {
        engine.setInternalLogging(true);
      }
      engine.init(scenario.celestialBodies);

      const requiredSpeed = Math.sqrt(
        (G * celestialBodyDef.mass) / orbitalRadius
      );

      const satellite = engine.createCircle(
        satelliteDef.initialPosition.x,
        satelliteDef.initialPosition.y,
        satelliteDef.radius!,
        {
          label: satelliteDef.label,
          density: satelliteDef.options!.density,
          frictionAir: satelliteDef.options!.frictionAir,
        }
      );

      engine.setBodyVelocity(satellite, { x: 0, y: requiredSpeed });

      const numSteps = scenario.simulationSteps;
      const positions: Matter.Vector[] = [];
      positions.push({ ...satellite.position });

      for (let i = 0; i < numSteps; i++) {
        engine.fixedStep(scenario.engineSettings?.fixedTimeStepMs || 1000 / 60); // Use scenario step or default
        positions.push({ ...satellite.position });
      }

      const initialPosition = positions[0];
      const finalPosition = positions[numSteps];

      const initialDistance = Vector.magnitude(
        Vector.sub(initialPosition, celestialBodyDef.position)
      );
      const finalDistance = Vector.magnitude(
        Vector.sub(finalPosition, celestialBodyDef.position)
      );

      expect(finalDistance).to.be.closeTo(
        initialDistance,
        orbitalRadius * 0.25 // 25% tolerance
      );
      expect(finalDistance).to.be.greaterThan(
        celestialBodyDef.radius! * 0.5,
        "Satellite crashed or got too close"
      );

      const angleInitial = Math.atan2(
        initialPosition.y - celestialBodyDef.position.y,
        initialPosition.x - celestialBodyDef.position.x
      );
      const angleFinal = Math.atan2(
        finalPosition.y - celestialBodyDef.position.y,
        finalPosition.x - celestialBodyDef.position.x
      );
      let angleDiff = angleFinal - angleInitial;
      while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

      const omega = requiredSpeed / orbitalRadius;
      const theoreticalAngularDisplacement = omega * numSteps;

      expect(angleDiff).to.be.closeTo(
        theoreticalAngularDisplacement,
        theoreticalAngularDisplacement * 0.5 // 50% tolerance
      );
    });

    it("should simulate an eccentric orbit around a large celestial body", () => {
      const scenario = eccentricOrbitScenario;
      const debugEccentricOrbit =
        scenario.engineSettings!.enableInternalLogging!;
      const testG = scenario.engineSettings!.customG!;
      const celestialBodyDef = scenario.celestialBodies![0];
      const satelliteDef = scenario.initialBodies[0];
      const perigeeRadius = satelliteDef.initialPosition.x;

      const engine = new PhysicsEngine(
        scenario.engineSettings?.fixedTimeStepMs,
        testG
      );
      engine.setInternalLogging(debugEccentricOrbit); // Controlled by scenario
      engine.init(scenario.celestialBodies);

      const v_circ = Math.sqrt((testG * celestialBodyDef.mass) / perigeeRadius);
      const initialSpeed = v_circ * 1.5;

      const satellite = engine.createCircle(
        satelliteDef.initialPosition.x,
        satelliteDef.initialPosition.y,
        satelliteDef.radius!,
        {
          label: satelliteDef.label,
          density: satelliteDef.options!.density,
          frictionAir: satelliteDef.options!.frictionAir,
        }
      );

      engine.setBodyVelocity(satellite, { x: 0, y: initialSpeed });
      if (debugEccentricOrbit) {
        console.log(
          `Eccentric Orbit Test: Initial Conditions (from Scenario: ${scenario.id})
` +
            `  G: ${testG}, Planet Mass: ${celestialBodyDef.mass}, Perigee Radius: ${perigeeRadius}
` +
            `  Calculated v_circ: ${v_circ.toFixed(6)}
` +
            `  Target Initial Speed (v_circ * 1.5): ${initialSpeed.toFixed(6)}
` +
            `  Actual Initial Satellite Velocity: X=${satellite.velocity.x.toFixed(
              6
            )}, Y=${satellite.velocity.y.toFixed(6)}`
        );
      }

      const numSteps = scenario.simulationSteps;
      const positions: Matter.Vector[] = [];
      const velocities: Matter.Vector[] = [];
      const distances: number[] = [];

      positions.push({ ...satellite.position });
      velocities.push({ ...satellite.velocity });
      distances.push(
        Vector.magnitude(
          Vector.sub(satellite.position, celestialBodyDef.position)
        )
      );

      for (let i = 0; i < numSteps; i++) {
        engine.fixedStep(scenario.engineSettings?.fixedTimeStepMs || 1000 / 60);
        positions.push({ ...satellite.position });
        velocities.push({ ...satellite.velocity });
        const currentDist = Vector.magnitude(
          Vector.sub(satellite.position, celestialBodyDef.position)
        );
        distances.push(currentDist);
        if (
          debugEccentricOrbit &&
          (i < 10 || (i % 500 === 0 && i > 0) || i === numSteps - 1)
        ) {
          console.log(
            `Eccentric Step ${i}: ` +
              `Pos: X=${satellite.position.x.toFixed(
                3
              )}, Y=${satellite.position.y.toFixed(3)}, ` +
              `Vel: X=${satellite.velocity.x.toFixed(
                6
              )}, Y=${satellite.velocity.y.toFixed(6)}, ` +
              `Dist: ${currentDist.toFixed(3)}`
          );
        }
      }

      const initialDistance = distances[0];
      const finalDistance = distances[numSteps];
      const maxDistance = Math.max(...distances);
      const minDistance = Math.min(...distances);

      if (debugEccentricOrbit) {
        console.log(
          `Eccentric Orbit Summary (from Scenario: ${scenario.id}):
` +
            `  Initial Distance: ${initialDistance.toFixed(3)}
` +
            `  Final Distance:   ${finalDistance.toFixed(3)}
` +
            `  Max Distance:     ${maxDistance.toFixed(3)}
` +
            `  Min Distance:     ${minDistance.toFixed(3)}
` +
            `  Num Steps:        ${numSteps}`
        );
      }

      expect(maxDistance).to.be.greaterThan(
        initialDistance * 1.05,
        "Max distance (apogee) not significantly greater than initial perigee"
      );
      expect(minDistance).to.be.closeTo(
        initialDistance,
        initialDistance * 0.05,
        "Min distance not close to initial perigee"
      );
      expect(minDistance).to.be.greaterThan(
        celestialBodyDef.radius! * 0.5,
        "Satellite crashed or got too close"
      );
      expect(maxDistance).to.be.lessThan(initialDistance * 5);
      expect(maxDistance).to.be.lessThan(
        initialDistance * 3,
        "Satellite escaped or orbit too eccentric"
      );

      const apogeeIndex = distances.indexOf(maxDistance);
      const speedAtApogee = Vector.magnitude(velocities[apogeeIndex]);
      const speedAtPerigee = Vector.magnitude(velocities[0]);

      expect(speedAtApogee).to.be.lessThan(
        speedAtPerigee,
        "Speed at apogee not less than speed at perigee"
      );

      if (numSteps > 50 && apogeeIndex > 0 && apogeeIndex < numSteps - 5) {
        const distanceAfterApogee =
          distances[apogeeIndex + Math.min(5, numSteps - apogeeIndex - 1)];
        expect(distanceAfterApogee).to.be.lessThan(
          maxDistance,
          "Satellite did not start returning from apogee"
        );
      }
    });
  });
});
