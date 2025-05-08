import { PhysicsWorkerClient } from "../../src/index.ts"; // Adjust path if needed
import { CommandType } from "../../src/commands.ts"; // Adjust path if needed
import Matter from "matter-js"; // If using npm package and bundler
// Otherwise, ensure Matter is globally available (e.g., via CDN in HTML)

// DOM Elements
const numBodiesInput = document.getElementById("numBodies");
const scenarioSelect = document.getElementById("scenarioSelect");
const testDurationInput = document.getElementById("testDuration");
const runMainThreadButton = document.getElementById("runMainThread");
const runWorkerButton = document.getElementById("runWorker");
const runBenchmarkSuiteButton = document.getElementById("runBenchmarkSuite");

const mainThreadResultsOutput = document.getElementById(
  "mainThreadResultsOutput"
);
const workerResultsOutput = document.getElementById("workerResultsOutput");
const progressOutput = document.getElementById("progress");
const logOutput = document.getElementById("logOutputPerformance");
const testCompleteIndicator = document.getElementById(
  "test-complete-indicator"
);

// Phaser/Matter.js render containers (optional, if direct rendering is used)
const mainThreadRenderContainer = document.getElementById(
  "phaser-container-main"
);
const workerRenderCanvas = document.getElementById("worker-render-canvas");

// Chart instances
let fpsChartInstance = null;
let avgPhysicsTimeChartInstance = null;
let totalTimeChartInstance = null;

let logCount = 0;

function logPerformanceMessage(message, type = "INFO") {
  logCount++;
  const timestamp = new Date().toLocaleTimeString();
  const formattedMessage = `${logCount} [${timestamp}] [${type}]: ${
    typeof message === "object" ? JSON.stringify(message, null, 2) : message
  }\n`;
  console.log(`[PerfTest] ${formattedMessage}`);
  if (logOutput) {
    logOutput.textContent += formattedMessage;
    logOutput.scrollTop = logOutput.scrollHeight;
    // Simple log trimming
    if (logCount > 200) {
      const lines = logOutput.textContent.split("\n");
      if (lines.length > 400) {
        logOutput.textContent = lines.slice(lines.length - 200).join("\n");
      }
    }
  }
}

class PerformanceMetrics {
  constructor() {
    this.reset();
  }

  reset() {
    this.frameCount = 0;
    this.totalPhysicsTime = 0; // Sum of individual physics step times
    this.minPhysicsTime = Number.MAX_VALUE;
    this.maxPhysicsTime = 0;
    this.startTime = 0; // Timestamp when the test run starts
    this.endTime = 0; // Timestamp when the test run ends
    this.frameTimes = []; // Array of total time per frame (for FPS)
    this.physicsStepTimes = []; // Array of physics step times (for avg physics time)
    this.lastFrameTimestamp = 0;
  }

  startRun() {
    this.reset();
    this.startTime = performance.now();
    this.lastFrameTimestamp = this.startTime;
    logPerformanceMessage("Metrics run started.");
  }

  // Call this each frame/step of the simulation
  recordFrame(physicsStepDuration) {
    const now = performance.now();
    const frameDuration = now - this.lastFrameTimestamp;
    this.lastFrameTimestamp = now;

    this.frameCount++;
    this.frameTimes.push(frameDuration);

    if (typeof physicsStepDuration === "number") {
      this.physicsStepTimes.push(physicsStepDuration);
      this.totalPhysicsTime += physicsStepDuration;
      this.minPhysicsTime = Math.min(this.minPhysicsTime, physicsStepDuration);
      this.maxPhysicsTime = Math.max(this.maxPhysicsTime, physicsStepDuration);
    }
  }

  endRun() {
    this.endTime = performance.now();
    logPerformanceMessage(
      `Metrics run ended. Total duration: ${this.getTotalTime().toFixed(2)}ms`
    );
  }

  getTotalTime() {
    return this.endTime - this.startTime;
  }

  getAveragePhysicsStepTime() {
    if (this.physicsStepTimes.length === 0) return 0;
    return this.totalPhysicsTime / this.physicsStepTimes.length;
  }

