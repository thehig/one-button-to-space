import Matter from "matter-js";
import { scenarios } from "../../scenarios/scenario-definitions.js";

// --- Seeded PRNG (Mulberry32) ---
/**
 * Creates a pseudo-random number generator based on the Mulberry32 algorithm.
 * @param {number} seed - The initial seed value.
 * @returns {function(): number} A function that returns a pseudo-random float between 0 (inclusive) and 1 (exclusive).
 */
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5); // Increase seed
    t = Math.imul(t ^ (t >>> 15), t | 1); // Bitwise operations
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    // Return a float between 0 (inclusive) and 1 (exclusive)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a deterministic color string in HSL format using a seeded PRNG.
 * @param {function(): number} randomFunc - The seeded PRNG function (e.g., mulberry32 instance).
 * @returns {string} An HSL color string (e.g., "hsl(120, 70%, 50%)").
 */
function generateDeterministicColor(randomFunc) {
  const hue = Math.floor(randomFunc() * 360); // Random hue (0-359)
  const saturation = 70; // Fixed saturation
  const lightness = 60; // Fixed lightness
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// DOM Elements
const scenarioSelect = document.getElementById("scenarioSelect");
const runScenarioButton = document.getElementById("runScenarioButton");
const renderContainer = document.getElementById("renderContainer");
const seedInput = document.getElementById("seedInput");
const runModeDurationRadio = document.getElementById("runModeDuration");
const runModeStepsRadio = document.getElementById("runModeSteps");
const targetDurationInput = document.getElementById("targetDurationInput");
const targetStepsInput = document.getElementById("targetStepsInput");
const resultsTableBody = document.getElementById("resultsTableBody");

// Matter.js instance variables
let engine = null;
let render = null;
let runner = null;

let runCounter = 0; // To number rows in the results table

// Render loop variables
let renderLoopId = null;
let currentRenderInstance = null;

/** Starts the rendering loop */
function startRenderLoop(renderInstance) {
  if (renderLoopId) {
    stopRenderLoop(); // Stop previous loop if any
  }
  currentRenderInstance = renderInstance;
  function loop() {
    if (!currentRenderInstance) return; // Stop if instance is cleared
    Matter.Render.world(currentRenderInstance);
    renderLoopId = requestAnimationFrame(loop);
  }
  renderLoopId = requestAnimationFrame(loop);
  console.log("Render loop started.");
}

/** Stops the rendering loop */
function stopRenderLoop() {
  if (renderLoopId) {
    cancelAnimationFrame(renderLoopId);
    renderLoopId = null;
    currentRenderInstance = null; // Clear reference
    console.log("Render loop stopped.");
  }
}

/**
 * Populates the scenario dropdown menu from the imported scenarios.
 */
function populateScenarioDropdown() {
  if (!scenarioSelect) {
    console.error("Scenario select dropdown not found.");
    return;
  }
  scenarioSelect.innerHTML = ""; // Clear placeholder/previous options
  Object.keys(scenarios).forEach((key) => {
    const option = document.createElement("option");
    option.value = key;
    // Use description if available, otherwise use the key as text
    option.textContent = scenarios[key]?.description || key;
    scenarioSelect.appendChild(option);
  });
  console.log("Scenario dropdown populated.");
}

/**
 * Stops and cleans up any existing Matter.js simulation instances and removes the canvas.
 */
function cleanupPreviousSimulation() {
  stopRenderLoop(); // Ensure render loop is stopped
  console.log("Cleaning up previous simulation instance...");
  if (runner) {
    Matter.Runner.stop(runner);
    console.log("Stopped Matter Runner.");
    runner = null;
  }
  if (render) {
    Matter.Render.stop(render); // Should already be stopped by stopRenderLoop
    if (render.canvas) {
      render.canvas.remove();
      console.log("Removed Matter Render canvas.");
    }
    render = null;
  }
  if (engine) {
    Matter.Engine.clear(engine);
    console.log("Cleared Matter Engine.");
    engine = null;
  }
  if (renderContainer) {
    renderContainer.innerHTML = "";
  }
}

/**
 * Sets up the Matter.js world within the provided engine based on the scenario definition.
 * Creates boundary walls and populates with static/dynamic bodies defined in the scenario.
 * Uses a seeded PRNG for deterministic procedural generation.
 * @param {Matter.Engine} currentEngine - The Matter.js engine to set up.
 * @param {object} scenarioData - The scenario definition object.
 */
async function setupScenarioInEngine(currentEngine, scenarioData) {
  console.log(`Setting up scenario in engine: ${scenarioData.description}`);
  const {
    worldOptions,
    staticBodies = [],
    bodyGeneration,
    seed,
  } = scenarioData;
  let dynamicBodiesCreated = 0;
  let staticBodiesCreated = 0;

  // Initialize the seeded PRNG for this specific scenario run
  const scenarioSeed = seed || 1; // Default seed if not provided
  const random = mulberry32(scenarioSeed);
  console.log(`Using PRNG with seed: ${scenarioSeed}`);

  // Updated helper to use the specific PRNG instance
  const randomInRange = (min = 0, max = 1) => random() * (max - min) + min;

  // --- World Configuration ---
  currentEngine.world.gravity = {
    ...(worldOptions?.gravity || { x: 0, y: 1, scale: 0.001 }),
  };
  console.log("Configured world gravity:", currentEngine.world.gravity);

  // --- Static Bodies ---
  const width = worldOptions?.width || 800;
  const height = worldOptions?.height || 600;
  const wallThickness = 50;
  const wallOpts = {
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
      .map((bodyDef, index) => {
        const staticId =
          bodyDef.id || `static-main-${staticBodiesCreated + index}`;
        const label = bodyDef.options?.label || staticId;
        if (bodyDef.type === "rectangle") {
          return Matter.Bodies.rectangle(
            bodyDef.x,
            bodyDef.y,
            bodyDef.width,
            bodyDef.height,
            { isStatic: true, ...(bodyDef.options || {}), id: staticId, label }
          );
        } else if (bodyDef.type === "circle") {
          return Matter.Bodies.circle(bodyDef.x, bodyDef.y, bodyDef.radius, {
            isStatic: true,
            ...(bodyDef.options || {}),
            id: staticId,
            label,
          });
        }
        console.warn(
          `Unsupported static body type: ${bodyDef.type} in scenario ${scenarioData.description}`
        );
        return null;
      })
      .filter((body) => body !== null);

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
    const matterDynamicBodies = [];
    for (let i = 0; i < bodyGeneration.count; i++) {
      const id = `${bodyGeneration.idPrefix || "dynamic"}-main-${i}`;
      let body = null;

      // Generate deterministic color for this body
      const fillColor = generateDeterministicColor(random); // Use the scenario's PRNG

      const templateOpts = {
        ...(bodyGeneration.templateOptions || {}),
        id,
        label: id,
        render: {
          // Add render options with deterministic color
          fillStyle: fillColor,
          strokeStyle: "black",
          lineWidth: 1,
        },
      };
      const type = bodyGeneration.type;

      try {
        if (bodyGeneration.placement) {
          // Specific placement
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
          // Random positioning
          const p = bodyGeneration.positioning;
          const x = randomInRange(p.x?.min, p.x?.max); // Uses seeded randomInRange
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

/**
 * Handles changes to the run mode radio buttons.
 */
function handleRunModeChange() {
  if (runModeDurationRadio?.checked) {
    targetDurationInput.disabled = false;
    targetStepsInput.disabled = true;
  } else {
    targetDurationInput.disabled = true;
    targetStepsInput.disabled = false;
  }
}

/**
 * Appends a result row to the performance log table.
 * @param {object} resultData - Object containing metrics for the run.
 */
function logResultsToTable(resultData) {
  if (!resultsTableBody) return;
  runCounter++;

  const row = resultsTableBody.insertRow(); // Append row to the end

  // Define columns in order
  const columns = [
    runCounter,
    new Date().toLocaleTimeString(),
    resultData.scenarioDescription,
    resultData.seedUsed,
    resultData.runMode,
    resultData.targetValue,
    resultData.actualDurationMs.toFixed(2),
    resultData.actualSteps,
    resultData.stepsPerSecond.toFixed(2),
    resultData.avgStepTimeMs.toFixed(3),
  ];

  columns.forEach((text) => {
    const cell = row.insertCell();
    cell.textContent = text;
  });
}

/**
 * Runs the simulation loop at a fixed interval based on selected mode (duration or steps)
 * Calculates performance metrics based on actual Engine.update execution time.
 * Returns a Promise that resolves when the simulation finishes.
 * @param {Matter.Engine} engine - The configured Matter engine.
 * @param {object} scenarioData - The scenario definition.
 * @param {string} runMode - 'duration' or 'steps'
 * @param {number} targetValue - Target duration (ms) or target steps.
 * @param {number} seedUsed - The actual seed value used for this run.
 * @returns {Promise<object>} A promise that resolves with the performance results.
 */
async function runSimulationPerformance(
  engine,
  scenarioData,
  runMode,
  targetValue,
  seedUsed
) {
  console.log(
    `Starting performance run: Mode=${runMode}, Target=${targetValue}, Seed=${seedUsed}`
  );

  return new Promise((resolve, reject) => {
    const startTime = performance.now();
    let steps = 0;
    const deltaTime = scenarioData.simulationParameters.deltaTime || 1000 / 60;
    const intervalTime = deltaTime; // Run physics step at this interval
    let totalPhysicsTime = 0;
    let simulationRunning = true;

    const intervalId = setInterval(() => {
      if (!simulationRunning) return; // Exit if stopped externally or by error

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
        const stepsPerSecond = actualSteps / (actualDurationMs / 1000);
        const avgStepTimeMs = totalPhysicsTime / actualSteps;

        const results = {
          scenarioDescription: scenarioData.description,
          seedUsed: seedUsed,
          runMode: runMode === "duration" ? "Duration" : "Steps",
          targetValue:
            runMode === "duration"
              ? `${targetValue} ms`
              : `${targetValue} steps`,
          actualDurationMs: actualDurationMs,
          actualSteps: actualSteps,
          stepsPerSecond: stepsPerSecond || 0,
          avgStepTimeMs: avgStepTimeMs || 0,
        };
        console.log("Performance Run Results:", results);
        logResultsToTable(results);
        resolve(results); // Resolve the promise with results
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
        simulationRunning = false; // Stop on error
        clearInterval(intervalId);
        reject(error); // Reject the promise on error
      }
    }, intervalTime);
  });
}

/**
 * Main function called when the Run button is clicked.
 * Sets up the scenario, starts rendering, runs the performance test, stops rendering, and logs results.
 */
async function runScenarioAndMeasure() {
  const selectedKey = scenarioSelect.value;
  if (!selectedKey || !scenarios[selectedKey]) {
    console.warn("No valid scenario selected.");
    alert("Please select a valid scenario.");
    return;
  }
  const scenarioData = scenarios[selectedKey];

  const runMode = runModeDurationRadio.checked ? "duration" : "steps";
  const targetValue =
    runMode === "duration"
      ? parseInt(targetDurationInput.value)
      : parseInt(targetStepsInput.value);

  if (isNaN(targetValue) || targetValue <= 0) {
    alert(
      "Please enter a valid positive target value for the selected run mode."
    );
    return;
  }

  const userSeed = seedInput.value.trim();
  const seedUsed =
    userSeed !== "" ? parseInt(userSeed) : scenarioData.seed || 1;
  if (isNaN(seedUsed)) {
    alert(
      "Invalid seed value. Please enter a number or leave blank to use scenario default."
    );
    return;
  }

  console.log(
    `Preparing to run scenario: ${scenarioData.description}, Mode: ${runMode}, Target: ${targetValue}, Seed: ${seedUsed}`
  );
  cleanupPreviousSimulation(); // Clears old instances AND stops previous render loop

  try {
    runScenarioButton.disabled = true;
    runScenarioButton.textContent = "Running...";

    // Create engine & renderer
    engine = Matter.Engine.create();
    render = Matter.Render.create({
      element: renderContainer,
      engine: engine,
      options: {
        width: scenarioData.worldOptions?.width || 800,
        height: scenarioData.worldOptions?.height || 600,
        wireframes: false,
        showAngleIndicator: true,
      },
    });

    // Setup the initial state
    await setupScenarioInEngine(engine, { ...scenarioData, seed: seedUsed });
    console.log("Initial scenario state setup complete.");

    // Start rendering the simulation state
    startRenderLoop(render);
    console.log("Started render loop.");

    // Run the performance measurement loop (which now uses setInterval)
    // This returns a promise that resolves with the results when finished.
    console.log("Starting performance measurement loop...");
    const results = await runSimulationPerformance(
      engine,
      scenarioData,
      runMode,
      targetValue,
      seedUsed
    );
    console.log("Performance measurement loop finished.");
  } catch (error) {
    console.error("Error during scenario run and measurement:", error);
    alert(`An error occurred during performance run: ${error.message}`);
    // Results logging might have already occurred in runSimulationPerformance's catch,
    // but ensure UI reflects failure.
    resultsTableBody.insertAdjacentHTML(
      "beforeend",
      `<tr><td colspan="10" style="color:red;">Run ${++runCounter} failed: ${
        error.message
      }</td></tr>`
    );
  } finally {
    // Stop rendering AFTER the performance run completes or errors
    stopRenderLoop();

    // Re-enable button
    runScenarioButton.disabled = false;
    runScenarioButton.textContent = "Load & Run Scenario";

    // Keep engine and render for inspection? Or clean up?
    // cleanupPreviousSimulation(); // Uncomment to clear state immediately after run
  }
}

// --- Initialization ---
function initializeViewer() {
  console.log("Initializing Scenario Viewer...");
  // Check for all required elements
  if (
    !scenarioSelect ||
    !runScenarioButton ||
    !renderContainer ||
    !seedInput ||
    !runModeDurationRadio ||
    !runModeStepsRadio ||
    !targetDurationInput ||
    !targetStepsInput ||
    !resultsTableBody
  ) {
    console.error(
      "Scenario Viewer Error: Could not find all required DOM elements. Aborting."
    );
    if (renderContainer)
      renderContainer.innerHTML =
        "<p style='color:red;'>Initialization Error: Missing critical UI elements. Check console.</p>";
    return;
  }
  try {
    populateScenarioDropdown();
    // Setup listeners
    runModeDurationRadio.addEventListener("change", handleRunModeChange);
    runModeStepsRadio.addEventListener("change", handleRunModeChange);
    runScenarioButton.addEventListener("click", runScenarioAndMeasure); // Changed listener target

    handleRunModeChange(); // Initialize input disabled states
    console.log("Scenario Viewer Initialized. Ready to load scenarios.");
  } catch (error) {
    console.error("Error during viewer initialization:", error);
    renderContainer.innerHTML =
      "<p style='color:red;'>Error initializing viewer. Check console.</p>";
  }
}

// Run initialization when the script loads
initializeViewer();
