import Matter from "matter-js";
import { PhysicsEngine } from "../physics/PhysicsEngine";
// Import the scenariosToRun array directly
import { scenariosToRun, ScenarioEntry } from "../physics/scenarios/index";
// Import runScenario helper
// import { runScenario } from "../scenarios/scenario-runner.helper"; // No longer directly used in gameLoop
import type {
  IScenario,
  ScenarioAction,
  // ScenarioBodyInitialState, // Not directly used here
  ISerializedPhysicsEngineState,
  ISerializedMatterBody, // Added for clarity, though types.ts is the source of truth
  ICelestialBodyData, // Added for clarity
} from "../physics/scenarios/types.ts";
import { updateSimulationInfoView } from "./ui/simulationInfoView";
import { updateDynamicBodiesView } from "./ui/dynamicBodiesView";
import { updateCelestialBodiesView } from "./ui/celestialBodiesView";

console.log(
  "Visualizer script loaded. Matter:",
  Matter ? "loaded" : "not loaded"
);
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
const resetCameraButton = document.getElementById(
  "reset-camera-button"
) as HTMLButtonElement; // New button
const matterContainer = document.getElementById(
  "matter-container"
) as HTMLDivElement;
const debugLoggingCheckbox = document.getElementById(
  "debug-logging-checkbox"
) as HTMLInputElement;
const simulationInfoContentDiv = document.getElementById(
  "simulation-info-content"
) as HTMLDivElement;
const dynamicBodiesContentDiv = document.getElementById(
  "dynamic-bodies-content"
) as HTMLDivElement;
const celestialBodiesContentDiv = document.getElementById(
  "celestial-bodies-content"
) as HTMLDivElement;

// DOM Elements for Render/Control Playground
const renderCanvasDimsDisplay = document.getElementById(
  "render-canvas-dims"
) as HTMLSpanElement;
const renderViewBoundsDisplay = document.getElementById(
  "render-view-bounds"
) as HTMLSpanElement;
const renderZoomLevelDisplay = document.getElementById(
  "render-zoom-level"
) as HTMLSpanElement;
const renderCurrentTickDisplay = document.getElementById(
  "render-current-tick"
) as HTMLSpanElement;
const scenarioTotalStepsDisplay = document.getElementById(
  "scenario-total-steps"
) as HTMLSpanElement;
const stepOnceButton = document.getElementById(
  "step-once-button"
) as HTMLButtonElement;
const stepNTicksInput = document.getElementById(
  "step-n-ticks-input"
) as HTMLInputElement;
const stepNButton = document.getElementById(
  "step-n-button"
) as HTMLButtonElement;
const stepMSecondsInput = document.getElementById(
  "step-m-seconds-input"
) as HTMLInputElement;
const stepMButton = document.getElementById(
  "step-m-button"
) as HTMLButtonElement;
const zoomSlider = document.getElementById("zoom-slider") as HTMLInputElement;

// Matter.js specific for visualization
let engine: Matter.Engine; // The visual Matter.js engine
let render: Matter.Render; // The visual Matter.js renderer
let runner: Matter.Runner; // The visual Matter.js runner (optional if we drive steps)

// PhysicsEngine specific for simulation logic
let physicsEngine: PhysicsEngine | undefined; // Our persistent physics engine instance

// Visualizer state
let currentScenario: IScenario | null = null;
let currentScenarioEntry: ScenarioEntry | null = null;
let createdBodiesMap: Map<string, Matter.Body> = new Map(); // Maps scenario body ID to our PhysicsEngine's Matter.Body
let currentTick = 0;
let isPlaying = false;
const timeStep = 1000 / 60; // ms, for 60 FPS
let gameLoopIntervalId: number | undefined;

