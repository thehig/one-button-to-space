import { describe, it, expect, beforeEach } from "vitest";
import Matter from "matter-js";
import { setupScenarioInEngine } from "../scenario-runner-utils";
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
  });

  // TODO: Add tests for runSimulationPerformance determinism (especially actualSteps)
  // TODO: Add tests for mulberry32 itself (optional, as its use in setup is covered)
});