  getFPS() {
    if (this.frameTimes.length < 2) return 0; // Need at least 2 frames
    // Skip first few frames for warmup, e.g., 10% or a fixed number
    const warmupFrames = Math.min(Math.floor(this.frameTimes.length * 0.1), 10);
    const steadyFrames = this.frameTimes.slice(warmupFrames);
    if (steadyFrames.length === 0) return 0;

    const averageFrameTime =
      steadyFrames.reduce((sum, time) => sum + time, 0) / steadyFrames.length;
    return 1000 / averageFrameTime;
  }

  getResults() {
    const totalTime = this.getTotalTime();
    const avgPhysicsTime = this.getAveragePhysicsStepTime();
    const fps = this.getFPS();

    return {
      totalRunTimeMs: parseFloat(totalTime.toFixed(2)),
      frameCount: this.frameCount,
      avgPhysicsStepTimeMs: parseFloat(avgPhysicsTime.toFixed(2)),
      minPhysicsStepTimeMs: parseFloat(
        this.minPhysicsTime === Number.MAX_VALUE
          ? 0
          : this.minPhysicsTime.toFixed(2)
      ),
      maxPhysicsStepTimeMs: parseFloat(this.maxPhysicsTime.toFixed(2)),
      fps: parseFloat(fps.toFixed(2)),
      rawFrameTimes: this.frameTimes,
      rawPhysicsStepTimes: this.physicsStepTimes,
    };
  }
}

async function runMainThreadTest(scenarioKey, numBodies, durationMs) {
  logPerformanceMessage(
    `Starting Main Thread Test: Scenario=${scenarioKey}, Bodies=${numBodies}, Duration=${durationMs}ms`
  );
  mainThreadResultsOutput.textContent = "Running...";
  // TODO: Implement main thread test logic
  // 1. Initialize Matter.js engine
  // 2. Load scenario (e.g., using a TestScenarios object - to be created)
  // 3. Setup renderer if needed (e.g., Matter.Render)
  // 4. Run simulation loop for durationMs, collecting metrics
  // 5. Display results

  // Placeholder result
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate work
  const placeholderResults = new PerformanceMetrics();
  placeholderResults.startRun();
  for (let i = 0; i < 100; i++) placeholderResults.recordFrame(16);
  placeholderResults.endRun();

  mainThreadResultsOutput.textContent = JSON.stringify(
    placeholderResults.getResults(),
    null,
    2
  );
  logPerformanceMessage("Main Thread Test Finished (Placeholder).");
  return placeholderResults.getResults();
}

async function runWorkerTest(scenarioKey, numBodies, durationMs) {
  logPerformanceMessage(
    `Starting Worker Test: Scenario=${scenarioKey}, Bodies=${numBodies}, Duration=${durationMs}ms`
  );
  workerResultsOutput.textContent = "Running...";
  const physicsClient = new PhysicsWorkerClient();
  // TODO: Implement worker test logic
  // 1. Initialize physicsClient
  // 2. Send commands to setup scenario in worker (INIT_WORLD, ADD_BODY for scenario)
  // 3. Run simulation loop (sending STEP_SIMULATION) for durationMs, collecting metrics
  //    - Metric for physics step time: time from sending STEP to receiving STEP_COMPLETE
  // 4. Display results
  // 5. Terminate worker

  // Placeholder result
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate work
  const placeholderResults = new PerformanceMetrics();
  placeholderResults.startRun();
  for (let i = 0; i < 100; i++) placeholderResults.recordFrame(10);
  placeholderResults.endRun();

  workerResultsOutput.textContent = JSON.stringify(
    placeholderResults.getResults(),
    null,
    2
  );
  await physicsClient.terminate();
  logPerformanceMessage("Worker Test Finished (Placeholder).");
  return placeholderResults.getResults();
}

