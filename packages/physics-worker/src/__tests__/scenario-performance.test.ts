import { describe, it, expect } from "vitest";
import Matter from "matter-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  setupScenarioInEngine,
  runSimulationPerformance,
} from "../scenario-runner-utils";
import type {
  ScenarioData,
  PerformanceRunResults,
} from "../scenario-runner-utils";

// --- Performance Test Configuration ---
const PERFORMANCE_TEST_SEED = 98765;
const NUM_DYNAMIC_BODIES = 30;
const SIMULATION_TARGET_STEPS = 200;
const SIMULATION_DELTA_TIME = 1000 / 60; // Approx 60 FPS

// New approach: Define an expected average and an acceptable delta.
// Last stable run showed avgStepTimeMs around 0.49ms for the performanceTestScenario.
const EXPECTED_AVG_STEP_TIME_MS = 0.49; // ms
const PERFORMANCE_STEP_TIME_DELTA_MS = 0.11; // ms (allows range of approx. 0.38ms to 0.60ms)

// ESM equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PERFORMANCE_LOG_FILE = path.join(
  __dirname,
  "..",
  "..",
  "performance-log.jsonl"
);

const performanceTestScenario: ScenarioData = {
  description: "Standard Performance Test Scenario",
  seed: PERFORMANCE_TEST_SEED,
  worldOptions: {
    gravity: { x: 0, y: 1, scale: 0.001 },
    width: 800,
    height: 600,
  },
  staticBodies: [
    {
      type: "rectangle",
      x: 400,
      y: 590,
      width: 800,
      height: 20,
      options: { label: "perf-ground" },
    },
    {
      type: "rectangle",
      x: 200,
      y: 400,
      width: 50,
      height: 300,
      options: { label: "perf-wall-1" },
    },
    {
      type: "rectangle",
      x: 600,
      y: 400,
      width: 50,
      height: 300,
      options: { label: "perf-wall-2" },
    },
  ],
  bodyGeneration: {
    type: "circle",
    count: NUM_DYNAMIC_BODIES,
    idPrefix: "perfCircle",
    templateOptions: { restitution: 0.6, friction: 0.1, density: 0.001 },
    positioning: {
      x: { min: 260, max: 540 },
      y: { min: 50, max: 300 },
      radius: { min: 8, max: 15 },
    },
  },
  simulationParameters: {
    deltaTime: SIMULATION_DELTA_TIME,
  },
};

describe("Physics Engine Performance", () => {
  it(`should maintain an average step time below ${
    EXPECTED_AVG_STEP_TIME_MS + PERFORMANCE_STEP_TIME_DELTA_MS
  }ms for ${NUM_DYNAMIC_BODIES} bodies over ${SIMULATION_TARGET_STEPS} steps`, async () => {
    const engine = Matter.Engine.create();

    console.log(
      `Setting up performance scenario: ${performanceTestScenario.description}`
    );
    await setupScenarioInEngine(engine, performanceTestScenario);

    console.log(
      `Running performance test: ${SIMULATION_TARGET_STEPS} steps, deltaTime: ${SIMULATION_DELTA_TIME.toFixed(
        2
      )}ms`
    );
    const results: PerformanceRunResults = await runSimulationPerformance(
      engine,
      performanceTestScenario,
      "steps",
      SIMULATION_TARGET_STEPS,
      PERFORMANCE_TEST_SEED
    );

    console.log("--- Performance Test Results ---");
    console.log(`Scenario: ${results.scenarioDescription}`);
    console.log(`Seed Used: ${results.seedUsed}`);
    console.log(`Target: ${results.targetValue}`);
    console.log(`Actual Steps: ${results.actualSteps}`);
    console.log(`Actual Duration: ${results.actualDurationMs.toFixed(2)} ms`);
    console.log(`Avg Step Time: ${results.avgStepTimeMs.toFixed(4)} ms`);
    console.log(`Min Step Time: ${(results.minStepTimeMs ?? 0).toFixed(4)} ms`);
    console.log(`Max Step Time: ${(results.maxStepTimeMs ?? 0).toFixed(4)} ms`);
    console.log(
      `Median Step Time: ${(results.medianStepTimeMs ?? 0).toFixed(4)} ms`
    );
    console.log(
      `Std Dev Step Time: ${(results.stdDevStepTimeMs ?? 0).toFixed(4)} ms`
    );
    console.log(`Steps Per Second: ${results.stepsPerSecond.toFixed(2)} Hz`);
    console.log("------------------------------");

    // Primary assertion: average step time within expected value +/- delta
    const lowerBound =
      EXPECTED_AVG_STEP_TIME_MS - PERFORMANCE_STEP_TIME_DELTA_MS;
    const upperBound =
      EXPECTED_AVG_STEP_TIME_MS + PERFORMANCE_STEP_TIME_DELTA_MS;

    console.log(
      `Asserting avgStepTimeMs (${results.avgStepTimeMs.toFixed(
        4
      )}ms) is between ${lowerBound.toFixed(4)}ms and ${upperBound.toFixed(
        4
      )}ms.`
    );

    expect(results.avgStepTimeMs).toBeGreaterThanOrEqual(lowerBound);
    expect(results.avgStepTimeMs).toBeLessThanOrEqual(upperBound);

    // Sanity check: ensure the simulation ran for the expected number of steps
    expect(results.actualSteps).toBe(SIMULATION_TARGET_STEPS);

    // Log performance statistics to a file instead of snapshotting
    const performanceStatsToLog = {
      timestamp: new Date().toISOString(), // Add a timestamp to each log entry
      scenarioDescription: results.scenarioDescription,
      seedUsed: results.seedUsed,
      targetSteps: SIMULATION_TARGET_STEPS,
      actualSteps: results.actualSteps,
      actualDurationMs: parseFloat(results.actualDurationMs.toFixed(2)),
      avgStepTimeMs: parseFloat(results.avgStepTimeMs.toFixed(4)),
      minStepTimeMs:
        results.minStepTimeMs !== undefined
          ? parseFloat(results.minStepTimeMs.toFixed(4))
          : 0,
      maxStepTimeMs:
        results.maxStepTimeMs !== undefined
          ? parseFloat(results.maxStepTimeMs.toFixed(4))
          : 0,
      medianStepTimeMs:
        results.medianStepTimeMs !== undefined
          ? parseFloat(results.medianStepTimeMs.toFixed(4))
          : 0,
      stdDevStepTimeMs:
        results.stdDevStepTimeMs !== undefined
          ? parseFloat(results.stdDevStepTimeMs.toFixed(4))
          : 0,
      stepsPerSecond: parseFloat(results.stepsPerSecond.toFixed(2)),
    };

    try {
      fs.appendFileSync(
        PERFORMANCE_LOG_FILE,
        JSON.stringify(performanceStatsToLog) + "\n"
      );
      console.log(`Performance stats appended to ${PERFORMANCE_LOG_FILE}`);
    } catch (error) {
      console.error(
        `Failed to write performance log to ${PERFORMANCE_LOG_FILE}:`,
        error
      );
    }

    // expect(performanceStatsSnapshot).toMatchSnapshot(); // Removed snapshot assertion
  }, 10000); // Increase timeout for this performance test to 10 seconds
});