function setupMatter() {
  if (!engine) {
    engine = Matter.Engine.create();
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;
    engine.world.gravity.scale = 0;
  }

  if (!render) {
    render = Matter.Render.create({
      element: matterContainer,
      engine: engine,
      options: {
        width: 800,
        height: 600,
        wireframes: true, // Good for debugging
        showBounds: true,
        showAxes: true,
        wireframeBackground: "#003366", // Lighter blueprint blue
      },
    });

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
    Matter.Render.run(render);
    runner = Matter.Runner.create(); // Optional: Matter.js can run its own loop
    console.log("Matter.js visual engine and renderer initialized.");
  } else {
    Matter.World.clear(engine.world, false);
    Matter.Composite.clear(engine.world, false, true);
    Matter.Engine.clear(engine); // Clear the visual engine
    engine.world.gravity.y = 0;
    engine.world.gravity.x = 0;
    engine.world.gravity.scale = 0;
    console.log("Matter.js visual world cleared and reset for new scenario.");
  }

  // Default wide view, will be overridden by lookAt in renderState
  render.bounds.min.x = -1000;
  render.bounds.min.y = -1000;
  render.bounds.max.x = 1000;
  render.bounds.max.y = 1000;
  Matter.Render.lookAt(render, {
    min: { x: -400, y: -300 },
    max: { x: 400, y: 300 },
  });

  // Event listener for drawing the grid
  // Cast to any to handle potential type discrepancies for render.events
  const renderAsAny = render as any;
  // Ensure renderAsAny.events and renderAsAny.events.afterRender array exists before trying to remove a listener.
  if (renderAsAny && renderAsAny.events && renderAsAny.events.afterRender) {
    Matter.Events.off(render, "afterRender", drawGrid); // Remove previous listener if any
  }
  Matter.Events.on(render, "afterRender", drawGrid);
}

function populateScenarioSelector() {
  while (scenarioSelect.options.length > 1) {
    scenarioSelect.remove(1);
  }
  scenariosToRun.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.scenario.id;
    option.textContent = entry.scenario.name;
    scenarioSelect.appendChild(option);
  });
  playPauseButton.textContent = "Play";
}

function clearSimulationState() {
  currentTick = 0;
  if (gameLoopIntervalId) {
    clearInterval(gameLoopIntervalId);
    gameLoopIntervalId = undefined;
  }
  isPlaying = false;
  currentScenario = null;
  currentScenarioEntry = null;
  createdBodiesMap.clear();
  physicsEngine = undefined; // Dispose of the old physics engine instance
  playPauseButton.textContent = "Play";
}

function loadScenario(selectedId: string) {
  clearSimulationState();
  setupMatter(); // Prepare the Matter.js visual environment

  currentScenarioEntry =
    scenariosToRun.find((entry) => entry.scenario.id === selectedId) || null;

  if (!currentScenarioEntry || !currentScenarioEntry.scenario) {
    console.error(`Scenario with ID ${selectedId} not found or invalid!`);
    return;
  }
  currentScenario = currentScenarioEntry.scenario;

  console.log(
    `[Visualizer] Loading scenario: ${currentScenario.name} (ID: ${currentScenario.id})`
  );

  const engineSettings = currentScenario.engineSettings;
  const effectiveDebugLogging = debugLoggingCheckbox.checked;

  physicsEngine = new PhysicsEngine( // Create our persistent engine
    engineSettings?.fixedTimeStepMs,
    engineSettings?.customG === null ? undefined : engineSettings?.customG
  );
  physicsEngine.setInternalLogging(effectiveDebugLogging);
  console.log(
    `[Visualizer] PhysicsEngine internal logging set to: ${effectiveDebugLogging}`
  );

  physicsEngine.init(currentScenario.celestialBodies);
  createdBodiesMap.clear();

  for (const bodyDef of currentScenario.initialBodies) {
    let body: Matter.Body; // This will be the body within our physicsEngine
    const optionsForEngine: Matter.IBodyDefinition = {
      ...(bodyDef.options || {}),
      label: bodyDef.label || bodyDef.id,
    };

    switch (bodyDef.type) {
      case "box":
        body = physicsEngine.createBox(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.width!,
          bodyDef.height!,
          optionsForEngine
        );
        break;
      case "circle":
        body = physicsEngine.createCircle(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.radius!,
          optionsForEngine
        );
        break;
      case "rocket":
        body = physicsEngine.createRocketBody(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          optionsForEngine
        );
        break;
      default:
        console.error(
          `[Visualizer] Unsupported body type in scenario: ${bodyDef.type}`
        );
        continue;
    }

    if (bodyDef.initialVelocity) {
      physicsEngine.setBodyVelocity(body, bodyDef.initialVelocity);
    }
    if (bodyDef.initialAngle !== undefined) {
      Matter.Body.setAngle(body, bodyDef.initialAngle); // Directly use Matter.Body for angle on our engine's body
    }
    if (bodyDef.initialAngularVelocity !== undefined) {
      Matter.Body.setAngularVelocity(body, bodyDef.initialAngularVelocity); // Same for angular velocity
    }
    createdBodiesMap.set(bodyDef.id, body);
  }

  if (physicsEngine) {
    const initialState = physicsEngine.toJSON();
    console.log(
      "[Visualizer] Initial state from persistent physicsEngine (tick 0):",
      JSON.stringify(initialState).substring(0, 500) + "..." // Log snippet
    );
    renderState(initialState);
    updateEngineStateVisualization(initialState);
    updateRenderControlPlayground(); // Ensure this is still called
    console.log("[Visualizer] Scenario loaded with persistent PhysicsEngine.");
  } else {
    console.error(
      "[Visualizer] Failed to initialize persistent PhysicsEngine in loadScenario."
    );
  }
}

