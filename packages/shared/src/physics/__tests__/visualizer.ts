import Matter from "matter-js";
import { PhysicsEngine } from "../PhysicsEngine";
// Import the scenariosToRun array directly
import { scenariosToRun, ScenarioEntry } from "../scenarios/index";
// Import runScenario helper
import { runScenario } from "../scenarios/scenario-runner.helper";
import type {
  IScenario,
  ScenarioAction,
  ScenarioBodyInitialState,
  // ScenarioEngineSettings, // Potentially unused if runScenario handles it all
  ISerializedPhysicsEngineState, // To type the output of runScenario
} from "../scenarios/types.ts";

console.log(
  "Visualizer script loaded. Matter:",
  Matter ? "loaded" : "not loaded"
);
// Check the array length
if (scenariosToRun.length === 0) {
  console.warn(
    "scenariosToRun is empty! Check scenarios/index.ts and individual scenario files."
  );
}

// DOM Elements
const scenarioSelect = document.getElementById(
  "scenario-select"
) as HTMLSelectElement;
const playPauseButton = document.getElementById(
  "play-pause-button"
) as HTMLButtonElement;
const resetButton = document.getElementById(
  "reset-button"
) as HTMLButtonElement;
const matterContainer = document.getElementById(
  "matter-container"
) as HTMLDivElement;
const debugLoggingCheckbox = document.getElementById(
  "debug-logging-checkbox"
) as HTMLInputElement;

// Matter.js specific
let engine: Matter.Engine;
let render: Matter.Render;
let runner: Matter.Runner;

// PhysicsEngine specific
let physicsEngine: PhysicsEngine;

// Visualizer state
let currentScenario: IScenario | null = null;
let currentScenarioDisplayName: string | null = null; // This will be the key from scenariosMap
let currentScenarioEntry: ScenarioEntry | null = null; // To store the full ScenarioEntry
let actionQueue: ScenarioAction[] = [];
let currentTick = 0;
let isPlaying = false;
const timeStep = 1000 / 60; // ms, for 60 FPS
let gameLoopIntervalId: number | undefined;

// No longer need processScenarioModules, scenariosMap is already processed.

function setupMatter() {
  if (engine) {
    Matter.World.clear(engine.world, false);
    Matter.Engine.clear(engine);
  }
  if (render && render.canvas) {
    Matter.Render.stop(render);
    render.canvas.remove();
    render.textures = {};
  }

  engine = Matter.Engine.create();
  engine.world.gravity.y = 0;
  engine.world.gravity.x = 0;
  engine.world.gravity.scale = 0;

  render = Matter.Render.create({
    element: matterContainer,
    engine: engine,
    options: {
      width: 800,
      height: 600,
      wireframes: true,
      showBounds: true,
      showAxes: true,
      background: "#eeeeee",
    },
  });

  // Explicitly set canvas size and log container rect
  if (render.canvas && render.options.width && render.options.height) {
    render.canvas.width = render.options.width;
    render.canvas.height = render.options.height;
    console.log(
      `[Visualizer] Canvas size set to: ${render.canvas.width}x${render.canvas.height}`
    );
  }
  if (matterContainer) {
    const rect = matterContainer.getBoundingClientRect();
    console.log(
      `[Visualizer] matterContainer Rect: w=${rect.width}, h=${rect.height}, x=${rect.left}, y=${rect.top}`
    );
  }

  // Temporarily set very wide, fixed bounds
  render.bounds.min.x = -2000;
  render.bounds.min.y = -2000;
  render.bounds.max.x = 2000;
  render.bounds.max.y = 2000;

  Matter.Render.run(render);
  runner = Matter.Runner.create();
  console.log(
    "Matter.js engine and renderer (re)initialized WITH SIMPLIFIED/WIDE VIEW."
  );
}

function populateScenarioSelector() {
  while (scenarioSelect.options.length > 1) {
    scenarioSelect.remove(1);
  }
  // Iterate over the scenariosToRun array
  scenariosToRun.forEach((entry, index) => {
    const option = document.createElement("option");
    option.value = entry.scenario.id; // Use scenario ID as value for robust lookup
    option.textContent = entry.scenario.name; // Use scenario name for display
    scenarioSelect.appendChild(option);
  });
  playPauseButton.textContent = "Play";
}

