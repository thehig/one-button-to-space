import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";
import { IScenario, ISerializedPhysicsEngineState } from "./types";
import { runScenario } from "./scenario-runner.helper"; // Import runScenario

// Moved from scenario-runner.helper.ts
const snapshotDir = path.join(__dirname, "__snapshots__");

export const runTestAndSnapshot = (
  scenario: IScenario,
  baseSnapshotName: string,
  steps: number
): ISerializedPhysicsEngineState => {
  const consolidatedSnapshotFile = path.join(
    snapshotDir,
    `${baseSnapshotName}.snap.json`
  );
  const currentResults = runScenario(scenario, steps);

  if (process.env.UPDATE_SNAPSHOTS === "true") {
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    let allSnapshots: Record<string, ISerializedPhysicsEngineState> = {};
    if (fs.existsSync(consolidatedSnapshotFile)) {
      try {
        allSnapshots = JSON.parse(
          fs.readFileSync(consolidatedSnapshotFile, "utf-8")
        );
      } catch (e) {
        console.warn(
          `Could not parse existing snapshot file ${consolidatedSnapshotFile}. It will be overwritten. Error: ${
            (e as Error).message
          }`
        );
        allSnapshots = {}; // Reset if parsing fails
      }
    }
    allSnapshots[steps] = currentResults;
    fs.writeFileSync(
      consolidatedSnapshotFile,
      JSON.stringify(allSnapshots, null, 2)
    );
    console.log(
      `  Snapshot updated: ${baseSnapshotName}.snap.json (step ${steps})`
    );
    return currentResults;
  } else {
    if (!fs.existsSync(consolidatedSnapshotFile)) {
      throw new Error(
        `Snapshot file not found: ${consolidatedSnapshotFile}. Run with UPDATE_SNAPSHOTS=true to create it.`
      );
    }
    const allSnapshots = JSON.parse(
      fs.readFileSync(consolidatedSnapshotFile, "utf-8")
    ) as Record<string, ISerializedPhysicsEngineState>;

    const expectedResults = allSnapshots[steps];
    if (expectedResults === undefined) {
      throw new Error(
        `Snapshot for step ${steps} not found in ${consolidatedSnapshotFile}. Run with UPDATE_SNAPSHOTS=true to create it.`
      );
    }
    expect(currentResults).to.deep.equal(expectedResults);
    return currentResults;
  }
};
