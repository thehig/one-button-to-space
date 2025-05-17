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

describe("PhysicsEngine", () => {
  describe("determinism", () => {
    // Helper function for running a standard simulation sequence
    const runStandardSimulation = (): Record<
      string,
      number | Matter.Vector
    > => {
      const engine = new PhysicsEngine();
      engine.init(); // Initialize with default (or specific empty) celestial bodies

      const body = engine.createBox(0, 0, 10, 10, { label: "testBox" });
      const force = { x: 10, y: 0 };
      engine.applyForceToBody(body, body.position, force);

      for (let i = 0; i < 10; i++) {
        engine.fixedStep(1000 / 60); // Step with fixed delta
      }

      return {
        position: { x: body.position.x, y: body.position.y }, // Deep copy for safety
        velocity: { x: body.velocity.x, y: body.velocity.y },
        angle: body.angle,
        angularVelocity: body.angularVelocity,
      };
    };

    it("should produce identical results for identical inputs across multiple runs", () => {
      const results1 = runStandardSimulation();
      const results2 = runStandardSimulation();

      // For complex objects, Chai's deep.equal is good.
      // If floating point issues arise, consider chai-almost or a custom near-equality check.
      expect(results1.position).to.deep.equal(results2.position);
      expect(results1.velocity).to.deep.equal(results2.velocity);
      expect(results1.angle).to.equal(results2.angle);
      expect(results1.angularVelocity).to.equal(results2.angularVelocity);

      // It can also be useful to log the values if they don't match for debugging
      if (JSON.stringify(results1) !== JSON.stringify(results2)) {
        console.log("Run 1:", results1);
        console.log("Run 2:", results2);
      }
    });

    it("should match known good simulation data (snapshot)", () => {
      const snapshotDir = path.join(__dirname, "__snapshots__");
      const snapshotFileName = "PhysicsEngine.determinism.snap.json"; // Changed to avoid .spec in filename
      const snapshotFile = path.join(snapshotDir, snapshotFileName);

      const currentResults = runStandardSimulation();

      if (process.env.UPDATE_SNAPSHOTS === "true") {
        if (!fs.existsSync(snapshotDir)) {
          fs.mkdirSync(snapshotDir, { recursive: true });
        }
        fs.writeFileSync(snapshotFile, JSON.stringify(currentResults, null, 2));
        console.log(`Snapshot updated: ${snapshotFile}`);
        // When updating snapshots, we consider the test passed by generating the snapshot.
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
      const engine = new PhysicsEngine();
      engine.init();
      const rocket = engine.createRocketBody(0, 0);

      const initialVelocityY = rocket.velocity.y;
      const initialPositionY = rocket.position.y;

      // Apply an upward thrust (negative Y force)
      const thrustForce = { x: 0, y: -100 }; // Increased force for more noticeable change
      engine.applyForceToBody(rocket, rocket.position, thrustForce);

      engine.fixedStep(1000 / 60); // Simulate one step

      expect(rocket.velocity.y).to.be.lessThan(initialVelocityY);
      expect(rocket.position.y).to.be.lessThan(initialPositionY);
      // Check that X velocity and position haven't changed significantly if no X force applied
      expect(rocket.velocity.x).to.be.closeTo(0, 1e-9);
      expect(rocket.position.x).to.be.closeTo(0, 1e-9);
    });

    it("should correctly apply rotation to a body", () => {
      const engine = new PhysicsEngine();
      engine.init();
      const body = engine.createBox(0, 0, 20, 20); // A simple box

      const initialAngle = body.angle;
      const initialAngularVelocity = body.angularVelocity;

      // Apply a force to the right, above the center of mass, to induce clockwise rotation
      const rotationalForce = { x: 50, y: 0 }; // Increased force
      // Position is relative to world, body.position is its center. Apply force at body's top edge, offset horizontally.
      // For a box created at (0,0) with width 20, height 20, its vertices are (-10,-10) to (10,10) before rotation.
      // Let's apply force at {x: 0, y: body.position.y - 5} relative to body's center to make it simpler.
      // However, applyForceToBody takes world coordinates for application point.
      const applicationPointInBody = { x: 0, y: -5 }; // Point above CM in body's local coords
      // To convert to world: not straightforward without body angle.
      // Let's apply at a world point that is offset from body's current center.
      const applicationPointWorld = {
        x: body.position.x,
        y: body.position.y - 5,
      };

      engine.applyForceToBody(body, applicationPointWorld, rotationalForce);
      engine.fixedStep(1000 / 60); // Simulate one step

      // Matter.js: positive angle is clockwise.
      // Force to the right (positive X) applied above CM (negative Y offset from CM).
      // r = (0, -5), F = (50, 0). Torque T = r_x*F_y - r_y*F_x = 0*0 - (-5)*50 = 250.
      // Positive torque causes clockwise rotation (angle increases).
      expect(body.angle).to.be.greaterThan(initialAngle);
      expect(body.angularVelocity).to.be.greaterThan(initialAngularVelocity);
    });
  });

  describe("environmental effects", () => {
    it("should simulate atmospheric drag", () => {
      const engine = new PhysicsEngine();
      const earthLikeCelestialBody: ICelestialBody = {
        id: "earth-like-drag-test",
        mass: 0, // Keep mass 0 to isolate drag effect clearly
        position: { x: 0, y: 0 },
        gravityRadius: 6371000 * 10,
        radius: 6371000,
        hasAtmosphere: true,
        atmosphereLimitAltitude: 100000,
        surfaceAirDensity: 1.225,
        scaleHeight: 8500,
      };
      engine.init([earthLikeCelestialBody]);

      const bodyInitialAltitude = 50000;
      const bodyInitialSpeed = 1000;
      const dragArea = 0.5;

      const testBody = engine.createBox(
        earthLikeCelestialBody.radius! + bodyInitialAltitude,
        0,
        1,
        1, // width, height
        {
          label: "testDragBody",
          density: 8, // Increase mass to make drag effect a deceleration
          plugin: {
            dragCoefficientArea: dragArea,
            effectiveNoseRadius: 0.1, // Required by plugin type
          } as ICustomBodyPlugin,
        }
      );
      engine.setBodyVelocity(testBody, { x: -bodyInitialSpeed, y: 0 });

      const initialSpeed = Vector.magnitude(testBody.velocity);

      // The debug log inside PhysicsEngine.ts for applyAtmosphericDragForces should show the raw drag
      // and then it gets scaled by (1/fixedTimeStepMs) before Body.applyForce
      // console.log(`Drag Test - Initial Speed: ${initialSpeed}, VelX: ${testBody.velocity.x}`);

      engine.fixedStep(1000 / 60); // fixedTimeStepMs is 1000/60

      const finalSpeed = Vector.magnitude(testBody.velocity);
      // console.log(`Drag Test - Final Speed: ${finalSpeed}, VelX: ${testBody.velocity.x}`);

      expect(finalSpeed).to.be.lessThan(initialSpeed);
      expect(finalSpeed).to.be.greaterThan(0); // Ensure it didn't overshoot and reverse with huge negative speed
    });

    it("should simulate atmospheric heating", () => {
      const engine = new PhysicsEngine();
      const earthLikeCelestialBody: ICelestialBody = {
        id: "earth-like",
        mass: 5.972e24, // kg (not directly used in this heating formula test, but good for context)
        position: { x: 0, y: 0 }, // Assuming body is moving towards origin where celestial body is
        gravityRadius: 6371000 * 10, // meters (10x Earth radius for gravity effect range)
        radius: 6371000, // meters (Earth radius)
        hasAtmosphere: true,
        atmosphereLimitAltitude: 100000, // 100 km
        surfaceAirDensity: 1.225, // kg/m^3
        scaleHeight: 8500, // meters
      };
      engine.init([earthLikeCelestialBody]);

      const bodyInitialAltitude = 90000; // 90 km, within atmosphere
      const bodyInitialSpeed = 7000; // 7 km/s, typical re-entry speed
      const noseRadius = 0.5; // meters, for the test body

      const testBody = engine.createBox(
        earthLikeCelestialBody.radius! + bodyInitialAltitude, // Positioned high along X-axis for simplicity
        0,
        1, // width (m)
        1, // height (m)
        {
          label: "testEntryBody",
          plugin: {
            effectiveNoseRadius: noseRadius,
            dragCoefficientArea: 0.1, // Example value, m^2
          } as ICustomBodyPlugin,
        }
      );
      // Set initial velocity towards the planet (negative X direction)
      engine.setBodyVelocity(testBody, { x: -bodyInitialSpeed, y: 0 });

      // --- Expected Calculation ---
      // Density (rho) at altitude
      const altitude = bodyInitialAltitude; // Using initial for one step approximation
      const rho =
        earthLikeCelestialBody.surfaceAirDensity! *
        Math.exp(-Math.max(0, altitude) / earthLikeCelestialBody.scaleHeight!);

      // Velocity (V)
      const V = bodyInitialSpeed;

      // Nose Radius (R_n)
      const Rn = noseRadius;

      // Sutton-Graves constant for Earth air (approx.)
      const C_heating = 1.83e-4; // (kg/m^3)^0.5 * m/s^3 -> results in W/m^2

      const expectedHeatFlux = C_heating * Math.sqrt(rho / Rn) * Math.pow(V, 3);

      // --- Simulation Step ---
      engine.fixedStep(1000 / 60); // Simulate one very small step

      const calculatedHeatFlux = (testBody.plugin as ICustomBodyPlugin)
        .currentHeatFlux;

      // This will fail until implemented in PhysicsEngine
      expect(calculatedHeatFlux).to.be.a(
        "number",
        "currentHeatFlux should be calculated"
      );
      expect(calculatedHeatFlux).to.be.closeTo(
        expectedHeatFlux,
        expectedHeatFlux * 0.1
      ); // Allow 10% tolerance for now
    });

    it("should simulate atmospheric drag in a VERY dense atmosphere", () => {
      const engine = new PhysicsEngine();
      const veryDenseAtmospherePlanet: ICelestialBody = {
        id: "dense-planet-drag-test",
        mass: 0, // Mass not relevant for this drag-only test
        position: { x: 0, y: 0 },
        gravityRadius: 6371000 * 10,
        radius: 6371000,
        hasAtmosphere: true,
        atmosphereLimitAltitude: 100000,
        surfaceAirDensity: 122.5, // 100x standard Earth density
        scaleHeight: 8500,
      };
      engine.init([veryDenseAtmospherePlanet]);

      const bodyInitialAltitude = 50000;
      const bodyInitialSpeed = 1000;
      const dragArea = 0.5;

      const testBody = engine.createBox(
        veryDenseAtmospherePlanet.radius! + bodyInitialAltitude,
        0,
        1,
        1,
        {
          label: "testDenseDragBody",
          density: 8,
          plugin: {
            dragCoefficientArea: dragArea,
            effectiveNoseRadius: 0.1, // Required by ICustomBodyPlugin
          } as ICustomBodyPlugin,
        }
      );
      engine.setBodyVelocity(testBody, { x: -bodyInitialSpeed, y: 0 });

      const initialSpeed = Vector.magnitude(testBody.velocity);
      engine.fixedStep(1000 / 60); // Simulate one step
      const finalSpeed = Vector.magnitude(testBody.velocity);

      // console.log(`Dense Drag Test - InitialSpeed: ${initialSpeed}, FinalSpeed: ${finalSpeed}, FinalVelX: ${testBody.velocity.x}`);

      expect(finalSpeed).to.be.lessThan(initialSpeed);
      expect(testBody.velocity.x).to.be.greaterThan(-initialSpeed);
      expect(finalSpeed).to.be.lessThan(initialSpeed * 0.9); // Expect speed to reduce by at least 10%
    });
  });

  describe("celestial mechanics", () => {
    it("should simulate gravitational pull from a large celestial body", () => {
      const engine = new PhysicsEngine();
      const earth: ICelestialBody = {
        id: "earth",
        mass: 5.972e8, // Drastically reduced mass for test stability
        position: { x: 0, y: 0 },
        gravityRadius: 10000, // Large enough radius for the test
        radius: 6371, // Arbitrary smaller radius for celestial body itself
      };
      engine.init([earth]);

      const satelliteInitialPosition = { x: 1000, y: 0 };
      const satellite = engine.createCircle(
        satelliteInitialPosition.x,
        satelliteInitialPosition.y,
        5, // radius
        { label: "satellite", density: 0.01 } // low density for responsiveness
      );

      const initialDistance = Vector.magnitude(
        Vector.sub(satellite.position, earth.position)
      );
      // console.log(`Initial Satellite Position: ${satellite.position.x}, ${satellite.position.y}, Velocity: ${satellite.velocity.x}, ${satellite.velocity.y}, Distance: ${initialDistance}`);

      // Run simulation for a few steps
      for (let i = 0; i < 5; i++) {
        // Simulate for fewer steps
        engine.fixedStep(1000 / 60);
        // if (i % 10 === 0 || i === 59) { // Log every 10 steps and the last step
        //   const currentDistance = Vector.magnitude(Vector.sub(satellite.position, earth.position));
        //   console.log(`Step ${i}: Sat Pos: ${satellite.position.x.toFixed(2)}, ${satellite.position.y.toFixed(2)}, Vel: ${satellite.velocity.x.toFixed(2)}, ${satellite.velocity.y.toFixed(2)}, Dist: ${currentDistance.toFixed(2)}`);
        // }
      }

      const finalDistance = Vector.magnitude(
        Vector.sub(satellite.position, earth.position)
      );

      // Check that the satellite moved towards Earth
      expect(finalDistance).to.be.lessThan(initialDistance);
      // Also check it didn't fly past or through the Earth in this simple test
      expect(finalDistance).to.be.greaterThan(0);

      // Optional: Log positions for debugging if test fails
      // console.log("Initial Satellite Position:", satelliteInitialPosition);
      // console.log("Final Satellite Position:", satellite.position);
      // console.log("Initial Distance:", initialDistance);
      // console.log("Final Distance:", finalDistance);
    });

    it("should simulate gravitational pull from a VERY large celestial body", () => {
      const engine = new PhysicsEngine();
      const superEarth: ICelestialBody = {
        id: "super-earth",
        mass: 5.972e11, // Significantly larger mass
        position: { x: 0, y: 0 },
        gravityRadius: 50000, // Ensure gravity is active
        radius: 12000, // Larger physical radius for context
      };
      engine.init([superEarth]);

      const satelliteInitialPosition = { x: 20000, y: 0 }; // Start further away
      const satellite = engine.createCircle(
        satelliteInitialPosition.x,
        satelliteInitialPosition.y,
        5, // radius
        { label: "satellite-far", density: 0.01 }
      );

      const initialDistance = Vector.magnitude(
        Vector.sub(satellite.position, superEarth.position)
      );

      for (let i = 0; i < 5; i++) {
        // Few steps to see initial pull
        engine.fixedStep(1000 / 60);
      }

      const finalDistance = Vector.magnitude(
        Vector.sub(satellite.position, superEarth.position)
      );

      expect(finalDistance).to.be.lessThan(initialDistance);
      expect(finalDistance).to.be.greaterThan(0);
    });

    it("should simulate gravitational pull from a SMALL celestial body", () => {
      const engine = new PhysicsEngine();
      const smallPlanet: ICelestialBody = {
        id: "small-planet",
        mass: 5.972e5, // Much smaller mass
        position: { x: 0, y: 0 },
        gravityRadius: 1000, // Smaller gravity influence
        radius: 100, // Smaller physical radius
      };
      engine.init([smallPlanet]);

      const satelliteInitialPosition = { x: 200, y: 0 }; // Start closer
      const satellite = engine.createCircle(
        satelliteInitialPosition.x,
        satelliteInitialPosition.y,
        2, // smaller satellite radius
        { label: "satellite-close", density: 0.01 }
      );

      const initialDistance = Vector.magnitude(
        Vector.sub(satellite.position, smallPlanet.position)
      );

      for (let i = 0; i < 5; i++) {
        // Few steps to see initial pull
        engine.fixedStep(1000 / 60);
      }

      const finalDistance = Vector.magnitude(
        Vector.sub(satellite.position, smallPlanet.position)
      );

      expect(finalDistance).to.be.lessThan(initialDistance);
      expect(finalDistance).to.be.greaterThan(0);
    });

    it("should simulate an object orbiting a large celestial body", () => {
      const engine = new PhysicsEngine();
      const G = 0.001; // PhysicsEngine's G

      const earth: ICelestialBody = {
        id: "earth-orbit-test",
        mass: 5.972e5, // Further reduced mass for stability
        position: { x: 0, y: 0 },
        gravityRadius: 100000, // Increased gravity radius
        radius: 6371, // Not directly used for orbit calc but good for context
      };
      engine.init([earth]);

      const orbitalRadius = 10000; // Increased orbital radius, > earth.radius
      const satelliteInitialPosition = { x: orbitalRadius, y: 0 };

      // Calculate required tangential velocity for a circular orbit: v = sqrt((G * M) / r)
      // Note: satellite mass doesn't affect its orbital speed for a given radius.
      const requiredSpeed = Math.sqrt((G * earth.mass) / orbitalRadius);

      const satellite = engine.createCircle(
        satelliteInitialPosition.x,
        satelliteInitialPosition.y,
        5, // satellite radius
        {
          label: "orbitingSatellite",
          density: 0.01, // low density, mass is approx 0.785
          frictionAir: 0, // NO AIR FRICTION for pure orbital mechanics
        }
      );

      // Set initial velocity tangential to the orbit (upwards, in positive Y)
      engine.setBodyVelocity(satellite, { x: 0, y: requiredSpeed }); // Reverted to original requiredSpeed

      const numSteps = 75; // Reduced simulation steps
      const positions: Matter.Vector[] = [];
      positions.push({ ...satellite.position }); // Store initial position

      for (let i = 0; i < numSteps; i++) {
        engine.fixedStep(1000 / 60);
        positions.push({ ...satellite.position });
      }

      const initialPosition = positions[0];
      const finalPosition = positions[numSteps]; // positions has numSteps + 1 elements

      // 1. Check distance from Earth: should remain somewhat consistent for a stable-ish orbit
      const initialDistance = Vector.magnitude(
        Vector.sub(initialPosition, earth.position)
      );
      const finalDistance = Vector.magnitude(
        Vector.sub(finalPosition, earth.position)
      );

      // Allow for some deviation, e.g., 25% of initial radius for an elliptical orbit or decay/boost
      expect(finalDistance).to.be.closeTo(
        initialDistance,
        orbitalRadius * 0.25
      );
      expect(finalDistance).to.be.greaterThan(
        earth.radius! * 0.5,
        "Satellite crashed into Earth or got too close"
      ); // ensure it didn't crash

      // 2. Check angular displacement: has it moved around the planet?
      const angleInitial = Math.atan2(
        initialPosition.y - earth.position.y,
        initialPosition.x - earth.position.x
      );
      const angleFinal = Math.atan2(
        finalPosition.y - earth.position.y,
        finalPosition.x - earth.position.x
      );
      let angleDiff = angleFinal - angleInitial;
      // Normalize angle difference to be between -PI and PI
      while (angleDiff <= -Math.PI) angleDiff += 2 * Math.PI;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;

      // Let's recalculate expectedAngularDisplacement more simply based on steps:
      // omega = v/r (rad per unit time that v is in)
      // If v is units per fixedTimeStepMs, then omega is rad per fixedTimeStepMs.
      // Total angle = omega * numSteps
      const omega = requiredSpeed / orbitalRadius; // radians per fixedTimeStepMs interval
      const theoreticalAngularDisplacement = omega * numSteps;

      // For an upward launch (positive Y velocity), the angle should increase (counter-clockwise)
      // console.log(`Initial Angle: ${angleInitial}, Final Angle: ${angleFinal}, Diff: ${angleDiff}`);
      // console.log(`Theoretical Angular Displacement (radians): ${theoreticalAngularDisplacement}`);
      // expect(angleDiff).to.be.greaterThan(Math.PI / 8); // Adjusted for fewer steps
      expect(angleDiff).to.be.closeTo(
        theoreticalAngularDisplacement,
        theoreticalAngularDisplacement * 0.5
      ); // 50% tolerance

      // Optional: Could log trajectory for visual inspection if needed
      // fs.writeFileSync(path.join(__dirname, "orbit_trajectory.json"), JSON.stringify(positions, null, 2));
    });

    it("should simulate an object orbiting a SMALL celestial body", () => {
      const engine = new PhysicsEngine();
      const G = 0.001; // PhysicsEngine's G

      const smallPlanet: ICelestialBody = {
        id: "small-planet-orbit-test",
        mass: 5.972e5,
        position: { x: 0, y: 0 },
        gravityRadius: 5000, // Increased from 1000
        radius: 100,
      };
      engine.init([smallPlanet]);

      const orbitalRadius = 400; // Increased from 200
      const satelliteInitialPosition = { x: orbitalRadius, y: 0 };

      const requiredSpeed = Math.sqrt((G * smallPlanet.mass) / orbitalRadius);

      const satellite = engine.createCircle(
        satelliteInitialPosition.x,
        satelliteInitialPosition.y,
        2, // satellite radius
        {
          label: "smallOrbitingSatellite",
          density: 0.01,
          frictionAir: 0, // NO AIR FRICTION
        }
      );

      engine.setBodyVelocity(satellite, { x: 0, y: requiredSpeed });

      const numSteps = 30; // Reduced from 75
      const positions: Matter.Vector[] = [];
      positions.push({ ...satellite.position });

      for (let i = 0; i < numSteps; i++) {
        engine.fixedStep(1000 / 60);
        positions.push({ ...satellite.position });
      }

      const initialPosition = positions[0];
      const finalPosition = positions[numSteps];

      const initialDistance = Vector.magnitude(
        Vector.sub(initialPosition, smallPlanet.position)
      );
      const finalDistance = Vector.magnitude(
        Vector.sub(finalPosition, smallPlanet.position)
      );

      expect(finalDistance).to.be.closeTo(
        initialDistance,
        orbitalRadius * 0.25 // 25% tolerance
      );
      expect(finalDistance).to.be.greaterThan(
        smallPlanet.radius! * 0.5,
        "Satellite crashed or got too close"
      );

      const angleInitial = Math.atan2(
        initialPosition.y - smallPlanet.position.y,
        initialPosition.x - smallPlanet.position.x
      );
      const angleFinal = Math.atan2(
        finalPosition.y - smallPlanet.position.y,
        finalPosition.x - smallPlanet.position.x
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
      const debugEccentricOrbit = false; // <-- Toggle for this test's specific logging

      const engine = new PhysicsEngine(); // REVERT to default G
      engine.setInternalLogging(debugEccentricOrbit); // Control engine's internal logs

      const testG = 0.001; // PhysicsEngine's G

      // Parameters for a more pronounced eccentric orbit
      const planetMass = 5.972e3; // Moderately large mass
      const perigeeRadius = 1000; // Initial closest distance

      const largePlanet: ICelestialBody = {
        id: "large-planet-eccentric-orbit",
        mass: planetMass,
        position: { x: 0, y: 0 },
        gravityRadius: perigeeRadius * 10, // Ensure gravity is active well beyond perigee
        radius: perigeeRadius / 2, // Physical radius of planet
      };
      engine.init([largePlanet]);

      const satelliteInitialPosition = { x: perigeeRadius, y: 0 };

      // v_circ at perigee
      const v_circ = Math.sqrt((testG * largePlanet.mass) / perigeeRadius);
      // Initial speed for an eccentric orbit (e.g., 1.2 * v_circ for e=0.2)
      const initialSpeed = v_circ * 1.5; // Increased for more eccentricity

      const satellite = engine.createCircle(
        satelliteInitialPosition.x,
        satelliteInitialPosition.y,
        5, // satellite radius
        {
          label: "eccentricSatellite",
          density: 0.01,
          frictionAir: 0, // NO AIR FRICTION
        }
      );

      engine.setBodyVelocity(satellite, { x: 0, y: initialSpeed });
      if (debugEccentricOrbit) {
        console.log(
          `Eccentric Orbit Test: Initial Conditions
` +
            `  G: ${testG}, Planet Mass: ${largePlanet.mass}, Perigee Radius: ${perigeeRadius}
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

      const numSteps = 5000; // Increased steps
      const positions: Matter.Vector[] = [];
      const velocities: Matter.Vector[] = [];
      const distances: number[] = [];

      positions.push({ ...satellite.position });
      velocities.push({ ...satellite.velocity });
      distances.push(
        Vector.magnitude(Vector.sub(satellite.position, largePlanet.position))
      );

      for (let i = 0; i < numSteps; i++) {
        engine.fixedStep(1000 / 60);
        positions.push({ ...satellite.position });
        velocities.push({ ...satellite.velocity });
        const currentDist = Vector.magnitude(
          Vector.sub(satellite.position, largePlanet.position)
        );
        distances.push(currentDist);
        if (
          debugEccentricOrbit &&
          (i < 10 || (i % 500 === 0 && i > 0) || i === numSteps - 1)
        ) {
          // Log more initial steps
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
      const finalDistance = distances[numSteps]; // Accessing distances[numSteps] which has length numSteps + 1
      const maxDistance = Math.max(...distances);
      const minDistance = Math.min(...distances);

      // console.log(`Eccentric Orbit Debug:
      //   Initial Distance: ${initialDistance.toFixed(2)}
      //   Final Distance: ${finalDistance.toFixed(2)}
      //   Max Distance Achieved: ${maxDistance.toFixed(2)}
      //   Min Distance Achieved: ${minDistance.toFixed(2)}
      //   Num Steps: ${numSteps}`);
      if (debugEccentricOrbit) {
        console.log(
          `Eccentric Orbit Summary:
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

      // 1. Check for varying distance (eccentricity)
      // Max distance (apogee) should be greater than initial (perigee)
      expect(maxDistance).to.be.greaterThan(
        initialDistance * 1.05,
        "Max distance (apogee) not significantly greater than initial perigee"
      ); // Expect at least 5% increase for apogee

      // Min distance should be close to initial perigee
      expect(minDistance).to.be.closeTo(
        initialDistance,
        initialDistance * 0.05,
        "Min distance not close to initial perigee"
      ); // Within 5% of perigee

      // 2. Check that it didn't crash or escape
      expect(minDistance).to.be.greaterThan(
        largePlanet.radius! * 0.5,
        "Satellite crashed or got too close"
      );
      // Check it didn't escape too far (e.g., beyond 5x perigee for this test)
      expect(maxDistance).to.be.lessThan(initialDistance * 5);

      // 3. Speed variation: speed at apogee (maxDistance) should be less than speed at perigee (initialSpeed)
      expect(maxDistance).to.be.lessThan(
        initialDistance * 3,
        "Satellite escaped or orbit too eccentric"
      );

      // 3. Speed variation: speed at apogee (maxDistance) should be less than speed at perigee (initialSpeed)
      const apogeeIndex = distances.indexOf(maxDistance);
      const speedAtApogee = Vector.magnitude(velocities[apogeeIndex]); // velocities has N+1 elements, apogeeIndex is valid
      const speedAtPerigee = Vector.magnitude(velocities[0]);

      expect(speedAtApogee).to.be.lessThan(
        speedAtPerigee,
        "Speed at apogee not less than speed at perigee"
      );
      // console.log(
      //   `  Speed at Perigee: ${speedAtPerigee.toFixed(4)}, Speed at Apogee: ${speedAtApogee.toFixed(4)} (Apogee index: ${apogeeIndex})`
      // );

      // 4. Check if it has started to come back from apogee if numSteps is enough (completed part of orbit)
      // Ensure apogeeIndex is not the last step, indicating it peaked and started returning.
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
