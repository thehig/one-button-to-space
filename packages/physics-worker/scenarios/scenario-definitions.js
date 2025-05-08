export const scenarios = {
  "falling-100-boxes": {
    description:
      "100 random boxes falling onto a static ground with 4 boundary walls.",
    seed: 12345,
    worldOptions: {
      width: 800,
      height: 600,
      gravity: { x: 0, y: 1, scale: 0.001 },
      // Note: The physicsWorker.ts INIT_WORLD command already creates 4 boundary walls (ground, ceiling, left, right)
      // based on width/height. So, for worker tests, no explicit staticBodies for walls are needed here.
      // For main thread tests, we will add these 4 walls for parity based on these worldOptions.
    },
    // Explicit static bodies are primarily for the main thread test to match the worker's auto-boundaries,
    // or for additional static elements unique to a scenario.
    staticBodies: [
      // These will be created in the main-thread test based on worldOptions for parity with worker.
      // If a scenario needed *additional* specific static bodies, they'd be listed here.
      // Example for main thread ground (one of the 4 walls):
      // { id: "main-ground", type: "rectangle", x: 400, y: 575, width: 800, height: 50, options: { isStatic: true, label: "ground" } }
    ],
    bodyGeneration: {
      type: "rectangle",
      count: 100,
      idPrefix: "box", // Will generate ids like "box-0", "box-1", ...
      templateOptions: { restitution: 0.5, friction: 0.1 },
      positioning: {
        x: { min: 50, max: 750 }, // Random x between 50-750 (considering wall thickness)
        y: { min: 50, max: 300 }, // Random y in the top half (considering wall thickness)
        width: { min: 10, max: 30 },
        height: { min: 10, max: 30 },
      },
    },
    simulationParameters: {
      durationMs: 5000,
      deltaTime: 16.666, // Approx 60 FPS
    },
  },
  "stack-of-10-boxes": {
    description: "A stack of 10 boxes to test stability and stacking.",
    seed: 9876,
    worldOptions: {
      width: 800,
      height: 600,
      gravity: { x: 0, y: 1, scale: 0.001 },
    },
    staticBodies: [], // Main thread will create 4 walls for parity with worker
    bodyGeneration: {
      type: "rectangle",
      count: 10,
      idPrefix: "stack-box",
      templateOptions: { restitution: 0.1, friction: 0.5 }, // Less bouncy, more friction for stacks
      placement: {
        // Specific placement for stacking
        startX: 400,
        startY: 525, // Start from bottom up (y=550 is ground surface, 50 height wall, so 525 is on top)
        boxHeight: 20,
        boxWidth: 20,
        spacingY: 0, // Boxes directly on top of each other
      },
    },
    simulationParameters: {
      durationMs: 8000, // Longer duration for stacks to settle or fall
      deltaTime: 16.666,
    },
  },
  // Add more scenarios like "chainReaction", "manySmallCircles" later
};