function clearSimulationState() {
  actionQueue = [];
  currentTick = 0;
  if (gameLoopIntervalId) {
    clearInterval(gameLoopIntervalId);
    gameLoopIntervalId = undefined;
  }
  isPlaying = false;
  currentScenario = null; // Clear currentScenario
  currentScenarioEntry = null; // Clear currentScenarioEntry
  playPauseButton.textContent = "Play";
}

function loadScenario(selectedId: string) {
  // selectedId will be scenario.id
  clearSimulationState();
  setupMatter(); // Keep Matter.Render setup

  // Find the selected scenario entry from the scenariosToRun array
  currentScenarioEntry =
    scenariosToRun.find((entry) => entry.scenario.id === selectedId) || null;

  if (!currentScenarioEntry) {
    console.error(
      `Scenario with ID ${selectedId} not found in scenariosToRun!`
    );
    currentScenario = null;
    return;
  }
  currentScenario = currentScenarioEntry.scenario; // Assign to currentScenario

  console.log(
    `Loading scenario: ${currentScenario.name} (ID: ${currentScenario.id})`
  );

  // No longer need to manually instantiate PhysicsEngine or create bodies here.
  // runScenario will handle the simulation state generation.
  // We just need to render the initial state (tick 0).

  if (debugLoggingCheckbox && currentScenario.engineSettings) {
    // This is tricky. runScenario uses the scenario's engineSettings directly.
    // To reflect the checkbox, we'd ideally pass an override to runScenario,
    // or runScenario's internal PhysicsEngine would need a global way to set logging.
    // For now, the scenario's own setting will primarily dictate logging within runScenario.
    // We can log a message here though.
    console.log(
      "Debug logging checkbox state:",
      debugLoggingCheckbox.checked,
      "Scenario wants logging:",
      currentScenario.engineSettings.enableInternalLogging
    );
  }

  // Render initial state (tick 0)
  if (currentScenario) {
    const initialState = runScenario(currentScenario, 0);
    renderState(initialState);
  }
}

