import Matter from "matter-js";
import { scenarios } from "../../scenarios/scenario-definitions";
import {
  mulberry32,
  setupScenarioInEngine as utilSetupScenarioInEngine,
  runSimulationPerformance as utilRunSimulationPerformance,
} from "../../src/scenario-runner-utils";

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
  console.log(
    `Calling UTIL setupScenarioInEngine for: ${scenarioData.description} with seed ${scenarioData.seed}`
  );
  // The imported utilSetupScenarioInEngine takes (engine, scenarioData)
  // scenarioData for the util should contain the seed property directly.
  const setupResults = await utilSetupScenarioInEngine(
    currentEngine,
    scenarioData
  );

  console.log("Util setup complete. Applying viewer-specific rendering...");

  // Now, apply deterministic colors. We need our own PRNG instance for this, seeded identically.
  const scenarioSeed = scenarioData.seed; // The seed is already in scenarioData from the caller
  const localRandomForColors = mulberry32(scenarioSeed); // Uses IMPORTED mulberry32

  const bodyGeneration = scenarioData.bodyGeneration;
  let coloredBodyCount = 0;

  if (bodyGeneration && bodyGeneration.count > 0) {
    const dynamicBodyPrefix = bodyGeneration.idPrefix || "dynamic";
    // Iterate all bodies to find the ones created by the util based on naming convention
    // The util sets both `id` and `label` for dynamic bodies.
    Matter.Composite.allBodies(currentEngine.world).forEach((body) => {
      if (
        body.label &&
        body.label.startsWith(`${dynamicBodyPrefix}-main-`) &&
        !body.isStatic
      ) {
        const fillColor = generateDeterministicColor(localRandomForColors); // generateDeterministicColor remains local
        Matter.Body.set(body, "render", {
          ...(body.render || {}), // Preserve existing render options if any
          fillStyle: fillColor,
          strokeStyle: "black", // Keep consistent styling
          lineWidth: 1,
        });
        coloredBodyCount++;
      }
    });
    console.log(
      `Applied deterministic colors to ${coloredBodyCount} dynamic bodies.`
    );
  }
  // The original function returned counts. The util function also returns counts.
  // The caller of this viewer's setupScenarioInEngine doesn't actually use the return value.
  // So we can just return the util's results for consistency.
  return setupResults;
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
    const scenarioDataWithSeed = { ...scenarioData, seed: seedUsed };
    await setupScenarioInEngine(engine, scenarioDataWithSeed);
    console.log("Initial scenario state setup complete.");

    // Start rendering the simulation state
    startRenderLoop(render);
    console.log("Started render loop.");

    // Run the performance measurement loop (which now uses setInterval via the utility)
    // This returns a promise that resolves with the results when finished.
    console.log("Starting performance measurement loop...");
    const results = await utilRunSimulationPerformance(
      engine,
      scenarioDataWithSeed, // Pass scenarioData that includes .seed and .simulationParameters.deltaTime
      runMode,
      targetValue,
      seedUsed // utilRunSimulationPerformance also takes seedUsed for reporting
    );
    logResultsToTable(results); // Log results after the promise resolves
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