function renderState(state: ISerializedPhysicsEngineState) {
  if (!engine || !render) {
    console.error(
      "[Visualizer] Matter.js visual engine or renderer not setup for renderState"
    );
    return;
  }
  Matter.World.clear(engine.world, false); // Clear visual world first

  const bodiesToRender: Matter.Body[] = [];
  if (state.world && state.world.bodies) {
    state.world.bodies.forEach((bodyData) => {
      let visualBody: Matter.Body | undefined;
      const creationParams = (bodyData.plugin as any)?.creationParams as
        | Record<string, any>
        | undefined;

      const options: Matter.IBodyDefinition = {
        angle: bodyData.angle ?? 0, // Handle potential null from bad type def
        isStatic: bodyData.isStatic,
        isSensor: bodyData.isSensor,
        label: bodyData.label || `body-${bodyData.id}`,
        render: {
          visible: bodyData.render?.visible ?? true,
          fillStyle: bodyData.render?.fillStyle,
          strokeStyle: bodyData.render?.strokeStyle,
          lineWidth: bodyData.render?.lineWidth,
        },
      };

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
                creationParams.height
              );
              if (visualBody) {
                Matter.Body.setAngle(visualBody, options.angle ?? 0);
                visualBody.label = options.label || `body-${bodyData.id}`;
                if (options.isStatic) Matter.Body.setStatic(visualBody, true);
                // Explicitly set render properties that might be in options, but carefully
                if (options.render) {
                  visualBody.render.visible = options.render.visible ?? true;
                  if (options.render.fillStyle)
                    visualBody.render.fillStyle = options.render.fillStyle;
                  if (options.render.strokeStyle)
                    visualBody.render.strokeStyle = options.render.strokeStyle;
                  if (options.render.lineWidth !== undefined)
                    visualBody.render.lineWidth = options.render.lineWidth;
                }
              }
            } else {
              console.warn(
                `[Visualizer RenderState] Box body ID ${bodyData.id} missing width/height in creationParams.`
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
                `[Visualizer RenderState] Circle body ID ${bodyData.id} missing radius in creationParams.`
              );
            }
            break;
          case "rocket":
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
            } else if (
              bodyData.parts &&
              bodyData.parts.length > 0 &&
              (bodyData as any).vertices
            ) {
              options.label = options.label
                ? `${options.label} (Rocket-Vertices)`
                : `rocket-vertices-${bodyData.id}`;
              visualBody = Matter.Body.create({
                ...options,
                position: bodyData.position,
                vertices: (bodyData as any).vertices,
              });
            } else {
              console.warn(
                `[Visualizer RenderState] Rocket body ID ${bodyData.id} has insufficient creationParams or vertex data.`
              );
            }
            break;
          default:
            console.warn(
              `[Visualizer RenderState] Unknown type '${creationParams.type}' for body ID ${bodyData.id}.`
            );
        }
      }

      if (visualBody && debugLoggingCheckbox.checked) {
        Matter.Body.update(visualBody, 0, 1, 1); // Force an update before testing bounds
        const immediateBoundsTest = Matter.Bounds.create([visualBody]);
        console.log(
          `[Visualizer RenderState Tick ${currentTick}] IMMEDIATE TEST on visualBody ID ${visualBody.id} after creation & update: Matter.Bounds.create results: min=(${immediateBoundsTest.min.x},${immediateBoundsTest.min.y}), max=(${immediateBoundsTest.max.x},${immediateBoundsTest.max.y})`
        );
        console.log(
          `[Visualizer RenderState Tick ${currentTick}] IMMEDIATE TEST on visualBody ID ${visualBody.id} after creation & update: visualBody.bounds directly: min=(${visualBody.bounds.min.x},${visualBody.bounds.min.y}), max=(${visualBody.bounds.max.x},${visualBody.bounds.max.y})`
        );
      }

      if (
        !visualBody &&
        (bodyData as any).vertices &&
        (bodyData as any).vertices.length > 0
      ) {
        visualBody = Matter.Body.create({
          ...options,
          position: bodyData.position,
          vertices: (bodyData as any).vertices,
        });
      }

      if (!visualBody) {
        console.warn(
          `[Visualizer RenderState] Could not determine geometry for body ID ${bodyData.id}. Placeholder circle.`
        );
        visualBody = Matter.Bodies.circle(
          bodyData.position.x,
          bodyData.position.y,
          5, // Small placeholder
          {
            ...options,
            label: `${options.label || "unknown"} (Placeholder)`,
            render: { ...options.render, fillStyle: "magenta" },
          }
        );
      }

      if (visualBody) {
        Matter.Body.setVelocity(
          // Apply current velocity from state
          visualBody,
          bodyData.velocity || { x: 0, y: 0 }
        );
        Matter.Body.setAngularVelocity(
          // Apply current angular velocity
          visualBody,
          bodyData.angularVelocity || 0
        );
        bodiesToRender.push(visualBody);
        if (debugLoggingCheckbox.checked && currentTick < 2) {
          // Log only for first couple of ticks to avoid spam
          console.log(
            `[Visualizer RenderState Tick ${currentTick}] Preparing visual body: `,
            JSON.parse(
              JSON.stringify({
                // Deep clone for logging
                id: visualBody.id,
                label: visualBody.label,
                scenarioBodyId: bodyData.id,
                position: visualBody.position,
                angle: visualBody.angle,
                velocity: visualBody.velocity,
                angularVelocity: visualBody.angularVelocity,
                isStatic: visualBody.isStatic,
                renderOptions: visualBody.render,
                bounds: visualBody.bounds,
                verticesCount: visualBody.vertices?.length,
                partsCount: visualBody.parts?.length,
                creationParamsUsed: creationParams,
              })
            )
          );
        }
      }
    });
  }

  if (bodiesToRender.length > 0) {
    Matter.World.add(engine.world, bodiesToRender); // Add to the visual Matter.js engine
  }

  // CAMERA LOGIC REMOVED FROM renderState
  // The camera will be positioned by resetViewToFitAll or other dedicated camera controls.
}

