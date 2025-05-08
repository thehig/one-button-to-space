import Matter from "matter-js";

// Assuming ScenarioData structure is defined elsewhere or implicitly known
// We might want to define interfaces for ScenarioData, WorldOptions, BodyGeneration etc. later
interface ScenarioData {
  description: string;
  seed?: number;
  worldOptions?: Partial<Matter.IWorldDefinition["world"]>; // Use Matter types if possible
  staticBodies?: any[]; // Define more specific types later
  bodyGeneration?: any; // Define more specific types later
  simulationParameters: {
    durationMs?: number;
    targetSteps?: number;
    deltaTime: number;
  };
}

/**
 * Creates a pseudo-random number generator based on the Mulberry32 algorithm.
 * @param seed - The initial seed value.
 * @returns A function that returns a pseudo-random float between 0 (inclusive) and 1 (exclusive).
 */
export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sets up the Matter.js world within the provided engine based on the scenario definition.
 * Creates boundary walls and populates with static/dynamic bodies defined in the scenario.
 * Uses a seeded PRNG for deterministic procedural generation.
 * @param currentEngine - The Matter.js engine to set up.
 * @param scenarioData - The scenario definition object.
 */
export async function setupScenarioInEngine(
  currentEngine: Matter.Engine,
  scenarioData: ScenarioData
): Promise<{ dynamicBodiesCreated: number; staticBodiesCreated: number }> {
  console.log(`Setting up scenario in engine: ${scenarioData.description}`);
  const {
    worldOptions,
    staticBodies = [],
    bodyGeneration,
    seed,
  } = scenarioData;
  let dynamicBodiesCreated = 0;
  let staticBodiesCreated = 0;

  const scenarioSeed = seed ?? 1; // Default seed if not provided
  const random = mulberry32(scenarioSeed);
  console.log(`Using PRNG with seed: ${scenarioSeed}`);

  const randomInRange = (min = 0, max = 1) => random() * (max - min) + min;

  // --- World Configuration ---
  // Apply gravity directly to the engine's world
  if (worldOptions?.gravity) {
    Object.assign(currentEngine.world.gravity, worldOptions.gravity);
  } else {
    // Apply default if not specified
    Object.assign(currentEngine.world.gravity, { x: 0, y: 1, scale: 0.001 });
  }
  console.log("Configured world gravity:", currentEngine.world.gravity);

  // --- Static Bodies ---
  const width = worldOptions?.width ?? 800;
  const height = worldOptions?.height ?? 600;
  const wallThickness = 50;
  const wallOpts: Matter.IBodyDefinition = {
    isStatic: true,
    label: "wall",
    restitution: 0.1,
    friction: 0.5,
  };

  Matter.World.add(currentEngine.world, [
    Matter.Bodies.rectangle(
      width / 2,
      height + wallThickness / 2,
      width,
      wallThickness,
      { ...wallOpts, label: "ground", id: "ground-main" }
    ),
    Matter.Bodies.rectangle(
      width / 2,
      -(wallThickness / 2),
      width,
      wallThickness,
      { ...wallOpts, label: "ceiling", id: "ceiling-main" }
    ),
    Matter.Bodies.rectangle(
      -(wallThickness / 2),
      height / 2,
      wallThickness,
      height,
      { ...wallOpts, label: "leftWall", id: "leftWall-main" }
    ),
    Matter.Bodies.rectangle(
      width + wallThickness / 2,
      height / 2,
      wallThickness,
      height,
      { ...wallOpts, label: "rightWall", id: "rightWall-main" }
    ),
  ]);
  staticBodiesCreated = 4;
  console.log(`Added 4 standard boundary walls to engine.`);

  if (staticBodies.length > 0) {
    const matterStaticBodies = staticBodies
      .map((bodyDef: any, index: number) => {
        // Add type 'any' for now
        const staticId =
          bodyDef.id || `static-main-${staticBodiesCreated + index}`;
        const label = bodyDef.options?.label || staticId;
        const bodyOptions: Matter.IBodyDefinition = {
          isStatic: true,
          ...(bodyDef.options || {}),
          id: staticId,
          label,
        };

        if (bodyDef.type === "rectangle") {
          return Matter.Bodies.rectangle(
            bodyDef.x,
            bodyDef.y,
            bodyDef.width,
            bodyDef.height,
            bodyOptions
          );
        } else if (bodyDef.type === "circle") {
          return Matter.Bodies.circle(
            bodyDef.x,
            bodyDef.y,
            bodyDef.radius,
            bodyOptions
          );
        }
        console.warn(
          `Unsupported static body type: ${bodyDef.type} in scenario ${scenarioData.description}`
        );
        return null;
      })
      .filter((body): body is Matter.Body => body !== null); // Type guard filter

    if (matterStaticBodies.length > 0) {
      Matter.World.add(currentEngine.world, matterStaticBodies);
      console.log(
        `${matterStaticBodies.length} additional static bodies added from scenario definition.`
      );
      staticBodiesCreated += matterStaticBodies.length;
    }
  }

  // --- Dynamic Bodies ---
  if (bodyGeneration) {
    const matterDynamicBodies: Matter.Body[] = [];
    for (let i = 0; i < bodyGeneration.count; i++) {
      const id = `${bodyGeneration.idPrefix || "dynamic"}-main-${i}`;
      let body: Matter.Body | null = null;
      const templateOpts: Matter.IBodyDefinition = {
        ...(bodyGeneration.templateOptions || {}),
        id,
        label: id,
      };
      const type = bodyGeneration.type;

      try {
        if (bodyGeneration.placement) {
          const p = bodyGeneration.placement;
          const x = p.startX;
          const itemHeight =
            p.boxHeight || (p.boxRadius ? p.boxRadius * 2 : 20);
          const y = p.startY - i * (itemHeight + (p.spacingY || 0));
          if (type === "rectangle") {
            body = Matter.Bodies.rectangle(
              x,
              y,
              p.boxWidth || 20,
              p.boxHeight || 20,
              templateOpts
            );
          } else if (type === "circle") {
            body = Matter.Bodies.circle(x, y, p.boxRadius || 10, templateOpts);
          }
        } else if (bodyGeneration.positioning) {
          const p = bodyGeneration.positioning;
          const x = randomInRange(p.x?.min, p.x?.max);
          const y = randomInRange(p.y?.min, p.y?.max);
          if (type === "rectangle") {
            const w = randomInRange(p.width?.min, p.width?.max);
            const h = randomInRange(p.height?.min, p.height?.max);
            body = Matter.Bodies.rectangle(x, y, w, h, templateOpts);
          } else if (type === "circle") {
            const r = randomInRange(p.radius?.min, p.radius?.max);
            body = Matter.Bodies.circle(x, y, r, templateOpts);
          }
        }
      } catch (e) {
        console.error(`Error creating dynamic body ${id}:`, e);
      }

      if (body) {
        matterDynamicBodies.push(body);
      } else {
        console.warn(
          `Failed to generate dynamic body of type ${type} for id ${id}.`
        );
      }
    }

    if (matterDynamicBodies.length > 0) {
      Matter.World.add(currentEngine.world, matterDynamicBodies);
      dynamicBodiesCreated = matterDynamicBodies.length;
      console.log(
        `${dynamicBodiesCreated} dynamic bodies added to engine from generation rules.`
      );
    }
  }

  console.log(
    `Scenario setup complete. Static bodies: ${staticBodiesCreated}, Dynamic bodies: ${dynamicBodiesCreated}`
  );
  return { dynamicBodiesCreated, staticBodiesCreated };
}

