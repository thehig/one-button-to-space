import fs from "fs";
import path from "path";
import Matter from "matter-js"; // Needed if performanceTestScenario uses Matter types directly for options
import {
  setupScenarioInEngine,
  runSimulationPerformance,
} from "../dist/src/scenario-runner-utils.js"; // Corrected path based on error message
// Note: ScenarioData and PerformanceRunResults types would ideally be imported
// but for a .js/.mjs script, we might have to redefine or rely on structure if not easily importable from .ts without a build step.
// For simplicity, we'll assume the structure is known here.

// --- Performance Configuration (mirrors the test file) ---
const PERFORMANCE_TEST_SEED = 98765;
const NUM_DYNAMIC_BODIES = 30;
const SIMULATION_DELTA_TIME = 1000 / 60; // Approx 60 FPS
const NUM_PERFORMANCE_RUNS = 5;
const PERFORMANCE_RUN_DURATION_MS = 2500; // 2.5 seconds per run

// performanceTestScenario definition (copied from scenario-performance.test.ts)
const performanceTestScenario = {
  description: "Standard Performance Test Scenario (Manual Script)",
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

async function generateReport() {
  console.log("Starting Manual Performance Report Generation...");
  const allRunResults = []; // To store PerformanceRunResults from each run

  console.log(
    `Will perform ${NUM_PERFORMANCE_RUNS} runs, each for ${PERFORMANCE_RUN_DURATION_MS}ms.`
  );

  for (let i = 0; i < NUM_PERFORMANCE_RUNS; i++) {
    console.log(
      `\n--- Starting Performance Run ${i + 1}/${NUM_PERFORMANCE_RUNS} ---`
    );
    const engine = Matter.Engine.create();
    await setupScenarioInEngine(engine, performanceTestScenario);

    const results = await runSimulationPerformance(
      engine,
      performanceTestScenario,
      "duration",
      PERFORMANCE_RUN_DURATION_MS,
      performanceTestScenario.seed || 0
    );
    allRunResults.push(results);

    console.log(`Run ${i + 1} Summary:
      Actual Duration: ${results.actualDurationMs.toFixed(2)} ms
      Actual Steps: ${results.actualSteps}
      Avg Step Time: ${(results.avgStepTimeMs || 0).toFixed(4)} ms
      Min Step Time: ${(results.minStepTimeMs || 0).toFixed(4)} ms
      Max Step Time: ${(results.maxStepTimeMs || 0).toFixed(4)} ms
      Median Step Time: ${(results.medianStepTimeMs || 0).toFixed(4)} ms
      Std Dev Step Time: ${(results.stdDevStepTimeMs || 0).toFixed(4)} ms
      Steps Per Second: ${results.stepsPerSecond.toFixed(2)} Hz`);
    console.log(
      `--- Finished Performance Run ${i + 1}/${NUM_PERFORMANCE_RUNS} ---`
    );
  }

  // Aggregate results
  if (allRunResults.length > 0) {
    const totalAvgStepTimeMs = allRunResults.reduce(
      (sum, r) => sum + (r.avgStepTimeMs || 0),
      0
    );
    const overallAverageStepTimeMs = totalAvgStepTimeMs / allRunResults.length;

    const totalMinStepTimeMs = allRunResults.reduce(
      (sum, r) => sum + (r.minStepTimeMs || 0),
      0
    );
    const overallAverageMinStepTimeMs =
      totalMinStepTimeMs / allRunResults.length;

    const totalMaxStepTimeMs = allRunResults.reduce(
      (sum, r) => sum + (r.maxStepTimeMs || 0),
      0
    );
    const overallAverageMaxStepTimeMs =
      totalMaxStepTimeMs / allRunResults.length;

    const totalMedianStepTimeMs = allRunResults.reduce(
      (sum, r) => sum + (r.medianStepTimeMs || 0),
      0
    );
    const overallAverageMedianStepTimeMs =
      totalMedianStepTimeMs / allRunResults.length;

    const totalStdDevStepTimeMs = allRunResults.reduce(
      (sum, r) => sum + (r.stdDevStepTimeMs || 0),
      0
    );
    const overallAverageStdDevStepTimeMs =
      totalStdDevStepTimeMs / allRunResults.length;

    const totalSteps = allRunResults.reduce((sum, r) => sum + r.actualSteps, 0);
    const totalDuration = allRunResults.reduce(
      (sum, r) => sum + r.actualDurationMs,
      0
    );
    const overallStepsPerSecond =
      totalDuration > 0 ? totalSteps / (totalDuration / 1000) : 0;

    console.log("\n--- Overall Aggregated Performance Report ---");
    console.log(`Number of Runs Conducted: ${allRunResults.length}`);
    console.log(`Total Simulation Steps Across All Runs: ${totalSteps}`);
    console.log(
      `Total Simulation Duration Across All Runs: ${totalDuration.toFixed(
        2
      )} ms`
    );
    console.log("-------------------------------------------");
    console.log(
      `Overall Average of AvgStepTimeMs:     ${overallAverageStepTimeMs.toFixed(
        4
      )} ms`
    );
    console.log(
      `Overall Average of MinStepTimeMs:     ${overallAverageMinStepTimeMs.toFixed(
        4
      )} ms`
    );
    console.log(
      `Overall Average of MaxStepTimeMs:     ${overallAverageMaxStepTimeMs.toFixed(
        4
      )} ms`
    );
    console.log(
      `Overall Average of MedianStepTimeMs:  ${overallAverageMedianStepTimeMs.toFixed(
        4
      )} ms`
    );
    console.log(
      `Overall Average of StdDevStepTimeMs: ${overallAverageStdDevStepTimeMs.toFixed(
        4
      )} ms (Note: Avg of StdDevs)`
    );
    console.log(
      `Overall Steps Per Second (calculated): ${overallStepsPerSecond.toFixed(
        2
      )} Hz`
    );
    console.log("===========================================");
  } else {
    console.log("No performance runs were completed to generate a report.");
  }
  console.log("Performance report generation finished.");
}

generateReport().catch((error) => {
  console.error("Error during performance report generation:", error);
  process.exit(1);
});
