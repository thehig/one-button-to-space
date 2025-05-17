import Matter from "matter-js";
import { IScenario, ISerializedPhysicsEngineState } from "./types";
import { PhysicsEngine } from "../PhysicsEngine";

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
 * Optional parameters for runScenario.
 */
export interface RunScenarioOptions {
  /**
   * Overrides the scenario's internal logging setting.
   * If true, enables detailed logging from the PhysicsEngine.
   * If false, disables it.
   * If undefined, the scenario's own setting (engineSettings.enableInternalLogging) is used.
   */
  debug?: boolean;
}

/**
 * Runs a defined physics scenario and returns the full serialized state of the physics engine.
 * @param scenario The scenario definition.
 * @param runUpToSteps Optional parameter to run the scenario up to a certain step.
 * @param options Optional parameters for running the scenario, like debug logging.
 * @returns The full ISerializedPhysicsEngineState from physicsEngine.toJSON().
 */
export const runScenario = (
  scenario: IScenario,
  runUpToSteps?: number,
  options?: RunScenarioOptions
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
  if (options?.debug !== undefined) {
    engine.setInternalLogging(options.debug);
  } else if (engineSettings?.enableInternalLogging !== undefined) {
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

// runTestAndSnapshot function and related imports (fs, path, chai) have been moved
// to scenario-snapshotter.node.ts
