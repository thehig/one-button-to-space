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

    it("should simulate an object orbiting a large celestial body");
  });
});