const TestScenarios = {
  fallingBoxes: (engineOrClient, numBodies) => {
    logPerformanceMessage(
      `Setting up scenario: fallingBoxes with ${numBodies} bodies`
    );
    // This function will need to be adapted to work with both a direct Matter.js engine
    // and the PhysicsWorkerClient (by sending commands).
    // For now, a conceptual placeholder.
    if (engineOrClient instanceof PhysicsWorkerClient) {
      // Send commands to worker
      // engineOrClient.sendMessage({ type: CommandType.INIT_WORLD, payload: { ... } });
      // for (let i = 0; i < numBodies; i++) { ... send ADD_BODY ... }
    } else {
      // Direct Matter.js engine manipulation
      // Matter.Composite.clear(engineOrClient.world, false);
      // const ground = Matter.Bodies.rectangle(400, 580, 810, 60, { isStatic: true });
      // Matter.World.add(engineOrClient.world, [ground]);
      // for (let i = 0; i < numBodies; i++) { ... Matter.World.add ... }
    }
    return { bodiesAdded: numBodies, scenarioName: "fallingBoxes" }; // Example return
  },
  chainReaction: (engineOrClient, numBodies) => {
    logPerformanceMessage(
      `Setting up scenario: chainReaction with ${numBodies} elements`
    );
    // Similar logic for chain reaction
    return { bodiesAdded: numBodies, scenarioName: "chainReaction" };
  },
  manySmallCircles: (engineOrClient, numBodies) => {
    logPerformanceMessage(
      `Setting up scenario: manySmallCircles with ${numBodies} circles`
    );
    // Similar logic for many small circles
    return { bodiesAdded: numBodies, scenarioName: "manySmallCircles" };
  },
};

function updateCharts(mainThreadData, workerData, scenarioName, numBodies) {
  const labels = ["Main Thread", "Worker"];

  const commonChartOptions = (titleText) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `${titleText} (${scenarioName} - ${numBodies} bodies)`,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  });

  // FPS Chart
  if (fpsChartInstance) fpsChartInstance.destroy();
  fpsChartInstance = new Chart(
    document.getElementById("fpsChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "FPS",
            data: [mainThreadData?.fps || 0, workerData?.fps || 0],
            backgroundColor: [
              "rgba(255, 99, 132, 0.5)",
              "rgba(54, 162, 235, 0.5)",
            ],
            borderColor: ["rgba(255, 99, 132, 1)", "rgba(54, 162, 235, 1)"],
            borderWidth: 1,
          },
        ],
      },
      options: commonChartOptions("Frames Per Second (FPS)"),
    }
  );

  // Average Physics Step Time Chart
  if (avgPhysicsTimeChartInstance) avgPhysicsTimeChartInstance.destroy();
  avgPhysicsTimeChartInstance = new Chart(
    document.getElementById("avgPhysicsTimeChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Avg. Physics Step Time (ms)",
            data: [
              mainThreadData?.avgPhysicsStepTimeMs || 0,
              workerData?.avgPhysicsStepTimeMs || 0,
            ],
            backgroundColor: [
              "rgba(255, 159, 64, 0.5)",
              "rgba(75, 192, 192, 0.5)",
            ],
            borderColor: ["rgba(255, 159, 64, 1)", "rgba(75, 192, 192, 1)"],
            borderWidth: 1,
          },
        ],
      },
      options: commonChartOptions("Average Physics Step Time (ms)"),
    }
  );

  // Total Run Time Chart
  if (totalTimeChartInstance) totalTimeChartInstance.destroy();
  totalTimeChartInstance = new Chart(
    document.getElementById("totalTimeChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Total Run Time (ms)",
            data: [
              mainThreadData?.totalRunTimeMs || 0,
              workerData?.totalRunTimeMs || 0,
            ],
            backgroundColor: [
              "rgba(153, 102, 255, 0.5)",
              "rgba(255, 205, 86, 0.5)",
            ],
            borderColor: ["rgba(153, 102, 255, 1)", "rgba(255, 205, 86, 1)"],
            borderWidth: 1,
          },
        ],
      },
      options: commonChartOptions("Total Test Run Time (ms)"),
    }
  );
}

