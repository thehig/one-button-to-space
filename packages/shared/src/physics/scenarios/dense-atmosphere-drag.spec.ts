import { expect } from "chai";
import "mocha";
import * as fs from "fs";
import * as path from "path";
import { Vector } from "matter-js";
import { IScenario } from "./types";

import {
  denseAtmosphereDragScenario1Step,
  denseAtmosphereDragScenario10Steps,
  denseAtmosphereDragScenario50Steps,
  denseAtmosphereDragScenario100Steps,
} from "./dense-atmosphere-drag.scenario";
import { runScenario, ScenarioResult } from "./test-runner.helper";

const snapshotDir = path.join(__dirname, "__snapshots__");

// Consider moving to test-runner.helper.ts
const runTestAndSnapshot = (
  scenario: IScenario,
  targetBodyId: string,
  snapshotFileName: string
) => {
  const snapshotFile = path.join(snapshotDir, snapshotFileName);
  const currentResults = runScenario(scenario, targetBodyId);

  if (process.env.UPDATE_SNAPSHOTS === "true") {
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    fs.writeFileSync(snapshotFile, JSON.stringify(currentResults, null, 2));
    console.log(`  Snapshot updated: ${snapshotFileName}`);
    return currentResults;
  } else {
    if (!fs.existsSync(snapshotFile)) {
      throw new Error(
        `Snapshot file not found: ${snapshotFileName}. Run with UPDATE_SNAPSHOTS=true to create it.`
      );
    }
    const expectedResults = JSON.parse(
      fs.readFileSync(snapshotFile, "utf-8")
    ) as ScenarioResult;
    expect(currentResults).to.deep.equal(expectedResults);
    return currentResults;
  }
};

describe("PhysicsEngine Environmental Effects: Dense Atmospheric Drag", () => {
  it("should simulate atmospheric drag in a VERY dense atmosphere (1 step - explicit assertions)", () => {
    const scenario = denseAtmosphereDragScenario1Step;
    const scenarioBody = scenario.initialBodies.find(
      (b) => b.id === "denseDragTestBody"
    );
    if (!scenarioBody || !scenarioBody.initialVelocity) {
      throw new Error(
        "Dense drag test scenario body or initial velocity not defined correctly."
      );
    }
    const initialSpeed = Vector.magnitude(scenarioBody.initialVelocity);

    const finalBodyState = runScenario(scenario, "denseDragTestBody");
    const finalSpeed = Vector.magnitude(finalBodyState.velocity);

    expect(finalSpeed).to.be.lessThan(initialSpeed);
    // Check that it hasn't reversed direction (or stopped completely and then reversed due to some other effect)
    expect(finalBodyState.velocity.x).to.be.greaterThan(-initialSpeed);
    // Specific check for dense atmosphere: significant speed reduction in one step
    expect(finalSpeed).to.be.lessThan(initialSpeed * 0.9);
  });

  it("should match snapshot after 10 steps of dense atmospheric drag", () => {
    runTestAndSnapshot(
      denseAtmosphereDragScenario10Steps,
      "denseDragTestBody",
      "dense-atmospheric-drag.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of dense atmospheric drag", () => {
    runTestAndSnapshot(
      denseAtmosphereDragScenario50Steps,
      "denseDragTestBody",
      "dense-atmospheric-drag.50steps.snap.json"
    );
  });

  it("should match snapshot after 100 steps of dense atmospheric drag", () => {
    runTestAndSnapshot(
      denseAtmosphereDragScenario100Steps,
      "denseDragTestBody",
      "dense-atmospheric-drag.100steps.snap.json"
    );
  });
});