// New function to render state from runScenario
function renderState(state: ISerializedPhysicsEngineState) {
  if (!engine || !render) {
    console.error("Matter engine or renderer not setup for renderState");
    return;
  }
  Matter.World.clear(engine.world, false);

  const bodiesToRender: Matter.Body[] = [];
  if (state.world && state.world.bodies) {
    state.world.bodies.forEach((bodyData) => {
      let visualBody: Matter.Body | undefined;
      const creationParams = (bodyData.plugin as any)?.creationParams as
        | Record<string, any>
        | undefined;

      // Base options from serialized data
      const options: Matter.IBodyDefinition = {
        angle: bodyData.angle,
        // position: bodyData.position, // Will be set by Matter.Bodies factory functions
        // velocity: bodyData.velocity, // Set after creation if needed
        // angularVelocity: bodyData.angularVelocity, // Set after creation if needed
        isStatic: bodyData.isStatic,
        isSensor: bodyData.isSensor,
        label: bodyData.label || `body-${bodyData.id}`,
        render: {
          visible: bodyData.render?.visible ?? true,
          fillStyle: bodyData.render?.fillStyle,
          strokeStyle: bodyData.render?.strokeStyle,
          lineWidth: bodyData.render?.lineWidth,
          // sprite: bodyData.render?.sprite // Sprite handling can be complex
        },
      };

      // More robust body creation using creationParams from the plugin if available
      if (creationParams?.type) {
        switch (creationParams.type) {
          case "box":
            if (
              typeof creationParams.width === "number" &&
              typeof creationParams.height === "number"
            ) {
              visualBody = Matter.Bodies.rectangle(
                bodyData.position.x,
                bodyData.position.y,
                creationParams.width,
                creationParams.height,
                options
              );
            } else {
              console.warn(
                `Box body ID ${bodyData.id} missing width/height in creationParams.`
              );
            }
            break;
          case "circle":
            if (typeof creationParams.radius === "number") {
              visualBody = Matter.Bodies.circle(
                bodyData.position.x,
                bodyData.position.y,
                creationParams.radius,
                options
              );
            } else {
              console.warn(
                `Circle body ID ${bodyData.id} missing radius in creationParams.`
              );
            }
            break;
          case "rocket": // Rockets are composite, this is a simplified representation of the main part
            // For rockets, creationParams might include definitions for multiple parts.
            // This example just creates a main rectangle. A true representation would need to parse parts.
            if (
              typeof creationParams.width === "number" &&
              typeof creationParams.height === "number"
            ) {
              options.label = options.label
                ? `${options.label} (Rocket)`
                : `rocket-${bodyData.id}`;
              visualBody = Matter.Bodies.rectangle(
                bodyData.position.x,
                bodyData.position.y,
                creationParams.width,
                creationParams.height,
                options
              );
              console.log("[Visualizer] Simplified rocket body rendered.");
            } else if (
              bodyData.parts &&
              bodyData.parts.length > 0 &&
              bodyData.vertices
            ) {
              // Fallback if rocket creationParams are not as expected, but has vertices for the main part
              options.label = options.label
                ? `${options.label} (Rocket-Vertices)`
                : `rocket-vertices-${bodyData.id}`;
              visualBody = Matter.Body.create({
                ...options,
                position: bodyData.position,
                vertices: bodyData.vertices,
              });
            } else {
              console.warn(
                `Rocket body ID ${bodyData.id} has insufficient creationParams or vertex data for simple rendering.`
              );
            }
            break;
          default:
            console.warn(
              `Unknown type '${creationParams.type}' in creationParams for body ID ${bodyData.id}.`
            );
        }
      }

      // Fallback to vertices if no visualBody created yet and vertices exist (e.g. for generic polygons)
      if (!visualBody && bodyData.vertices && bodyData.vertices.length > 0) {
        // Ensure vertices are in the correct Matter.js format (array of {x, y})
        // The snapshot seems to provide them correctly.
        visualBody = Matter.Body.create({
          ...options,
          position: bodyData.position,
          vertices: bodyData.vertices,
        });
      }

      // Final fallback if still no body
      if (!visualBody) {
        console.warn(
          `Could not determine geometry for body ID ${bodyData.id}. Rendering as placeholder circle.`
        );
        visualBody = Matter.Bodies.circle(
          bodyData.position.x,
          bodyData.position.y,
          5,
          {
            ...options,
            label: `${options.label} (Placeholder)`,
            render: { fillStyle: "magenta" },
          }
        );
      }

      if (visualBody) {
        // Apply velocity and angularVelocity after creation
        Matter.Body.setVelocity(
          visualBody,
          bodyData.velocity || { x: 0, y: 0 }
        );
        Matter.Body.setAngularVelocity(
          visualBody,
          bodyData.angularVelocity || 0
        );

        // Preserve original ID from snapshot if needed for debugging, though Matter assigns its own
        // (visualBody as any).originalSnapshotId = bodyData.id;
        bodiesToRender.push(visualBody);
      }
    });
  }
  Matter.World.add(engine.world, bodiesToRender);

  // Adjust camera to view the bodies
  if (render && bodiesToRender.length > 0) {
    const allRenderBodies = Matter.Composite.allBodies(engine.world);
    if (allRenderBodies.length > 0) {
      const bodiesBounds = Matter.Bounds.create(allRenderBodies);
      Matter.Render.lookAt(render, {
        min: { x: bodiesBounds.min.x, y: bodiesBounds.min.y },
        max: { x: bodiesBounds.max.x, y: bodiesBounds.max.y },
      });

      // Add some padding
      const padding = 0.2;
      const viewWidth = render.bounds.max.x - render.bounds.min.x;
      const viewHeight = render.bounds.max.y - render.bounds.min.y;
      render.bounds.min.x -= viewWidth * padding;
      render.bounds.max.x += viewWidth * padding;
      render.bounds.min.y -= viewHeight * padding;
      render.bounds.max.y += viewHeight * padding;
    }
  } else if (render) {
    // Default view if no bodies
    Matter.Render.lookAt(render, {
      min: { x: -render.options.width! / 2, y: -render.options.height! / 2 },
      max: { x: render.options.width! / 2, y: render.options.height! / 2 },
    });
  }
}

