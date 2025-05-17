import Matter from "matter-js";
import { IScenario, ScenarioBodyInitialState, ScenarioAction } from "./types";
import { PhysicsEngine } from "../PhysicsEngine";

// Define the structure for the result of runScenario, specific to determinism tests
export interface ScenarioResult {
  position: Matter.Vector;
  velocity: Matter.Vector;
  angle: number;
  angularVelocity: number;
}

/**
 * Runs a defined physics scenario and returns the state of a target body.
 * @param scenario The scenario definition.
 * @param targetBodyIdToTrack The ID of the body whose final state is to be returned.
 * @returns The final state (position, velocity, angle, angularVelocity) of the target body.
 */
export const runScenario = (
  scenario: IScenario,
  targetBodyIdToTrack: string
): ScenarioResult => {
  const engineSettings = scenario.engineSettings;
  const engine = new PhysicsEngine(
    engineSettings?.fixedTimeStepMs,
    engineSettings?.customG
  );
  if (engineSettings?.enableInternalLogging !== undefined) {
    engine.setInternalLogging(engineSettings.enableInternalLogging);
  }

  engine.init(scenario.celestialBodies);

  const createdBodies: Map<string, Matter.Body> = new Map();

  for (const bodyDef of scenario.initialBodies) {
    let body: Matter.Body;
    const optionsWithLabel = { ...bodyDef.options, label: bodyDef.label };

    switch (bodyDef.type) {
      case "box":
        body = engine.createBox(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.width!,
          bodyDef.height!,
          optionsWithLabel
        );
        break;
      case "circle":
        body = engine.createCircle(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.radius!,
          optionsWithLabel
        );
        break;
      case "rocket":
        body = engine.createRocketBody(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y
        );
        // Apply common options if needed after creation for rockets
        if (optionsWithLabel.label) body.label = optionsWithLabel.label;
        if (bodyDef.options?.density)
          Matter.Body.setDensity(body, bodyDef.options.density);
        // Note: createRocketBody has its own defaults for frictionAir etc.
        break;
      default:
        throw new Error(`Unsupported body type in scenario: ${bodyDef.type}`);
    }

    if (bodyDef.initialVelocity) {
      engine.setBodyVelocity(body, bodyDef.initialVelocity);
    }
    if (bodyDef.initialAngle !== undefined) {
      Matter.Body.setAngle(body, bodyDef.initialAngle);
    }
    if (bodyDef.initialAngularVelocity !== undefined) {
      Matter.Body.setAngularVelocity(body, bodyDef.initialAngularVelocity);
    }
    createdBodies.set(bodyDef.id, body);
  }

  const fixedTimeStep = engineSettings?.fixedTimeStepMs || 1000 / 60;

  for (let i = 0; i < scenario.simulationSteps; i++) {
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
              } else {
                console.warn(
                  "applyForce action missing force or applicationPoint"
                );
              }
              break;
            default:
              console.warn(`Unsupported action type: ${action.actionType}`);
          }
        }
      }
    }
    engine.fixedStep(fixedTimeStep);
  }

  const finalBodyState = createdBodies.get(targetBodyIdToTrack);
  if (!finalBodyState) {
    throw new Error(
      `Target body ID ${targetBodyIdToTrack} for result tracking not found.`
    );
  }

  return {
    position: { x: finalBodyState.position.x, y: finalBodyState.position.y },
    velocity: { x: finalBodyState.velocity.x, y: finalBodyState.velocity.y },
    angle: finalBodyState.angle,
    angularVelocity: finalBodyState.angularVelocity,
  };
};
