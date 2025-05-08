import { describe, it, expect, beforeEach, vi } from "vitest";
import Matter from "matter-js";
import {
  setupScenarioInEngine,
  runSimulationPerformance,
} from "../scenario-runner-utils";
import type { ScenarioData } from "../scenario-runner-utils"; // Assuming ScenarioData is exported or reconstructable

// Helper function to compare relevant properties of two Matter.Body objects
function compareBodies(bodyA: Matter.Body, bodyB: Matter.Body): boolean {
  // Compare a subset of properties relevant for determinism.
  // Position, angle, velocity, angularVelocity are key.
  // Labels/IDs should also match if set deterministically.
  const positionClose =
    Math.abs(bodyA.position.x - bodyB.position.x) < 0.0001 &&
    Math.abs(bodyA.position.y - bodyB.position.y) < 0.0001;
  const angleClose = Math.abs(bodyA.angle - bodyB.angle) < 0.0001;
  // Initial velocities are often zero, but good to check
  const velocityClose =
    Math.abs(bodyA.velocity.x - bodyB.velocity.x) < 0.0001 &&
    Math.abs(bodyA.velocity.y - bodyB.velocity.y) < 0.0001;
  const angularVelocityClose =
    Math.abs(bodyA.angularVelocity - bodyB.angularVelocity) < 0.0001;

  return (
    positionClose &&
    angleClose &&
    velocityClose &&
    angularVelocityClose &&
    bodyA.label === bodyB.label &&
    bodyA.isStatic === bodyB.isStatic
    // Add other properties as needed, e.g., inertia, mass, parts, etc.
    // For procedural generation, ensuring vertices/parts match is crucial.
  );
}

describe("Scenario Runner Utilities", () => {
  describe("setupScenarioInEngine", () => {
    let baseScenarioData: ScenarioData;

    beforeEach(() => {
      // Define a simple base scenario for testing
      baseScenarioData = {
        description: "Test Deterministic Setup",
        seed: 12345, // Fixed seed
        worldOptions: {
          gravity: { x: 0, y: 1, scale: 0.001 },
          width: 800,
          height: 600,
        },
        staticBodies: [
          {
            type: "rectangle",
            x: 400,
            y: 580,
            width: 800,
            height: 40,
            options: { label: "custom-ground" },
          },
        ],
        bodyGeneration: {
          type: "circle",
          count: 5,
          idPrefix: "testCircle",
          templateOptions: { restitution: 0.5, friction: 0.01 },
          positioning: {
            // Ensure positioning uses the PRNG
            x: { min: 100, max: 700 },
            y: { min: 50, max: 300 },
            radius: { min: 10, max: 20 },
          },
        },
        simulationParameters: {
          // Required by ScenarioData, even if not directly used by setup
          deltaTime: 1000 / 60,
        },
      };
    });

    it("should produce a deterministic world state given the same seed and scenario data", async () => {
      const engine1 = Matter.Engine.create();
      const engine2 = Matter.Engine.create();

      // Apply the same options to both engines if necessary (though setupScenario should handle world options)

      const results1 = await setupScenarioInEngine(engine1, baseScenarioData);
      const results2 = await setupScenarioInEngine(engine2, baseScenarioData);

      // 1. Check if the number of bodies created is the same
      expect(results1.staticBodiesCreated).toBe(results2.staticBodiesCreated);
      expect(results1.dynamicBodiesCreated).toBe(results2.dynamicBodiesCreated);

      const allBodies1 = Matter.Composite.allBodies(engine1.world);
      const allBodies2 = Matter.Composite.allBodies(engine2.world);

      expect(allBodies1.length).toBe(allBodies2.length);
      expect(allBodies1.length).toBeGreaterThan(0); // Ensure some bodies were actually created

      // 2. Sort bodies by a deterministic property (e.g., label or ID) before comparing
      // The current setupScenarioInEngine assigns labels like "ground-main", "testCircle-main-0", etc.
      allBodies1.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
      allBodies2.sort((a, b) => (a.label || "").localeCompare(b.label || ""));

      // 3. Compare each body
      for (let i = 0; i < allBodies1.length; i++) {
        const body1 = allBodies1[i];
        const body2 = allBodies2[i];

        // Basic label check for sanity
        expect(body1.label).toBe(body2.label);

        // More detailed comparison
        //This will require a helper function to compare bodies due to floating point numbers
        //and potentially complex properties like vertices.
        expect(
          compareBodies(body1, body2),
          `Body ${body1.label} (index ${i}) should be identical`
        ).toBe(true);
      }
    });

    it("should warn for unsupported static body types", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn");
      const engine = Matter.Engine.create();
      const scenarioWithUnsupportedStatic: ScenarioData = {
        ...baseScenarioData,
        description: "Test Unsupported Static",
        staticBodies: [
          {
            type: "triangle",
            x: 100,
            y: 100,
            size: 20,
            options: { label: "unsupported-static" },
          },
        ],
      };
      await setupScenarioInEngine(engine, scenarioWithUnsupportedStatic);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unsupported static body type: triangle")
      );
      consoleWarnSpy.mockRestore();
    });

    it("should warn if dynamic body generation fails for a type", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn");
      const engine = Matter.Engine.create();
      const scenarioWithUnsupportedDynamic: ScenarioData = {
        ...baseScenarioData,
        description: "Test Unsupported Dynamic",
        bodyGeneration: {
          ...baseScenarioData.bodyGeneration,
          type: "pentagon",
          count: 1,
          idPrefix: "unsupportedDynamic",
        },
      };
      await setupScenarioInEngine(engine, scenarioWithUnsupportedDynamic);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Failed to generate dynamic body of type pentagon"
        )
      );
      consoleWarnSpy.mockRestore();
    });
  });

  // TODO: Add tests for runSimulationPerformance determinism (especially actualSteps)
  // TODO: Add tests for mulberry32 itself (optional, as its use in setup is covered)
});

