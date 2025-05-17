import { expect } from "chai";
import "mocha";
import { PhysicsEngine, ICelestialBody } from "../PhysicsEngine";
import {
  IScenario,
  ScenarioBodyInitialState,
  ScenarioBodyType,
  ISerializedPhysicsEngineState,
} from "./types";

// Define a simple scenario for this test
const rehydrationTestScenario: IScenario = {
  id: "rehydration-test",
  name: "Rehydration Test Scenario",
  description: "A simple scenario to test toJSON and fromJSON rehydration.",
  engineSettings: {
    customG: 0.001, // Use a mild gravity for predictable movement
    fixedTimeStepMs: 1000 / 60, // Standard 60 FPS
    enableInternalLogging: false,
  },
  celestialBodies: [
    {
      id: "central-star",
      mass: 1000, // A reasonably massive star
      position: { x: 0, y: 0 },
      gravityRadius: 2000, // Large enough gravity radius
      radius: 50,
    } as ICelestialBody,
  ],
  initialBodies: [
    {
      id: "falling-object",
      type: "circle" as ScenarioBodyType,
      label: "fallingObject",
      initialPosition: { x: 200, y: 0 }, // Start some distance away
      initialVelocity: { x: 0, y: 0 }, // Start at rest
      radius: 10,
      options: {
        density: 0.1, // Give it some mass
        restitution: 0.5, // Make it bounce a little if it were to hit something
      },
    } as ScenarioBodyInitialState,
  ],
  simulationSteps: 0, // Not directly used by this test logic, ticks are manual
  actions: [],
};

describe("PhysicsEngine: Rehydration Logic", () => {
  it("should produce identical state after rehydrating and running additional steps", () => {
    const ticks1 = 100;
    const ticks2 = 100;
    const totalTicks = ticks1 + ticks2;

    // --- Original Engine Run --- (engine1)
    const engine1 = new PhysicsEngine(
      rehydrationTestScenario.engineSettings?.fixedTimeStepMs,
      rehydrationTestScenario.engineSettings?.customG === null
        ? undefined
        : rehydrationTestScenario.engineSettings?.customG
    );
    engine1.setInternalLogging(
      rehydrationTestScenario.engineSettings?.enableInternalLogging || false
    );
    engine1.init(rehydrationTestScenario.celestialBodies);

    const bodyDef1 = rehydrationTestScenario.initialBodies[0];
    const body1_engine1 = engine1.createCircle(
      bodyDef1.initialPosition.x,
      bodyDef1.initialPosition.y,
      bodyDef1.radius!,
      { label: bodyDef1.label || bodyDef1.id, ...bodyDef1.options }
    );
    engine1.setBodyVelocity(body1_engine1, bodyDef1.initialVelocity!);

    // Run engine1 for ticks1
    for (let i = 0; i < ticks1; i++) {
      engine1.fixedStep(
        rehydrationTestScenario.engineSettings!.fixedTimeStepMs!
      );
    }
    const state100_original: ISerializedPhysicsEngineState = engine1.toJSON();

    // Continue running engine1 for ticks2
    for (let i = 0; i < ticks2; i++) {
      engine1.fixedStep(
        rehydrationTestScenario.engineSettings!.fixedTimeStepMs!
      );
    }
    const state200_original: ISerializedPhysicsEngineState = engine1.toJSON();

    // --- Rehydrated Engine Run --- (engine2)
    const engine2 = new PhysicsEngine(
      rehydrationTestScenario.engineSettings?.fixedTimeStepMs,
      rehydrationTestScenario.engineSettings?.customG === null
        ? undefined
        : rehydrationTestScenario.engineSettings?.customG // Ensure G is the same
    );
    engine2.setInternalLogging(
      rehydrationTestScenario.engineSettings?.enableInternalLogging || false
    );
    // No need to init celestial bodies or create initial bodies manually for engine2 before fromJSON
    // fromJSON should handle restoring celestial bodies and all dynamic bodies.

    engine2.fromJSON(state100_original);

    // Run engine2 for ticks2 (the same number of steps engine1 ran after the first snapshot)
    for (let i = 0; i < ticks2; i++) {
      engine2.fixedStep(
        rehydrationTestScenario.engineSettings!.fixedTimeStepMs!
      );
    }
    const state100_rehydrated_plus_100: ISerializedPhysicsEngineState =
      engine2.toJSON();

    // --- Comparison ---
    // For easier debugging if it fails, compare parts separately first.
    // Then a deep equal on the whole state.

    // Compare simulationTick
    expect(
      state100_rehydrated_plus_100.simulationTick,
      "Simulation tick after rehydration should match"
    ).to.equal(state200_original.simulationTick);

    // Compare celestial bodies (should be identical as they are static definitions loaded)
    expect(
      state100_rehydrated_plus_100.celestialBodies,
      "Celestial bodies should match"
    ).to.deep.equal(state200_original.celestialBodies);

    // Compare dynamic bodies
    // Sort bodies by label to ensure consistent order for comparison if IDs are not perfectly sequential (though they should be)
    const sortBodies = (bodies: any[]) =>
      [...bodies].sort((a, b) => {
        const labelA = a.label || "";
        const labelB = b.label || "";
        return labelA.localeCompare(labelB);
      });

    const bodiesRehydrated = sortBodies(
      state100_rehydrated_plus_100.world.bodies
    );
    const bodiesOriginal = sortBodies(state200_original.world.bodies);

    expect(
      bodiesRehydrated.length,
      "Number of dynamic bodies should match"
    ).to.equal(bodiesOriginal.length);

    for (let i = 0; i < bodiesOriginal.length; i++) {
      expect(
        bodiesRehydrated[i],
        `Body ${bodiesOriginal[i].label} should match`
      ).to.deep.equal(bodiesOriginal[i]);
    }

    // Finally, a full deep equality check on the entire state object
    expect(
      state100_rehydrated_plus_100,
      "Full engine state after rehydration and steps should match original"
    ).to.deep.equal(state200_original);
  });
});
