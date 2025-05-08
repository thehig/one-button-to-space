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
  progressOutput.textContent = `Running Main Thread Test: ${scenarioKey} (${numBodies} bodies)...`;
  mainThreadRenderContainer.style.display = "block";

  const metrics = new PerformanceMetrics();
  const engine = Matter.Engine.create();
  const worldOptions = {
    width: 800,
    height: 600,
    gravity: { x: 0, y: 1, scale: 0.001 },
  };
  engine.world.gravity = worldOptions.gravity;

  while (
    mainThreadRenderContainer.firstChild &&
    mainThreadRenderContainer.firstChild.tagName !== "P"
  ) {
    mainThreadRenderContainer.removeChild(mainThreadRenderContainer.firstChild);
  }

  const render = Matter.Render.create({
    element: mainThreadRenderContainer,
    engine: engine,
    options: {
      width: worldOptions.width,
      height: worldOptions.height,
      wireframes: true,
      showAngleIndicator: false,
      showCollisions: false,
      showVelocity: false,
    },
  });

  await TestScenarios[scenarioKey](engine, numBodies, worldOptions);
  logPerformanceMessage(`Main thread scenario ${scenarioKey} loaded.`);

  Matter.Render.run(render);

  metrics.startRun();
  let simulationRunning = true;

  function runSimulationStep() {
    if (!simulationRunning) return;

    if (metrics.getTotalTime() >= durationMs) {
      simulationRunning = false;
      Matter.Render.stop(render);
      metrics.endRun();
      mainThreadResultsOutput.textContent = JSON.stringify(
        metrics.getResults(),
        null,
        2
      );
      logPerformanceMessage("Main Thread Test Finished.");
      progressOutput.textContent = "Main Thread Test Complete.";
      return;
    }

    const beforeEngineUpdate = performance.now();
    Matter.Engine.update(engine, 1000 / 60);
    const afterEngineUpdate = performance.now();
    const physicsTime = afterEngineUpdate - beforeEngineUpdate;

    metrics.recordFrame(physicsTime);

    if (simulationRunning) {
      requestAnimationFrame(runSimulationStep);
    }
  }
  requestAnimationFrame(runSimulationStep); // Start the loop

  await new Promise((resolve) => setTimeout(resolve, durationMs + 500));
  return metrics.getResults();
}