// Helper for snapshotting body states
interface SerializableBodyState {
  label: string | undefined;
  isStatic: boolean;
  position: { x: number; y: number };
  angle: number;
  velocity: { x: number; y: number };
  angularVelocity: number;
  // Potentially add vertices if their determinism is critical for your scenarios
}

function getSerializableBodyStates(
  engine: Matter.Engine
): SerializableBodyState[] {
  const bodies = Matter.Composite.allBodies(engine.world);
  bodies.sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  return bodies.map((body) => ({
    label: body.label,
    isStatic: body.isStatic,
    position: {
      x: parseFloat(body.position.x.toFixed(4)),
      y: parseFloat(body.position.y.toFixed(4)),
    },
    angle: parseFloat(body.angle.toFixed(4)),
    velocity: {
      x: parseFloat(body.velocity.x.toFixed(4)),
      y: parseFloat(body.velocity.y.toFixed(4)),
    },
    angularVelocity: parseFloat(body.angularVelocity.toFixed(4)),
  }));
}

describe("runSimulationPerformance", () => {
  let scenarioDataForSim: ScenarioData;

  beforeEach(() => {
    scenarioDataForSim = {
      description: "Test Sim Performance Determinism",
      seed: 54321, // Different seed from setup tests
      worldOptions: {
        gravity: { x: 0, y: 1, scale: 0.001 },
        width: 400, // Smaller world for faster sim tests
        height: 300,
      },
      staticBodies: [
        {
          type: "rectangle",
          x: 200,
          y: 290,
          width: 400,
          height: 20,
          options: { label: "sim-ground" },
        },
      ],
      bodyGeneration: {
        type: "circle",
        count: 3, // Fewer bodies for faster sim tests
        idPrefix: "simCircle",
        templateOptions: { restitution: 0.8, friction: 0.05 },
        positioning: {
          x: { min: 50, max: 350 },
          y: { min: 20, max: 100 },
          radius: { min: 5, max: 10 },
        },
      },
      simulationParameters: {
        deltaTime: 16.666, // Approx 60 FPS
        // durationMs or targetSteps will be set by the test
      },
    };
  });

  it("should produce deterministic actualSteps for a fixed number of target steps", async () => {
    const engine1 = Matter.Engine.create();
    await setupScenarioInEngine(engine1, scenarioDataForSim);
    const results1 = await runSimulationPerformance(
      engine1,
      scenarioDataForSim,
      "steps",
      50,
      scenarioDataForSim.seed || 0
    );

    const engine2 = Matter.Engine.create();
    await setupScenarioInEngine(engine2, scenarioDataForSim);
    const results2 = await runSimulationPerformance(
      engine2,
      scenarioDataForSim,
      "steps",
      50,
      scenarioDataForSim.seed || 0
    );

    expect(results1.actualSteps).toBe(50);
    expect(results2.actualSteps).toBe(50);
    expect(results1.actualSteps).toBe(results2.actualSteps);
    // actualDurationMs might vary slightly, so we don't compare it strictly here for determinism of steps.
  });

  it("should produce a deterministic final world state after a fixed number of simulation steps", async () => {
    const engine = Matter.Engine.create();
    await setupScenarioInEngine(engine, scenarioDataForSim);

    // Run simulation for a small, fixed number of steps
    const numStepsToRun = 10;
    await runSimulationPerformance(
      engine,
      scenarioDataForSim,
      "steps",
      numStepsToRun,
      scenarioDataForSim.seed || 0
    );

    const finalBodyStates = getSerializableBodyStates(engine);
    expect(finalBodyStates.length).toBeGreaterThan(0); // Ensure we have bodies
    expect(finalBodyStates).toMatchSnapshot();
  });

  it("should run simulation for a target duration and produce plausible results", async () => {
    const engine = Matter.Engine.create();
    await setupScenarioInEngine(engine, scenarioDataForSim);
    const targetDurationMs = 100; // Short duration for testing
    const results = await runSimulationPerformance(
      engine,
      scenarioDataForSim,
      "duration",
      targetDurationMs,
      scenarioDataForSim.seed || 0
    );

    expect(results.runMode).toBe("Duration");
    expect(results.targetValue).toBe(`${targetDurationMs} ms`);
    expect(results.actualDurationMs).toBeGreaterThanOrEqual(targetDurationMs);
    expect(results.actualDurationMs).toBeLessThan(targetDurationMs + 100); // Allow some buffer for setInterval inaccuracies
    expect(results.actualSteps).toBeGreaterThan(0);
    expect(results.stepsPerSecond).toBeGreaterThan(0);
    expect(results.avgStepTimeMs).toBeGreaterThan(0);
  });

  it("should correctly handle zero target steps", async () => {
    const engine = Matter.Engine.create();
    await setupScenarioInEngine(engine, scenarioDataForSim);
    const results = await runSimulationPerformance(
      engine,
      scenarioDataForSim,
      "steps",
      0,
      scenarioDataForSim.seed || 0
    );

    expect(results.actualSteps).toBe(0);
    expect(results.stepsPerSecond).toBe(0);
    expect(results.avgStepTimeMs).toBe(0);
    expect(results.actualDurationMs).toBeGreaterThanOrEqual(0); // Duration should be minimal
  });

  // Optional: Test with runMode 'duration' if needed, though 'actualSteps' might vary more.
  // The key for determinism is that for a fixed number of *engine updates* (steps),
  // the state should be the same.
});
