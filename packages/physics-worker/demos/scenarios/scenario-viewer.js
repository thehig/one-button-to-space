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

// Matter.js instance variables
let engine = null;
let render = null;
let runner = null;

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
  console.log("Cleaning up previous simulation instance...");
  if (runner) {
    Matter.Runner.stop(runner);
    console.log("Stopped Matter Runner.");
    runner = null;
  }
  if (render) {
    Matter.Render.stop(render);
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
  // Clear the container explicitly
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
 * Cleans up the previous simulation and starts a new one based on the selected scenario data.
 * @param {object} scenarioData - The data object for the scenario to run.
 */
function runScenario(scenarioData) {
  if (!scenarioData) {
    console.warn("runScenario called with invalid scenario data.");
    return;
  }
  console.log(`Running scenario: ${scenarioData.description}`);
  cleanupPreviousSimulation();

  // --- Create Matter.js instances ---
  engine = Matter.Engine.create();
  render = Matter.Render.create({
    element: renderContainer,
    engine: engine,
    options: {
      width: scenarioData.worldOptions?.width || 800,
      height: scenarioData.worldOptions?.height || 600,
      wireframes: false, // Use solid colors
      showAngleIndicator: true,
      // Add other rendering options if desired
    },
  });
  runner = Matter.Runner.create();

  // --- Setup and Run ---
  // Populate the engine based on the scenario definition
  // Note: setupScenarioInEngine is async but we don't necessarily need to wait
  // for it here if the setup is fast enough relative to starting the runner.
  // If setup involved complex async ops, we might await it.
  setupScenarioInEngine(engine, scenarioData);

  console.log("Starting Matter Runner and Render...");
  Matter.Runner.run(runner, engine);
  Matter.Render.run(render);
}

// --- Initialization ---
function initializeViewer() {
  console.log("Initializing Scenario Viewer...");
  if (!scenarioSelect || !runScenarioButton || !renderContainer) {
    console.error(
      "Scenario Viewer Error: Could not find required DOM elements. Aborting."
    );
    return;
  }
  try {
    populateScenarioDropdown();
    runScenarioButton.addEventListener("click", () => {
      const selectedKey = scenarioSelect.value;
      if (selectedKey && scenarios[selectedKey]) {
        runScenario(scenarios[selectedKey]);
      } else {
        console.warn("No valid scenario selected or scenario data missing.");
        cleanupPreviousSimulation(); // Clear display if selection invalid
      }
    });
    console.log("Scenario Viewer Initialized. Ready to load scenarios.");

    // Optional: Auto-run the first scenario on load
    // const firstScenarioKey = Object.keys(scenarios)[0];
    // if (firstScenarioKey) {
    //     runScenario(scenarios[firstScenarioKey]);
    // }
  } catch (error) {
    console.error("Error during viewer initialization:", error);
    renderContainer.innerHTML =
      "<p style='color:red;'>Error initializing viewer. Check console.</p>";
  }
}

// Run initialization when the script loads
initializeViewer();