async function runBenchmarkSuite() {
  const scenarioKey = scenarioSelect.value;
  const numBodies = parseInt(numBodiesInput.value);
  const durationMs = parseInt(testDurationInput.value);
  const iterations = 1; // For now, just one iteration. Can be made configurable.

  logPerformanceMessage(
    `Starting Benchmark Suite: Scenario=${scenarioKey}, Bodies=${numBodies}, Duration=${durationMs}ms, Iterations=${iterations}`
  );
  progressOutput.textContent = "Benchmark running...";
  runMainThreadButton.disabled = true;
  runWorkerButton.disabled = true;
  runBenchmarkSuiteButton.disabled = true;
  testCompleteIndicator.style.display = "none";

  let mainThreadAggregatedResults = [];
  let workerAggregatedResults = [];

  for (let i = 0; i < iterations; i++) {
    logPerformanceMessage(`Benchmark Iteration ${i + 1}/${iterations}`);
    progressOutput.textContent = `Iteration ${
      i + 1
    }/${iterations}... Main Thread Test...`;
    const mtResults = await runMainThreadTest(
      scenarioKey,
      numBodies,
      durationMs
    );
    mainThreadAggregatedResults.push(mtResults);

    progressOutput.textContent = `Iteration ${
      i + 1
    }/${iterations}... Worker Test...`;
    const wResults = await runWorkerTest(scenarioKey, numBodies, durationMs);
    workerAggregatedResults.push(wResults);

    // Simple averaging for now. Could be more sophisticated.
    const avgMainThread = averageResults(mainThreadAggregatedResults);
    const avgWorker = averageResults(workerAggregatedResults);

    updateCharts(avgMainThread, avgWorker, scenarioKey, numBodies);

    if (i < iterations - 1) {
      logPerformanceMessage("Waiting a bit before next iteration...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Short pause
    }
  }

  progressOutput.textContent = "Benchmark Suite Complete.";
  logPerformanceMessage("Benchmark Suite Finished.");
  runMainThreadButton.disabled = false;
  runWorkerButton.disabled = false;
  runBenchmarkSuiteButton.disabled = false;
  testCompleteIndicator.style.display = "block"; // For Puppeteer
}

// Simple averaging function - can be expanded
function averageResults(resultsArray) {
  if (!resultsArray || resultsArray.length === 0) return {};
  const summed = resultsArray.reduce((acc, current) => {
    Object.keys(current).forEach((key) => {
      if (typeof current[key] === "number") {
        acc[key] = (acc[key] || 0) + current[key];
      }
    });
    return acc;
  }, {});

  const averaged = {};
  Object.keys(summed).forEach((key) => {
    averaged[key] = summed[key] / resultsArray.length;
    // Keep precision for display
    if (key.endsWith("Ms") || key === "fps") {
      averaged[key] = parseFloat(averaged[key].toFixed(2));
    }
  });
  return averaged;
}

// Event Listeners
runMainThreadButton.addEventListener("click", async () => {
  const scenarioKey = scenarioSelect.value;
  const numBodies = parseInt(numBodiesInput.value);
  const durationMs = parseInt(testDurationInput.value);
  runMainThreadButton.disabled = true;
  runWorkerButton.disabled = true;
  runBenchmarkSuiteButton.disabled = true;
  const results = await runMainThreadTest(scenarioKey, numBodies, durationMs);
  updateCharts(results, null, scenarioKey, numBodies); // Update with only main thread data for now
  runMainThreadButton.disabled = false;
  runWorkerButton.disabled = false;
  runBenchmarkSuiteButton.disabled = false;
});

runWorkerButton.addEventListener("click", async () => {
  const scenarioKey = scenarioSelect.value;
  const numBodies = parseInt(numBodiesInput.value);
  const durationMs = parseInt(testDurationInput.value);
  runMainThreadButton.disabled = true;
  runWorkerButton.disabled = true;
  runBenchmarkSuiteButton.disabled = true;
  const results = await runWorkerTest(scenarioKey, numBodies, durationMs);
  updateCharts(null, results, scenarioKey, numBodies); // Update with only worker data for now
  runMainThreadButton.disabled = false;
  runWorkerButton.disabled = false;
  runBenchmarkSuiteButton.disabled = false;
});

runBenchmarkSuiteButton.addEventListener("click", runBenchmarkSuite);

// Initial log message
logPerformanceMessage("Performance test script loaded. Ready to run tests.");
// Initial chart display (empty)
updateCharts(null, null, scenarioSelect.value, parseInt(numBodiesInput.value));