export interface PerformanceRunResults {
  scenarioDescription: string;
  seedUsed: number;
  runMode: string;
  targetValue: string;
  actualDurationMs: number;
  actualSteps: number;
  stepsPerSecond: number;
  avgStepTimeMs: number;
}

/**
 * Runs the simulation loop at a fixed interval based on selected mode (duration or steps)
 * Calculates performance metrics based on actual Engine.update execution time.
 * Returns a Promise that resolves with the performance results when the simulation finishes.
 * @param engine - The configured Matter engine.
 * @param scenarioData - The scenario definition.
 * @param runMode - 'duration' or 'steps'.
 * @param targetValue - Target duration (ms) or target steps.
 * @param seedUsed - The actual seed value used for this run.
 * @returns A promise that resolves with the performance results.
 */
export function runSimulationPerformance(
  engine: Matter.Engine,
  scenarioData: ScenarioData,
  runMode: "duration" | "steps",
  targetValue: number,
  seedUsed: number
): Promise<PerformanceRunResults> {
  console.log(
    `Starting performance run: Mode=${runMode}, Target=${targetValue}, Seed=${seedUsed}`
  );

  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let steps = 0;
    const deltaTime = scenarioData.simulationParameters.deltaTime ?? 1000 / 60;
    const intervalTime = deltaTime; // Run physics step at this interval
    let totalPhysicsTime = 0;
    let simulationRunning = true;

    const intervalId = setInterval(() => {
      if (!simulationRunning) return;

      const now = performance.now();
      let shouldStop = false;

      // Check termination condition
      if (runMode === "duration") {
        if (now - startTime >= targetValue) {
          shouldStop = true;
        }
      } else {
        // runMode === 'steps'
        if (steps >= targetValue) {
          shouldStop = true;
        }
      }

      if (shouldStop) {
        simulationRunning = false;
        clearInterval(intervalId);
        const endTime = performance.now();
        const actualDurationMs = endTime - startTime;
        const actualSteps = steps;
        // Avoid division by zero if duration is extremely short
        const stepsPerSecond =
          actualDurationMs > 0 ? actualSteps / (actualDurationMs / 1000) : 0;
        // Avoid division by zero if no steps were taken
        const avgStepTimeMs =
          actualSteps > 0 ? totalPhysicsTime / actualSteps : 0;

        const results: PerformanceRunResults = {
          scenarioDescription: scenarioData.description,
          seedUsed: seedUsed,
          runMode: runMode === "duration" ? "Duration" : "Steps",
          targetValue:
            runMode === "duration"
              ? `${targetValue} ms`
              : `${targetValue} steps`,
          actualDurationMs: actualDurationMs,
          actualSteps: actualSteps,
          stepsPerSecond: stepsPerSecond,
          avgStepTimeMs: avgStepTimeMs,
        };
        console.log("Performance Run Results:", results);
        resolve(results);
        return;
      }

      // Perform physics step and measure time
      try {
        const stepStart = performance.now();
        Matter.Engine.update(engine, deltaTime);
        const stepEnd = performance.now();
        totalPhysicsTime += stepEnd - stepStart;
        steps++;
      } catch (error) {
        console.error("Error during Matter.Engine.update:", error);
        simulationRunning = false;
        clearInterval(intervalId);
        reject(error);
      }
    }, intervalTime);
  });
}
