import { expect } from "chai";
import "mocha";
// import * as fs from "fs"; // No longer needed
// import * as path from "path"; // No longer needed
import { ISerializedPhysicsEngineState } from "./types";

import { determinismBaseScenario } from "./determinism.scenario";
// Import runTestAndSnapshot from the helper
import { runScenario, runTestAndSnapshot } from "./test-runner.helper";

describe("determinism", () => {
  it("should produce identical results for identical inputs across multiple runs", () => {
    const results1: ISerializedPhysicsEngineState = runScenario(
      determinismBaseScenario
    );
    const results2: ISerializedPhysicsEngineState = runScenario(
      determinismBaseScenario
    );

    const { simulationTick: tick1, ...comparableResults1 } = results1;
    const { simulationTick: tick2, ...comparableResults2 } = results2;

    expect(tick1).to.equal(
      tick2,
      "Simulation ticks should be identical for two identical runs"
    );

    expect(comparableResults1).to.deep.equal(
      comparableResults2,
      "Simulation results (excluding tick) should be identical for two identical runs"
    );

    if (
      JSON.stringify(comparableResults1) !== JSON.stringify(comparableResults2)
    ) {
      console.log("Run 1 (excluding timestamp):", comparableResults1);
      console.log("Run 2 (excluding timestamp):", comparableResults2);
    }
  });

  it("should match known good simulation data (snapshot)", () => {
    // The inline snapshot logic is replaced by a call to runTestAndSnapshot
    runTestAndSnapshot(
      determinismBaseScenario,
      "PhysicsEngine.determinism", // baseSnapshotName from "PhysicsEngine.determinism.snap.json"
      determinismBaseScenario.simulationSteps // steps from the scenario definition
    );
  });
});