function _performSingleSimulationStep() {
  if (!currentScenario || !physicsEngine) {
    // This check is important here as well, in case called directly when state is not ready
    console.warn(
      "[Visualizer _performSingleSimulationStep] Scenario or PhysicsEngine not ready."
    );
    return false; // Indicate failure or inability to step
  }

  // Process actions for the current tick BEFORE stepping the engine
  if (currentScenario.actions) {
    for (const action of currentScenario.actions) {
      if (action.step === currentTick) {
        const targetBody = createdBodiesMap.get(action.targetBodyId);
        if (!targetBody) {
          console.warn(
            `[Visualizer GameLoop Tick ${currentTick}] Action target body ID ${action.targetBodyId} not found for applying action.`
          );
          continue;
        }
        switch (action.actionType) {
          case "applyForce":
            if (action.force) {
              physicsEngine.applyForceToBody(
                targetBody,
                action.applicationPoint || targetBody.position,
                action.force
              );
              if (debugLoggingCheckbox.checked) {
                console.log(
                  `[Visualizer GameLoop Tick ${currentTick}] Applied force to ${action.targetBodyId}:`,
                  JSON.stringify(action.force)
                );
              }
            } else {
              console.warn(
                `[Visualizer GameLoop Tick ${currentTick}] applyForce missing force for ${action.targetBodyId}.`
              );
            }
            break;
          default:
            console.warn(
              `[Visualizer GameLoop Tick ${currentTick}] Unsupported action type: ${action.actionType}.`
            );
        }
      }
    }
  }

  physicsEngine.fixedStep(timeStep);
  currentTick++;

  const currentState = physicsEngine.toJSON();
  renderState(currentState);
  updateEngineStateVisualization(currentState);
  updateRenderControlPlayground();

  return true; // Indicate step was successful and simulation can continue
}