async function runWorkerTest(scenarioKey, numBodies, durationMs) {
  logPerformanceMessage(
    `Starting Worker Test: Scenario=${scenarioKey}, Bodies=${numBodies}, Duration=${durationMs}ms`
  );
  workerResultsOutput.textContent = "Running...";
  progressOutput.textContent = `Running Worker Test: ${scenarioKey} (${numBodies} bodies)...`;
  const workerRenderCtx = workerRenderCanvas.getContext("2d");

  const metrics = new PerformanceMetrics();
  const physicsClient = new PhysicsWorkerClient();

  let simulationRunning = true; // Moved up for broader scope

  try {
    logPerformanceMessage(
      "PhysicsWorkerClient instance created. Proceeding with scenario setup."
    );
    const worldOptions = {
      width: workerRenderCanvas.width,
      height: workerRenderCanvas.height,
      gravity: { x: 0, y: 1, scale: 0.001 },
    };

    await TestScenarios[scenarioKey](physicsClient, numBodies, worldOptions);
    logPerformanceMessage(
      `Worker scenario ${scenarioKey} setup commands sent.`
    );

    metrics.startRun();

    function stepWorker() {
      if (!simulationRunning) return;

      if (metrics.getTotalTime() >= durationMs) {
        simulationRunning = false;
        metrics.endRun();
        workerResultsOutput.textContent = JSON.stringify(
          metrics.getResults(),
          null,
          2
        );
        logPerformanceMessage("Worker Test Finished.");
        progressOutput.textContent = "Worker Test Complete.";
        if (physicsClient && typeof physicsClient.terminate === "function") {
          physicsClient.terminate();
        }
        return;
      }

      const beforeStepCommand = performance.now();
      physicsClient
        .sendMessage(
          {
            type: CommandType.STEP_SIMULATION,
            payload: { deltaTime: 1000 / 60 },
          },
          CommandType.SIMULATION_STEPPED
        )
        .then((response) => {
          if (!simulationRunning) return;

          const afterStepResponse = performance.now();
          const physicsTime = afterStepResponse - beforeStepCommand;
          metrics.recordFrame(physicsTime);

          if (response && response.payload && response.payload.bodies) {
            renderWorkerBodies(
              workerRenderCtx,
              response.payload.bodies,
              worldOptions.width,
              worldOptions.height
            );
          }
          // Only request next frame if still running
          if (simulationRunning) {
            requestAnimationFrame(stepWorker);
          }
        })
        .catch((error) => {
          if (!simulationRunning) return; // Avoid double logging if already stopped
          logPerformanceMessage(
            `Error during worker simulation step: ${error.message}`,
            "ERROR"
          );
          if (error.stack) {
            logPerformanceMessage(error.stack, "STACK");
          }
          simulationRunning = false;
          metrics.endRun();
          workerResultsOutput.textContent = JSON.stringify(
            metrics.getResults(),
            null,
            2
          ); // Show partial results
          if (physicsClient && typeof physicsClient.terminate === "function") {
            physicsClient.terminate();
          }
        });
    }

    requestAnimationFrame(stepWorker); // Start the loop

    await new Promise((resolve) => setTimeout(resolve, durationMs + 500));
  } catch (error) {
    simulationRunning = false; // Ensure loop stops on outer error too
    logPerformanceMessage(
      `Error in runWorkerTest setup: ${error.message}`,
      "ERROR"
    );
    if (error.stack) {
      logPerformanceMessage(error.stack, "STACK");
    }
    workerResultsOutput.textContent = `Error: ${error.message}`;
    metrics.endRun();
    if (physicsClient && typeof physicsClient.terminate === "function") {
      physicsClient.terminate();
    }
  }
  return metrics.getResults();
}

function renderWorkerBodies(ctx, bodies, canvasWidth, canvasHeight) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = "rgba(0, 0, 0, 0.1)"; // For static boundaries if they are sent back
  ctx.strokeStyle = "black";

  bodies.forEach((body) => {
    // A simple renderer. Assumes bodies have id, x, y, angle.
    // And for simplicity, assumes all are rectangles for now if no type info.
    // This needs to be more robust based on what SIMULATION_STEPPED sends.
    // Let's assume SIMULATION_STEPPED might also send width/height/radius and type if available.

    ctx.save();
    ctx.translate(body.x, body.y);
    ctx.rotate(body.angle);

    // Example: if body has a known type and dimensions (worker should send these)
    if (body.label && body.label.startsWith("ground")) {
      // Example for ground, assuming label is passed
      // This won't be called if ground is not part of dynamic bodies from worker
    } else if (body.type === "rectangle" && body.width && body.height) {
      ctx.fillStyle = "blue";
      ctx.fillRect(-body.width / 2, -body.height / 2, body.width, body.height);
      ctx.strokeRect(
        -body.width / 2,
        -body.height / 2,
        body.width,
        body.height
      );
    } else if (body.type === "circle" && body.radius) {
      ctx.fillStyle = "green";
      ctx.beginPath();
      ctx.arc(0, 0, body.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Default fallback rendering if type/dims unknown (e.g. small square)
      // The worker's SIMULATION_STEPPED payload should include type and dimensions for proper rendering.
      // For now, if body.width and body.height are part of the payload, use them.
      const w = body.width || 20; // Default if not provided
      const h = body.height || 20;
      ctx.fillStyle = "grey";
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeRect(-w / 2, -h / 2, w, h);
    }
    ctx.restore();
  });
}

