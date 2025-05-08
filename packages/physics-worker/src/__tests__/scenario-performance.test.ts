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
// const SIMULATION_TARGET_STEPS = 200; // This is no longer used for duration-based runs
const SIMULATION_DELTA_TIME = 1000 / 60; // Approx 60 FPS

// New constants for multiple runs
const NUM_PERFORMANCE_RUNS = 5;
const PERFORMANCE_RUN_DURATION_MS = 2500; // 2.5 seconds per run

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
  it(`should maintain an average step time within expected bounds over ${NUM_PERFORMANCE_RUNS} runs of ${PERFORMANCE_RUN_DURATION_MS}ms each`, async () => {
    const allRunResults: PerformanceRunResults[] = [];

    console.log(
      `Starting ${NUM_PERFORMANCE_RUNS} performance runs, each for ${PERFORMANCE_RUN_DURATION_MS}ms.`
    );

    for (let i = 0; i < NUM_PERFORMANCE_RUNS; i++) {
      console.log(
        `--- Starting Performance Run ${i + 1}/${NUM_PERFORMANCE_RUNS} ---`
      );
      const engine = Matter.Engine.create();
      // Ensure the same seed is used for scenario setup in each iteration for consistency if desired,
      // or allow different seeds if testing variability. For performance, same seed is better.
      await setupScenarioInEngine(engine, performanceTestScenario); // performanceTestScenario already has a fixed seed

      const results: PerformanceRunResults = await runSimulationPerformance(
        engine,
        performanceTestScenario,
        "duration", // Run by duration
        PERFORMANCE_RUN_DURATION_MS,
        performanceTestScenario.seed || 0 // Use the scenario's seed for this run's reporting
      );
      allRunResults.push(results);

      // Log individual run to file
      const performanceStatsToLog = {
        timestamp: new Date().toISOString(),
        runNumber: i + 1,
        scenarioDescription: results.scenarioDescription,
        seedUsed: results.seedUsed,
        targetDurationMs: PERFORMANCE_RUN_DURATION_MS,
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
        console.log(
          `Performance stats for run ${
            i + 1
          } appended to ${PERFORMANCE_LOG_FILE}`
        );
      } catch (error) {
        console.error(
          `Failed to write performance log for run ${
            i + 1
          } to ${PERFORMANCE_LOG_FILE}:`,
          error
        );
      }
      console.log(
        `--- Finished Performance Run ${i + 1}/${NUM_PERFORMANCE_RUNS} ---`
      );
      console.log(
        `Run ${i + 1} Avg Step Time: ${results.avgStepTimeMs.toFixed(
          4
        )} ms, Steps: ${results.actualSteps}`
      );
    }

    // Aggregate results
    const totalAvgStepTimeMs = allRunResults.reduce(
      (sum, r) => sum + (r.avgStepTimeMs || 0),
      0
    );
    const overallAverageStepTimeMs = totalAvgStepTimeMs / NUM_PERFORMANCE_RUNS;

    const totalSteps = allRunResults.reduce((sum, r) => sum + r.actualSteps, 0);
    const totalDuration = allRunResults.reduce(
      (sum, r) => sum + r.actualDurationMs,
      0
    );

    console.log("--- Overall Aggregated Performance Results ---");
    console.log(`Number of Runs: ${NUM_PERFORMANCE_RUNS}`);
    console.log(`Total Simulation Steps Across All Runs: ${totalSteps}`);
    console.log(
      `Total Simulation Duration Across All Runs: ${totalDuration.toFixed(
        2
      )} ms`
    );
    console.log(
      `Overall Average of AvgStepTimeMs: ${overallAverageStepTimeMs.toFixed(
        4
      )} ms`
    );
    console.log("-------------------------------------------");

    // Assertions on the overall average
    const lowerBound =
      EXPECTED_AVG_STEP_TIME_MS - PERFORMANCE_STEP_TIME_DELTA_MS;
    const upperBound =
      EXPECTED_AVG_STEP_TIME_MS + PERFORMANCE_STEP_TIME_DELTA_MS;

    console.log(
      `Asserting Overall Average of AvgStepTimeMs (${overallAverageStepTimeMs.toFixed(
        4
      )}ms) is between ${lowerBound.toFixed(4)}ms and ${upperBound.toFixed(
        4
      )}ms.`
    );
    expect(overallAverageStepTimeMs).toBeGreaterThanOrEqual(lowerBound);
    expect(overallAverageStepTimeMs).toBeLessThanOrEqual(upperBound);
  }, 25000); // Increased timeout (e.g., 5 runs * 2.5s = 12.5s sim time + setup/overhead)
});