function gameLoop() {
  if (!isPlaying || !currentScenario || !physicsEngine) {
    return;
  }
  _performSingleSimulationStep();

  // For continuous play, check if the scenario's defined step limit has been reached.
  if (currentScenario && currentTick >= currentScenario.simulationSteps) {
    if (debugLoggingCheckbox.checked) {
      console.log(
        `[GameLoop] Auto-pausing: currentTick (${currentTick}) reached/exceeded scenario simulationSteps (${currentScenario.simulationSteps}).`
      );
    }
    pauseSimulation();
  }
}

function playSimulation() {
  if (!currentScenarioEntry) {
    alert("Please select and load a scenario first.");
    return;
  }
  if (isPlaying) return;
  isPlaying = true;
  playPauseButton.textContent = "Pause";
  if (gameLoopIntervalId) clearInterval(gameLoopIntervalId);
  // Ensure physicsEngine is ready before starting loop
  if (!physicsEngine) {
    console.error(
      "[Visualizer] Cannot play simulation, PhysicsEngine not initialized."
    );
    loadScenario(currentScenarioEntry.scenario.id); // Attempt to reload
    if (!physicsEngine) {
      // Still not ready
      isPlaying = false;
      playPauseButton.textContent = "Play";
      return;
    }
  }
  gameLoopIntervalId = window.setInterval(gameLoop, timeStep);
  console.log("[Visualizer] Simulation started.");
}

function pauseSimulation() {
  if (!isPlaying) return;
  isPlaying = false;
  playPauseButton.textContent = "Play";
  if (gameLoopIntervalId) {
    clearInterval(gameLoopIntervalId);
    gameLoopIntervalId = undefined;
  }
  console.log("[Visualizer] Simulation paused.");
}