const TestScenarios = {
  fallingBoxes: async (
    engineOrClient,
    numBodies,
    worldOptions = {
      width: 800,
      height: 600,
      gravity: { x: 0, y: 1, scale: 0.001 },
    }
  ) => {
    logPerformanceMessage(
      `Setting up scenario: fallingBoxes with ${numBodies} bodies`
    );
    const addedBodyDetails = {
      scenarioName: "fallingBoxes",
      dynamicBodies: 0,
      staticBodies: 0,
    };

    if (engineOrClient instanceof PhysicsWorkerClient) {
      const client = engineOrClient;
      // INIT_WORLD in the worker already creates 4 boundary walls (ground, ceiling, left, right).
      // It uses the width/height from worldOptions for this.
      await client.sendMessage({
        type: CommandType.INIT_WORLD,
        payload: worldOptions,
      });
      logPerformanceMessage(
        `INIT_WORLD command sent to worker. Worker will create its own boundaries.`
      );
      addedBodyDetails.staticBodies = 4; // Worker creates 4 walls

      // Add Dynamic Bodies to Worker
      const boxPromises = [];
      for (let i = 0; i < numBodies; i++) {
        const bodyId = `box-worker-${i}`;
        const boxPayload = {
          id: bodyId,
          type: "rectangle",
          x: Math.random() * (worldOptions.width - 60) + 30, // Keep away from edges
          y: Math.random() * (worldOptions.height / 2 - 50) + 25, // Drop from top half, away from ceiling
          width: Math.random() * 20 + 10,
          height: Math.random() * 20 + 10,
          options: { restitution: 0.5, friction: 0.1, label: bodyId },
        };
        boxPromises.push(
          client.sendMessage({
            type: CommandType.ADD_BODY,
            payload: boxPayload,
          })
        );
      }
      await Promise.all(boxPromises); // Send all add body commands and wait for them
      addedBodyDetails.dynamicBodies = numBodies;
      logPerformanceMessage(
        `${numBodies} dynamic boxes ADD_BODY commands sent to worker.`
      );
    } else {
      // Direct Matter.js engine manipulation
      const engine = engineOrClient;
      Matter.Composite.clear(engine.world, false);
      engine.world.gravity.x = worldOptions.gravity.x;
      engine.world.gravity.y = worldOptions.gravity.y;
      engine.world.gravity.scale = worldOptions.gravity.scale;

      // Add 4 boundary walls for parity with worker's INIT_WORLD behavior
      const wallOptions = { isStatic: true, label: "wall" };
      Matter.World.add(engine.world, [
        Matter.Bodies.rectangle(
          worldOptions.width / 2,
          worldOptions.height - 25,
          worldOptions.width,
          50,
          { ...wallOptions, label: "ground" }
        ), // Ground
        Matter.Bodies.rectangle(
          worldOptions.width / 2,
          25,
          worldOptions.width,
          50,
          { ...wallOptions, label: "ceiling" }
        ), // Ceiling
        Matter.Bodies.rectangle(
          25,
          worldOptions.height / 2,
          50,
          worldOptions.height,
          { ...wallOptions, label: "leftWall" }
        ), // Left wall
        Matter.Bodies.rectangle(
          worldOptions.width - 25,
          worldOptions.height / 2,
          50,
          worldOptions.height,
          { ...wallOptions, label: "rightWall" }
        ), // Right wall
      ]);
      addedBodyDetails.staticBodies = 4;
      logPerformanceMessage(`4 boundary walls added directly to engine.`);

      const dynamicBodies = [];
      for (let i = 0; i < numBodies; i++) {
        const bodyId = `box-main-${i}`;
        const box = Matter.Bodies.rectangle(
          Math.random() * (worldOptions.width - 60) + 30,
          Math.random() * (worldOptions.height / 2 - 50) + 25,
          Math.random() * 20 + 10,
          Math.random() * 20 + 10,
          { restitution: 0.5, friction: 0.1, label: bodyId }
        );
        dynamicBodies.push(box);
      }
      Matter.World.add(engine.world, dynamicBodies);
      addedBodyDetails.dynamicBodies = numBodies;
      logPerformanceMessage(
        `${numBodies} dynamic boxes added directly to engine.`
      );
    }
    return addedBodyDetails;
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
