import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
// import Matter from "matter-js"; // Not directly used in assertions, Vector is from Matter
// import { PhysicsEngine, ICelestialBody, ICustomBodyPlugin } from "../PhysicsEngine"; // PhysicsEngine not directly used

import { determinismBaseScenario } from "./determinism.scenario";
import { runScenario, ScenarioResult } from "./test-runner.helper";

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
    const snapshotFileName = "PhysicsEngine.determinism.snap.json"; // Keep original name for now
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
      ) as ScenarioResult; // Cast to ScenarioResult
      expect(currentResults).to.deep.equal(expectedResults);
    }
  });
});