scenarioSelect.addEventListener("change", (event) => {
  const selectedId = (event.target as HTMLSelectElement).value;
  if (selectedId) {
    pauseSimulation();
    loadScenario(selectedId);
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
  const scenarioToLoad =
    currentScenarioEntry?.scenario.id || scenarioSelect.value;
  if (scenarioToLoad) {
    pauseSimulation();
    loadScenario(scenarioToLoad);
    console.log(`[Visualizer] Scenario ${scenarioToLoad} reloaded/reset.`);
  } else {
    console.warn("[Visualizer] Reset: No scenario selected or loaded.");
  }
});

debugLoggingCheckbox.addEventListener("change", () => {
  console.log(
    `[Visualizer] Debug logging checkbox changed to: ${debugLoggingCheckbox.checked}.`
  );
  if (physicsEngine) {
    // If an engine exists, update its logging
    physicsEngine.setInternalLogging(debugLoggingCheckbox.checked);
    console.log(
      `[Visualizer] Persistent PhysicsEngine internal logging updated to: ${debugLoggingCheckbox.checked}. Reload scenario for changes to initial logs if needed.`
    );
  }
});

// Simulation Control Button Listeners
stepOnceButton.addEventListener("click", () => {
  if (!currentScenario || !physicsEngine) {
    alert("Please load a scenario first.");
    return;
  }
  pauseSimulation(); // Ensure we are paused before single stepping
  _performSingleSimulationStep(); // Execute one simulation step
});

stepNButton.addEventListener("click", () => {
  if (!currentScenario || !physicsEngine) {
    alert("Please load a scenario first.");
    return;
  }
  pauseSimulation();
  const numTicks = parseInt(stepNTicksInput.value, 10);
  if (isNaN(numTicks) || numTicks <= 0) {
    alert("Please enter a valid positive number of ticks.");
    return;
  }
  for (let i = 0; i < numTicks; i++) {
    if (!_performSingleSimulationStep()) break; // Stop if simulation ended or failed to step
  }
});

stepMButton.addEventListener("click", () => {
  if (!currentScenario || !physicsEngine) {
    alert("Please load a scenario first.");
    return;
  }
  pauseSimulation();
  const numSeconds = parseFloat(stepMSecondsInput.value);
  if (isNaN(numSeconds) || numSeconds <= 0) {
    alert("Please enter a valid positive number of seconds.");
    return;
  }
  const numTicksToRun = Math.round(numSeconds * (1000 / timeStep));
  for (let i = 0; i < numTicksToRun; i++) {
    if (!_performSingleSimulationStep()) break; // Stop if simulation ended or failed to step
  }
});

document.addEventListener("DOMContentLoaded", () => {
  if (scenariosToRun.length > 0) {
    populateScenarioSelector();
  } else {
    console.error(
      "No scenarios loaded. Check 'packages/shared/src/physics/scenarios/index.ts'."
    );
    const scenarioSelectLabel = document.querySelector(
      "label[for='scenario-select']"
    );
    if (scenarioSelectLabel) {
      scenarioSelectLabel.textContent = "Error: No scenarios loaded.";
    }
  }
  console.log(
    "[Visualizer] Visualizer initialized. Select a scenario to begin."
  );
});

function drawGrid() {
  if (!render || !render.context) return;

  const context = render.context;
  const bounds = render.bounds;
  const canvas = render.canvas;
  const gridSize = 50; // Grid lines every 50 world units

  const viewWidthWorld = bounds.max.x - bounds.min.x;
  const viewHeightWorld = bounds.max.y - bounds.min.y;

  if (viewWidthWorld <= 0 || viewHeightWorld <= 0) return; // Avoid division by zero or invalid bounds

  const scaleX = canvas.width / viewWidthWorld;
  const scaleY = canvas.height / viewHeightWorld;
  // For lineWidth, we'll use an average scale or pick one, e.g., scaleX.
  // This ensures lines have a consistent screen thickness.
  const desiredScreenLineWidth = 2;
  const worldLineWidth = desiredScreenLineWidth / scaleX;

  context.save();

  // Apply transform to draw in world coordinates
  // 1. Scale to match world unit to pixel ratio
  // 2. Translate so (bounds.min.x, bounds.min.y) in world aligns with (0,0) in canvas before this transform
  context.scale(scaleX, scaleY);
  context.translate(-bounds.min.x, -bounds.min.y);

  context.beginPath();
  context.strokeStyle = "rgba(255, 255, 255, 0.25)";
  context.lineWidth = worldLineWidth; // Use calculated world-equivalent line width

  // Vertical lines
  const startX = Math.floor(bounds.min.x / gridSize) * gridSize;
  const endX = Math.ceil(bounds.max.x / gridSize) * gridSize;
  for (let x = startX; x <= endX; x += gridSize) {
    context.moveTo(x, bounds.min.y);
    context.lineTo(x, bounds.max.y);
  }

  // Horizontal lines
  const startY = Math.floor(bounds.min.y / gridSize) * gridSize;
  const endY = Math.ceil(bounds.max.y / gridSize) * gridSize;
  for (let y = startY; y <= endY; y += gridSize) {
    context.moveTo(bounds.min.x, y);
    context.lineTo(bounds.max.x, y);
  }

  context.stroke();
  context.restore();
}

function updateEngineStateVisualization(
  state: ISerializedPhysicsEngineState | undefined
) {
  if (simulationInfoContentDiv) {
    updateSimulationInfoView(simulationInfoContentDiv, state);
  }
  if (dynamicBodiesContentDiv) {
    updateDynamicBodiesView(dynamicBodiesContentDiv, state?.world?.bodies);
  }
  if (celestialBodiesContentDiv) {
    updateCelestialBodiesView(
      celestialBodiesContentDiv,
      state?.celestialBodies
    );
  }
  // Later, add calls to update celestial bodies views
}

function updateRenderControlPlayground() {
  if (!render || !physicsEngine) return;

  if (renderCanvasDimsDisplay && render.canvas) {
    renderCanvasDimsDisplay.textContent = `${render.canvas.width}x${render.canvas.height}`;
  }
  if (renderViewBoundsDisplay && render.bounds) {
    renderViewBoundsDisplay.textContent = `min:(${render.bounds.min.x.toFixed(
      2
    )}, ${render.bounds.min.y.toFixed(2)}), max:(${render.bounds.max.x.toFixed(
      2
    )}, ${render.bounds.max.y.toFixed(2)})`;
  }
  if (renderZoomLevelDisplay && render.canvas && render.bounds) {
    const viewWidthWorld = render.bounds.max.x - render.bounds.min.x;
    if (viewWidthWorld > 0) {
      const scaleX = render.canvas.width / viewWidthWorld;
      renderZoomLevelDisplay.textContent = `${scaleX.toFixed(2)}x`;
    } else {
      renderZoomLevelDisplay.textContent = "N/A";
    }
  }
  if (renderCurrentTickDisplay) {
    renderCurrentTickDisplay.textContent = currentTick.toString();
  }
  if (scenarioTotalStepsDisplay && currentScenario) {
    scenarioTotalStepsDisplay.textContent =
      currentScenario.simulationSteps.toString();
  }
}
