import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { ISerializedPhysicsEngineState } from "./types"; // Added for the new return type
// import Matter from "matter-js"; // Not directly used in assertions, Vector is from Matter
// import { PhysicsEngine, ICelestialBody, ICustomBodyPlugin } from "../PhysicsEngine"; // PhysicsEngine not directly used

import { determinismBaseScenario } from "./determinism.scenario";
import { runScenario } from "./test-runner.helper"; // ScenarioResult removed

describe("determinism", () => {
  it("should produce identical results for identical inputs across multiple runs", () => {
    const results1: ISerializedPhysicsEngineState = runScenario(
      determinismBaseScenario
    ); // Removed targetBodyId
    const results2: ISerializedPhysicsEngineState = runScenario(
      determinismBaseScenario
    ); // Removed targetBodyId

    // Instead of individual properties, compare the entire state object.
    // Note: Timestamps within the state will differ. We might need a custom deep equal
    // or to exclude timestamp from comparison for this specific test if it's too strict.
    // For now, a direct deep equal might fail due to timestamp.
    // A better approach for determinism would be to compare relevant parts like body states.
    // However, to keep it simple, let's stringify and compare without timestamp for this test.
    const { timestamp: ts1, ...comparableResults1 } = results1;
    const { timestamp: ts2, ...comparableResults2 } = results2;

    expect(comparableResults1).to.deep.equal(comparableResults2);

    // Original detailed check if they differ (can be kept for debugging)
    if (
      JSON.stringify(comparableResults1) !== JSON.stringify(comparableResults2)
    ) {
      console.log("Run 1 (excluding timestamp):", comparableResults1);
      console.log("Run 2 (excluding timestamp):", comparableResults2);
    }
  });

  it("should match known good simulation data (snapshot)", () => {
    const snapshotDir = path.join(__dirname, "__snapshots__");
    // Consider renaming snapshot file to reflect full state, e.g., PhysicsEngine.determinism.fullstate.snap.json
    // For now, keeping original name. Update if convention changes.
    const snapshotFileName = "PhysicsEngine.determinism.snap.json";
    const snapshotFile = path.join(snapshotDir, snapshotFileName);

    const currentResults: ISerializedPhysicsEngineState = runScenario(
      determinismBaseScenario
    ); // Removed targetBodyId

    if (process.env.UPDATE_SNAPSHOTS === "true") {
      if (!fs.existsSync(snapshotDir)) {
        fs.mkdirSync(snapshotDir, { recursive: true });
      }
      // Timestamp will be part of the snapshot. This is usually fine for snapshots,
      // as it ensures the snapshot was taken at a specific time if that matters.
      // If timestamp variations are problematic, it could be set to a fixed value or removed before stringifying.
      fs.writeFileSync(snapshotFile, JSON.stringify(currentResults, null, 2));
      console.log(`Snapshot updated: ${snapshotFile}`);
      expect(true).to.equal(true); // Test passes by updating
    } else {
      if (!fs.existsSync(snapshotFile)) {
        throw new Error(
          `Snapshot file not found: ${snapshotFile}. Run with UPDATE_SNAPSHOTS=true to create it.`
        );
      }
      const expectedResults = JSON.parse(
        fs.readFileSync(snapshotFile, "utf-8")
      ) as ISerializedPhysicsEngineState; // Updated type cast

      // Direct deep comparison. Timestamps might cause failures if not handled.
      // If snapshots are updated, the new timestamp will be saved.
      // If comparing against an old snapshot with a different timestamp, this will fail.
      // This is standard behavior for snapshots; they should be updated if the code changes output.
      expect(currentResults).to.deep.equal(expectedResults);
    }
  });
});