function gameLoop() {
  if (!isPlaying || !currentScenario) {
    return;
  }

  currentTick++;
  // console.log(`Tick: ${currentTick}`);

  const currentState = runScenario(currentScenario, currentTick);
  renderState(currentState);

  if (currentTick >= currentScenario.simulationSteps) {
    pauseSimulation();
    currentTick = currentScenario.simulationSteps; // Ensure it doesn't overshoot
    console.log("Scenario reached its simulationSteps.");
  }
}

function playSimulation() {
  if (!currentScenarioEntry) {
    // Check currentScenarioEntry instead of displayName
    alert("Please select and load a scenario first.");
    return;
  }
  // currentScenario is already set if currentScenarioEntry is set
  // if (!currentScenario) {
  //   loadScenario(currentScenarioEntry.scenario.id); // load by ID
  //   if (!currentScenario) return;
  // }

  if (isPlaying) return;
  isPlaying = true;
  playPauseButton.textContent = "Pause";
  if (gameLoopIntervalId) clearInterval(gameLoopIntervalId);
  gameLoopIntervalId = window.setInterval(gameLoop, timeStep);
  console.log("Simulation started.");
}

function pauseSimulation() {
  if (!isPlaying) return;
  isPlaying = false;
  playPauseButton.textContent = "Play";
  if (gameLoopIntervalId) {
    clearInterval(gameLoopIntervalId);
    gameLoopIntervalId = undefined;
  }
  console.log("Simulation paused.");
}

scenarioSelect.addEventListener("change", (event) => {
  const displayName = (event.target as HTMLSelectElement).value;
  if (displayName) {
    pauseSimulation();
    loadScenario(displayName);
  }
});

playPauseButton.addEventListener("click", () => {
  if (isPlaying) {
    pauseSimulation();
  } else {
    playSimulation();
  }
});

resetButton.addEventListener("click", () => {
  if (currentScenarioDisplayName) {
    pauseSimulation();
    loadScenario(currentScenarioDisplayName);
    console.log(`Scenario ${currentScenarioDisplayName} reset.`);
  } else if (scenarioSelect.value) {
    pauseSimulation();
    loadScenario(scenarioSelect.value);
    console.log(`Scenario ${scenarioSelect.value} loaded and reset.`);
  }
});

debugLoggingCheckbox.addEventListener("change", () => {
  // The direct call to physicsEngine.setInternalLogging may not be effective
  // as the simulation is driven by runScenario, which creates its own engine instance.
  // For now, this checkbox will primarily affect logging within the visualizer.ts scope if any.
  console.log(
    `Debug logging checkbox changed to: ${debugLoggingCheckbox.checked}. ` +
      `Note: This primarily affects visualizer-specific logs, not deep engine logs from runScenario unless scenario is reloaded with new settings.`
  );
  // To make it affect runScenario, one might reload the scenario or pass params to runScenario.
  // Example: if (currentScenarioEntry) { loadScenario(currentScenarioEntry.scenario.id); }
});

document.addEventListener("DOMContentLoaded", () => {
  // processScenarioModules(); // This is no longer needed, scenariosMap is directly imported
  if (scenariosToRun.length > 0) {
    // Check array length
    populateScenarioSelector();
  } else {
    console.error(
      "No scenarios were loaded. Check 'packages/shared/src/physics/scenarios/index.ts' and ensure it populates scenariosToRun correctly."
    );
    // Optionally, display a message to the user in the UI
    const scenarioSelectLabel = document.querySelector(
      "label[for='scenario-select']"
    );
    if (scenarioSelectLabel) {
      scenarioSelectLabel.textContent = "Error: No scenarios loaded.";
    }
  }
  console.log("Visualizer initialized. Select a scenario to begin.");
});
