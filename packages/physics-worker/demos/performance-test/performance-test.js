import { PhysicsWorkerClient } from "../../src/index.ts"; // Adjust path if needed
import { CommandType } from "../../src/commands.ts"; // Adjust path if needed
import Matter from "matter-js"; // If using npm package and bundler
// Otherwise, ensure Matter is globally available (e.g., via CDN in HTML)
import { scenarios } from "../../scenarios/scenario-definitions.js"; // Import defined scenarios

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

async function runMainThreadTest(scenarioData) {
  const { description, simulationParameters, worldOptions } = scenarioData;
  const numBodies = scenarioData.bodyGeneration?.count || 0;
  const durationMs = simulationParameters.durationMs;
  const deltaTime = simulationParameters.deltaTime;

  logPerformanceMessage(
    `Starting Main Thread Test: Scenario=${description}, Bodies=${numBodies}, Duration=${durationMs}ms`
  );
  mainThreadResultsOutput.textContent = "Running...";
  progressOutput.textContent = `Running Main Thread Test: ${description} (${numBodies} bodies)...`;
  mainThreadRenderContainer.style.display = "block";

  const metrics = new PerformanceMetrics();
  const engine = Matter.Engine.create();

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

  await setupScenarioFromDefinition(engine, scenarioData);
  logPerformanceMessage(`Main thread scenario '${description}' loaded.`);

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
    Matter.Engine.update(engine, deltaTime);
    const afterEngineUpdate = performance.now();
    const physicsTime = afterEngineUpdate - beforeEngineUpdate;
    metrics.recordFrame(physicsTime);
    if (simulationRunning) {
      requestAnimationFrame(runSimulationStep);
    }
  }
  requestAnimationFrame(runSimulationStep);
  await new Promise((resolve) => setTimeout(resolve, durationMs + 500));
  return metrics.getResults();
}

