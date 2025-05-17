import Matter from "matter-js";
import { IScenario, ISerializedPhysicsEngineState } from "./types";
import { PhysicsEngine } from "../PhysicsEngine";
import * as fs from "fs";
import * as path from "path";
import { expect } from "chai";

// Initialize poly-decomp for Matter.js
if (typeof window === "undefined") {
  // Running in Node.js environment (tests)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const polyDecomp = require("poly-decomp");
  Matter.Common.setDecomp(polyDecomp);
} else {
  // Running in a browser environment (visualizer)
  // Assume poly-decomp is loaded globally via a script tag or similar
  if ((window as any).decomp) {
    Matter.Common.setDecomp((window as any).decomp);
  } else {
    console.warn(
      "poly-decomp not found globally for Matter.js in browser environment."
    );
  }
}

/**
 * Runs a defined physics scenario and returns the full serialized state of the physics engine.
 * @param scenario The scenario definition.
 * @param runUpToSteps Optional parameter to run the scenario up to a certain step.
 * @returns The full ISerializedPhysicsEngineState from physicsEngine.toJSON().
 */
export const runScenario = (
  scenario: IScenario,
  runUpToSteps?: number
): ISerializedPhysicsEngineState => {
  // Reset Matter.js internal ID counters for deterministic tests
  (Matter.Body as any)._nextId = 0;
  (Matter.Composite as any)._nextId = 0;
  (Matter.Constraint as any)._nextId = 0;
  (Matter.Common as any)._nextId = 0;

  const engineSettings = scenario.engineSettings;
  const engine = new PhysicsEngine(
    engineSettings?.fixedTimeStepMs,
    engineSettings?.customG === null ? undefined : engineSettings?.customG
  );
  if (engineSettings?.enableInternalLogging !== undefined) {
    engine.setInternalLogging(engineSettings.enableInternalLogging);
  }

  engine.init(scenario.celestialBodies);

  const createdBodies: Map<string, Matter.Body> = new Map();

  for (const bodyDef of scenario.initialBodies) {
    let body: Matter.Body;

    // Prepare the options object that will be passed to the engine's creation methods.
    // The label from the scenario (or fallback to id) is included here.
    const optionsForEngine: Matter.IBodyDefinition = {
      ...(bodyDef.options || {}),
      label: bodyDef.label || bodyDef.id,
    };

    switch (bodyDef.type) {
      case "box":
        body = engine.createBox(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.width!,
          bodyDef.height!,
          optionsForEngine
        );
        break;
      case "circle":
        body = engine.createCircle(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.radius!,
          optionsForEngine
        );
        break;
      case "rocket":
        body = engine.createRocketBody(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          optionsForEngine
        );
        break;
      default:
        throw new Error(`Unsupported body type in scenario: ${bodyDef.type}`);
    }

    // Initial velocity, angle, and angular velocity are set directly on the body after creation.
    if (bodyDef.initialVelocity) {
      engine.setBodyVelocity(body, bodyDef.initialVelocity);
    }
    if (bodyDef.initialAngle !== undefined) {
      Matter.Body.setAngle(body, bodyDef.initialAngle);
    }
    if (bodyDef.initialAngularVelocity !== undefined) {
      Matter.Body.setAngularVelocity(body, bodyDef.initialAngularVelocity);
    }
    // Store the created body by its scenario-defined ID for action targeting.
    createdBodies.set(bodyDef.id, body);
  }

  const fixedTimeStep = engineSettings?.fixedTimeStepMs || 1000 / 60;
  const totalStepsToRun = runUpToSteps ?? scenario.simulationSteps;

  for (let i = 0; i < totalStepsToRun; i++) {
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
                engine.applyForceToBody(
                  targetBody,
                  action.applicationPoint,
                  action.force
                );
              } else if (action.force) {
                engine.applyForceToBody(
                  targetBody,
                  targetBody.position, // Apply at center if no point specified
                  action.force
                );
              } else {
                console.warn("applyForce action missing force");
              }
              break;
            // case "setVelocity": // Example for future action
            //   if (action.velocity) {
            //     engine.setBodyVelocity(targetBody, action.velocity);
            //   }
            //   break;
            default:
              console.warn(`Unsupported action type: ${action.actionType}`);
          }
        }
      }
    }
    engine.fixedStep(fixedTimeStep);
  }

  return engine.toJSON();
};

// Moved and modified runTestAndSnapshot function
const snapshotDir = path.join(__dirname, "__snapshots__"); // Assuming __dirname is appropriate here

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
