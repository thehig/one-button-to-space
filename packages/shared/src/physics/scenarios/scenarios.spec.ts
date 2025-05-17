import "mocha";
// No expect needed if we only run snapshots and don't make explicit assertions here.
// import { expect } from "chai";

import { scenariosToRun } from "./index";
// Import from the new Node.js specific snapshotter file
import { runTestAndSnapshot } from "./scenario-snapshotter.node";

describe("Physics Scenarios Runner", () => {
  scenariosToRun.forEach((entry) => {
    describe(`Scenario: ${entry.scenario.name} (ID: ${entry.scenario.id})`, () => {
      if (
        entry.scenario.snapshotSteps &&
        entry.scenario.snapshotSteps.length > 0
      ) {
        entry.scenario.snapshotSteps.forEach((steps) => {
          it(`should match snapshot after ${steps} steps`, () => {
            runTestAndSnapshot(entry.scenario, entry.baseSnapshotName, steps);
          });
        });
      } else {
        // Optional: add a test to mark scenarios with no snapshot steps,
        // or simply skip them if this is valid.
        it.skip(`has no snapshot steps defined`, () => {
          // This test will be skipped.
        });
      }
    });
  });
});