async function runWorkerTest(scenarioData) {
  const { description, simulationParameters, worldOptions } = scenarioData;
  const numBodies = scenarioData.bodyGeneration?.count || 0;
  const durationMs = simulationParameters.durationMs;
  const deltaTime = simulationParameters.deltaTime;

  logPerformanceMessage(
    `Starting Worker Test: Scenario=${description}, Bodies=${numBodies}, Duration=${durationMs}ms`
  );
  workerResultsOutput.textContent = "Running...";
  progressOutput.textContent = `Running Worker Test: ${description} (${numBodies} bodies)...`;
  const workerRenderCtx = workerRenderCanvas.getContext("2d");

  const metrics = new PerformanceMetrics();
  const physicsClient = new PhysicsWorkerClient();
  let simulationRunning = true;

  try {
    logPerformanceMessage(
      "PhysicsWorkerClient instance created. Proceeding with scenario setup."
    );
    await setupScenarioFromDefinition(physicsClient, scenarioData);
    logPerformanceMessage(
      `Worker scenario '${description}' setup commands sent.`
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
          { type: CommandType.STEP_SIMULATION, payload: { deltaTime } },
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
          if (simulationRunning) {
            requestAnimationFrame(stepWorker);
          }
        })
        .catch((error) => {
          if (!simulationRunning) return;
          logPerformanceMessage(
            `Error during worker simulation step: ${error.message}`,
            "ERROR"
          );
          if (error.stack) logPerformanceMessage(error.stack, "STACK");
          simulationRunning = false;
          metrics.endRun();
          workerResultsOutput.textContent = JSON.stringify(
            metrics.getResults(),
            null,
            2
          );
          if (physicsClient && typeof physicsClient.terminate === "function") {
            physicsClient.terminate();
          }
        });
    }
    requestAnimationFrame(stepWorker);
    await new Promise((resolve) => setTimeout(resolve, durationMs + 500));
  } catch (error) {
    simulationRunning = false;
    logPerformanceMessage(
      `Error in runWorkerTest setup: ${error.message}`,
      "ERROR"
    );
    if (error.stack) logPerformanceMessage(error.stack, "STACK");
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

function updateCharts(mainThreadData, workerData, scenarioData) {
  const labels = ["Main Thread", "Worker"];
  const scenarioName = scenarioData?.description || "N/A";
  const numBodies = scenarioData?.bodyGeneration?.count || "N/A";

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
  if (!scenarios[scenarioKey]) {
    logPerformanceMessage(
      `Error: Scenario with key '${scenarioKey}' not found.`,
      "ERROR"
    );
    return;
  }
  const selectedScenarioData = scenarios[scenarioKey];
  const iterations = 1; // For now

  logPerformanceMessage(
    `Starting Benchmark Suite: Scenario=${selectedScenarioData.description}, Iterations=${iterations}`
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
    const mtResults = await runMainThreadTest(selectedScenarioData);
    mainThreadAggregatedResults.push(mtResults);

    progressOutput.textContent = `Iteration ${
      i + 1
    }/${iterations}... Worker Test...`;
    const wResults = await runWorkerTest(selectedScenarioData);
    workerAggregatedResults.push(wResults);

    const avgMainThread = averageResults(mainThreadAggregatedResults);
    const avgWorker = averageResults(workerAggregatedResults);

    updateCharts(avgMainThread, avgWorker, selectedScenarioData);

    if (i < iterations - 1) {
      logPerformanceMessage("Waiting a bit before next iteration...");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  progressOutput.textContent = "Benchmark Suite Complete.";
  logPerformanceMessage("Benchmark Suite Finished.");
  runMainThreadButton.disabled = false;
  runWorkerButton.disabled = false;
  runBenchmarkSuiteButton.disabled = false;
  testCompleteIndicator.style.display = "block";
}

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

runMainThreadButton.addEventListener("click", async () => {
  const scenarioKey = scenarioSelect.value;
  if (!scenarios[scenarioKey]) return;
  const selectedScenarioData = scenarios[scenarioKey];

  runMainThreadButton.disabled = true;
  runWorkerButton.disabled = true;
  runBenchmarkSuiteButton.disabled = true;

  const results = await runMainThreadTest(selectedScenarioData);
  updateCharts(results, null, selectedScenarioData);

  runMainThreadButton.disabled = false;
  runWorkerButton.disabled = false;
  runBenchmarkSuiteButton.disabled = false;
});

runWorkerButton.addEventListener("click", async () => {
  const scenarioKey = scenarioSelect.value;
  if (!scenarios[scenarioKey]) return;
  const selectedScenarioData = scenarios[scenarioKey];

  runMainThreadButton.disabled = true;
  runWorkerButton.disabled = true;
  runBenchmarkSuiteButton.disabled = true;

  const results = await runWorkerTest(selectedScenarioData);
  updateCharts(null, results, selectedScenarioData);

  runMainThreadButton.disabled = false;
  runWorkerButton.disabled = false;
  runBenchmarkSuiteButton.disabled = false;
});

runBenchmarkSuiteButton.addEventListener("click", runBenchmarkSuite);

// Initial log message & chart
logPerformanceMessage("Performance test script loaded. Ready to run tests.");
if (scenarioSelect.value && scenarios[scenarioSelect.value]) {
  updateCharts(null, null, scenarios[scenarioSelect.value]);
} else if (Object.keys(scenarios).length > 0) {
  updateCharts(null, null, scenarios[Object.keys(scenarios)[0]]); // Use first scenario if current selection invalid
} else {
  updateCharts(null, null, {
    description: "No scenarios loaded",
    bodyGeneration: { count: 0 },
  }); // Fallback for empty charts
}

// Function to populate the scenario dropdown
function populateScenarioDropdown() {
  if (!scenarioSelect) return;
  scenarioSelect.innerHTML = ""; // Clear existing options
  Object.keys(scenarios).forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = scenarios[key].description || key;
    scenarioSelect.appendChild(option);
  });
  // Update related inputs based on the first scenario initially
  updateInputsFromSelectedScenario();
}

// Function to update numBodies and duration based on selected scenario
function updateInputsFromSelectedScenario() {
  if (!scenarioSelect || !scenarios[scenarioSelect.value]) return;
  const selectedScenarioData = scenarios[scenarioSelect.value];
  if (
    selectedScenarioData.bodyGeneration &&
    selectedScenarioData.bodyGeneration.count &&
    numBodiesInput
  ) {
    numBodiesInput.value = selectedScenarioData.bodyGeneration.count;
    numBodiesInput.disabled = true; // Disable as it's driven by scenario
  } else if (numBodiesInput) {
    numBodiesInput.disabled = false; // Enable if scenario doesn't define count
  }

  if (
    selectedScenarioData.simulationParameters &&
    selectedScenarioData.simulationParameters.durationMs &&
    testDurationInput
  ) {
    testDurationInput.value =
      selectedScenarioData.simulationParameters.durationMs;
    testDurationInput.disabled = true; // Disable as it's driven by scenario
  } else if (testDurationInput) {
    testDurationInput.disabled = false;
  }
}

// Listener for scenario changes to update inputs
if (scenarioSelect) {
  scenarioSelect.addEventListener("change", updateInputsFromSelectedScenario);
}

// Initial population
populateScenarioDropdown();

// Placeholder for the new setup function
async function setupScenarioFromDefinition(engineOrClient, scenarioData) {
  logPerformanceMessage(`Setting up scenario: ${scenarioData.description}`);
  const { worldOptions, staticBodies, bodyGeneration } = scenarioData;
  let dynamicBodiesCreated = 0;
  let staticBodiesCreated = 0;

  // Helper to generate a random number in a range
  const randomInRange = (min, max) => Math.random() * (max - min) + min;

  if (engineOrClient instanceof PhysicsWorkerClient) {
    const client = engineOrClient;
    // 1. INIT_WORLD (worker creates 4 boundary walls by default)
    await client.sendMessage({
      type: CommandType.INIT_WORLD,
      payload: worldOptions,
    });
    logPerformanceMessage(
      `INIT_WORLD sent to worker. Worker creates its own 4 boundary walls.`
    );
    staticBodiesCreated = 4; // Account for worker's internal walls

    // 2. Add any *additional* explicit static bodies from scenarioData.staticBodies
    if (staticBodies && staticBodies.length > 0) {
      const staticPromises = staticBodies.map((bodyDef) => {
        const payload = {
          ...bodyDef,
          id: bodyDef.id || `static-${staticBodiesCreated++}`,
        };
        return client.sendMessage({ type: CommandType.ADD_BODY, payload });
      });
      await Promise.all(staticPromises);
      logPerformanceMessage(
        `${staticBodies.length} additional static bodies ADD_BODY commands sent to worker.`
      );
      // staticBodiesCreated += staticBodies.length; // Already counted if they have unique IDs
    }

    // 3. Generate and add dynamic bodies
    if (bodyGeneration) {
      const dynamicBodyPromises = [];
      for (let i = 0; i < bodyGeneration.count; i++) {
        const id = `${bodyGeneration.idPrefix}-${i}`;
        let bodyPayload;
        if (bodyGeneration.placement) {
          // Specific placement (e.g., for stacks)
          const p = bodyGeneration.placement;
          bodyPayload = {
            id,
            type: bodyGeneration.type,
            x: p.startX,
            y: p.startY - i * (p.boxHeight + p.spacingY), // Stack upwards
            width: p.boxWidth,
            height: p.boxHeight,
            options: { ...(bodyGeneration.templateOptions || {}), label: id },
          };
        } else {
          // Random positioning
          const p = bodyGeneration.positioning;
          bodyPayload = {
            id,
            type: bodyGeneration.type,
            x: randomInRange(p.x.min, p.x.max),
            y: randomInRange(p.y.min, p.y.max),
            width: randomInRange(p.width.min, p.width.max),
            height: randomInRange(p.height.min, p.height.max),
            options: { ...(bodyGeneration.templateOptions || {}), label: id },
          };
        }
        dynamicBodyPromises.push(
          client.sendMessage({
            type: CommandType.ADD_BODY,
            payload: bodyPayload,
          })
        );
      }
      await Promise.all(dynamicBodyPromises);
      dynamicBodiesCreated = bodyGeneration.count;
      logPerformanceMessage(
        `${dynamicBodiesCreated} dynamic bodies ADD_BODY commands sent to worker.`
      );
    }
  } else {
    // Direct Matter.js Engine manipulation
    const engine = engineOrClient;
    Matter.Composite.clear(engine.world, false);
    engine.world.gravity = { ...worldOptions.gravity }; // Set gravity

    // 1. Add 4 boundary walls for parity with worker
    const wallOpts = { isStatic: true, label: "wall" };
    Matter.World.add(engine.world, [
      Matter.Bodies.rectangle(
        worldOptions.width / 2,
        worldOptions.height - 25,
        worldOptions.width,
        50,
        { ...wallOpts, label: "ground", id: "ground-main" }
      ),
      Matter.Bodies.rectangle(
        worldOptions.width / 2,
        25,
        worldOptions.width,
        50,
        { ...wallOpts, label: "ceiling", id: "ceiling-main" }
      ),
      Matter.Bodies.rectangle(
        25,
        worldOptions.height / 2,
        50,
        worldOptions.height,
        { ...wallOpts, label: "leftWall", id: "leftWall-main" }
      ),
      Matter.Bodies.rectangle(
        worldOptions.width - 25,
        worldOptions.height / 2,
        50,
        worldOptions.height,
        { ...wallOpts, label: "rightWall", id: "rightWall-main" }
      ),
    ]);
    staticBodiesCreated = 4;
    logPerformanceMessage(
      `4 boundary walls added directly to engine for parity.`
    );

    // 2. Add any *additional* explicit static bodies
    if (staticBodies && staticBodies.length > 0) {
      const matterStaticBodies = staticBodies.map((bodyDef) => {
        // Create Matter body based on bodyDef (simplified: assumes rectangle for now)
        return Matter.Bodies.rectangle(
          bodyDef.x,
          bodyDef.y,
          bodyDef.width,
          bodyDef.height,
          {
            ...(bodyDef.options || {}),
            id: bodyDef.id || `static-main-${staticBodiesCreated++}`,
            label: bodyDef.options?.label || bodyDef.id,
          }
        );
      });
      Matter.World.add(engine.world, matterStaticBodies);
      logPerformanceMessage(
        `${matterStaticBodies.length} additional static bodies added to engine.`
      );
      // staticBodiesCreated += matterStaticBodies.length; // Already counted if they have unique IDs
    }

    // 3. Generate and add dynamic bodies
    if (bodyGeneration) {
      const matterDynamicBodies = [];
      for (let i = 0; i < bodyGeneration.count; i++) {
        const id = `${bodyGeneration.idPrefix}-main-${i}`;
        let body;
        if (bodyGeneration.placement) {
          const p = bodyGeneration.placement;
          body = Matter.Bodies.rectangle(
            p.startX,
            p.startY - i * (p.boxHeight + p.spacingY),
            p.boxWidth,
            p.boxHeight,
            { ...(bodyGeneration.templateOptions || {}), id, label: id }
          );
        } else {
          const p = bodyGeneration.positioning;
          body = Matter.Bodies.rectangle(
            randomInRange(p.x.min, p.x.max),
            randomInRange(p.y.min, p.y.max),
            randomInRange(p.width.min, p.width.max),
            randomInRange(p.height.min, p.height.max),
            { ...(bodyGeneration.templateOptions || {}), id, label: id }
          );
        }
        matterDynamicBodies.push(body);
      }
      Matter.World.add(engine.world, matterDynamicBodies);
      dynamicBodiesCreated = bodyGeneration.count;
      logPerformanceMessage(
        `${dynamicBodiesCreated} dynamic bodies added directly to engine.`
      );
    }
  }
  return {
    dynamicBodiesCreated,
    staticBodiesCreated,
    scenarioName: scenarioData.description,
  };
}
