import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { PhysicsEngine } from "./PhysicsEngine"; // Assuming PhysicsEngine.ts is in the same directory

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
      // TODO: Test thrust_on
      expect(true).to.equal(true); // Placeholder
    });

    it("should correctly apply rotation to a body", () => {
      // TODO: Test turn_left / turn_right
      expect(true).to.equal(true); // Placeholder
    });
  });

  describe("environmental effects", () => {
    it("should simulate atmospheric drag", () => {
      // TODO: Test atmospheric drag
      expect(true).to.equal(true); // Placeholder
    });

    it("should simulate atmospheric heating", () => {
      // TODO: Test atmospheric heating
      expect(true).to.equal(true); // Placeholder
    });
  });

  describe("celestial mechanics", () => {
    it("should simulate gravitational pull from a large celestial body", () => {
      // TODO: Test gravity from a large body
      expect(true).to.equal(true); // Placeholder
    });

    it("should simulate an object orbiting a large celestial body", () => {
      // TODO: Test orbiting objects
      expect(true).to.equal(true); // Placeholder
    });
  });
});
