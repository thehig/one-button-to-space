import Matter from "matter-js";
import { PhysicsEngine } from "../PhysicsEngine";
// Import the scenariosMap from the new index file
import { scenariosMap } from "../scenarios/index";
// Import types from the types.ts file in the scenarios folder
import type {
  IScenario,
  ScenarioAction,
  ScenarioBodyInitialState,
  ScenarioEngineSettings,
} from "../scenarios/types.ts";

console.log(
  "Visualizer script loaded. Matter:",
  Matter ? "loaded" : "not loaded"
);
if (scenariosMap.size === 0) {
  console.warn(
    "Scenarios Map is empty! Check scenarios/index.ts and individual scenario files."
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
  // Iterate over the keys of scenariosMap (which are the display names)
  scenariosMap.forEach((_scenario, displayName) => {
    const option = document.createElement("option");
    option.value = displayName;
    option.textContent = displayName;
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
  playPauseButton.textContent = "Play";
}

function loadScenario(displayName: string) {
  clearSimulationState();
  setupMatter();

  currentScenarioDisplayName = displayName;
  currentScenario = scenariosMap.get(displayName) || null;

  if (!currentScenario) {
    console.error(
      `Scenario with display name ${displayName} not found in scenariosMap!`
    );
    return;
  }

  console.log(`Loading scenario: ${displayName} (ID: ${currentScenario.id})`);

  // Correctly instantiate PhysicsEngine
  const scenarioSettings = currentScenario.engineSettings;
  const peFixedTimeStep = scenarioSettings?.fixedTimeStepMs; // undefined will use PE default
  const peCustomG = scenarioSettings?.customG; // undefined will use PE default

  physicsEngine = new PhysicsEngine(peFixedTimeStep, peCustomG);

  // Handle logging settings
  const scenarioWantsLogging = scenarioSettings?.enableInternalLogging || false;
  if (debugLoggingCheckbox) {
    physicsEngine.setInternalLogging(
      debugLoggingCheckbox.checked || scenarioWantsLogging
    );
  } else {
    physicsEngine.setInternalLogging(scenarioWantsLogging);
  }

  // The old setGravity call is redundant if customG is passed to constructor.
  // However, PhysicsEngine doesn't currently have a setGravity method.
  // If customG was part of engineSettings and PE constructor handles it, this is fine.
  // If not, setGravity would need to be added to PE or handled differently.
  // For now, assuming constructor handles customG if provided.

  if (currentScenario.engineSettings?.fixedTimeStepMs !== undefined) {
    // This log is slightly misleading now as PE's fixedTimeStepMs is set by constructor if provided
    // And visualizer's gameLoop runs at its own 'timeStep', calling PE.update()
    // The PE.update() method then uses its own fixedTimeStep for internal logic IF it were using the fixedStep() method.
    // Currently, PE.update directly calls Matter.Engine.update with the visualizer's timeStep.
    // We might need to reconcile how fixedTimeStep is used/logged.
    console.warn(
      `Scenario specified fixedTimeStepMs: ${
        currentScenario.engineSettings.fixedTimeStepMs
      }. Visualizer loop is ~${timeStep.toFixed(2)}ms.`
    );
  }

  physicsEngine.setExternalMatterEngine(engine);

  const celestialBodiesFromScenario = currentScenario.celestialBodies || [];
  // Call init to set celestial bodies. If a scenario has none,
  // this effectively initializes with an empty array if init handles undefined correctly
  // or just ensures init is called.
  physicsEngine.init(
    celestialBodiesFromScenario.length > 0
      ? celestialBodiesFromScenario
      : undefined
  );

  currentScenario.initialBodies.forEach((bodyDef: ScenarioBodyInitialState) => {
    const bodyOptions = {
      ...bodyDef.options,
      label: bodyDef.id,
      angle: bodyDef.initialAngle,
    };

    let newBody: Matter.Body | null = null;
    switch (bodyDef.type) {
      case "box":
        newBody = physicsEngine.createBox(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.width || 0,
          bodyDef.height || 0,
          bodyOptions
        );
        break;
      case "circle":
        newBody = physicsEngine.createCircle(
          bodyDef.initialPosition.x,
          bodyDef.initialPosition.y,
          bodyDef.radius || 0,
          bodyOptions
        );
        break;
      case "rocket":
        console.warn(
          `Visualizer using default for 'rocket' type. Ensure createRocketBody in PhysicsEngine is suitable or enhance options.`
        );
        if (typeof physicsEngine.createRocketBody === "function") {
          newBody = (physicsEngine as any).createRocketBody(
            bodyDef.initialPosition.x,
            bodyDef.initialPosition.y,
            bodyOptions
          );
        } else {
          console.error(
            "physicsEngine.createRocketBody does not exist or is not being called correctly."
          );
        }
        break;
      default:
        console.warn(`Unsupported body type in scenario: ${bodyDef.type}`);
    }

    if (newBody) {
      if (bodyDef.initialVelocity) {
        Matter.Body.setVelocity(newBody, bodyDef.initialVelocity);
      }
      if (bodyDef.initialAngularVelocity) {
        Matter.Body.setAngularVelocity(newBody, bodyDef.initialAngularVelocity);
      }
      if (newBody.label !== bodyDef.id) {
        Matter.Body.set(newBody, "label", bodyDef.id);
      }
      // Log body details
      console.log(
        `[Visualizer] Created body: ID='${bodyDef.id}', Label='${
          newBody.label
        }', Pos=(${newBody.position.x.toFixed(2)}, ${newBody.position.y.toFixed(
          2
        )})`
      );
      console.log(
        `[Visualizer] Body bounds: min=(${newBody.bounds.min.x.toFixed(
          2
        )}, ${newBody.bounds.min.y.toFixed(
          2
        )}), max=(${newBody.bounds.max.x.toFixed(
          2
        )}, ${newBody.bounds.max.y.toFixed(2)})`
      );
      console.log(
        `[Visualizer] Body render.visible: ${newBody.render.visible}`
      );
    }
  });

  actionQueue = currentScenario.actions ? [...currentScenario.actions] : [];
  actionQueue.sort((a, b) => a.step - b.step);

  currentTick = 0;
  isPlaying = false;
  playPauseButton.textContent = "Play";

  // Adjust camera to view the bodies
  // const allBodies = Matter.Composite.allBodies(engine.world);
  // if (allBodies.length > 0) {
  //   // Calculate bounds of all bodies
  //   const bodiesBounds = Matter.Bounds.create(allBodies);
  //
  //   // Use Render.lookAt to center the view on the bounds
  //   Matter.Render.lookAt(render, {
  //     min: { x: bodiesBounds.min.x, y: bodiesBounds.min.y },
  //     max: { x: bodiesBounds.max.x, y: bodiesBounds.max.y },
  //   });
  //
  //   // Add some padding to the view after lookAt
  //   const padding = 0.2; // 20% padding, adjust as needed
  //   const worldViewWidth = render.bounds.max.x - render.bounds.min.x;
  //   const worldViewHeight = render.bounds.max.y - render.bounds.min.y;
  //
  //   render.bounds.min.x -= worldViewWidth * padding;
  //   render.bounds.max.x += worldViewWidth * padding;
  //   render.bounds.min.y -= worldViewHeight * padding;
  //   render.bounds.max.y += worldViewHeight * padding;
  //
  // } else {
  //   // Default view if no bodies (e.g., centered at 0,0)
  //   Matter.Render.lookAt(render, {
  //     min: { x: -render.options.width! / 2, y: -render.options.height! / 2 },
  //     max: { x: render.options.width! / 2, y: render.options.height! / 2 },
  //   });
  // }
}

function gameLoop() {
  if (!isPlaying || !currentScenario || !physicsEngine || !engine) return;

  while (actionQueue.length > 0 && actionQueue[0].step === currentTick) {
    const actionDef = actionQueue.shift();
    if (actionDef) {
      console.log(
        `Tick ${currentTick}: Action ${actionDef.actionType} for ${actionDef.targetBodyId}`
      );
      const targetBodyExists = !!physicsEngine.getBodyById(
        actionDef.targetBodyId
      ); // Check existence
      if (!targetBodyExists) {
        console.warn(`Action target body ${actionDef.targetBodyId} not found.`);
        continue;
      }
      if (actionDef.actionType === "applyForce" && actionDef.force) {
        const bodyToApplyForce = physicsEngine.getBodyById(
          actionDef.targetBodyId
        );
        if (bodyToApplyForce) {
          physicsEngine.applyForceToBody(
            bodyToApplyForce,
            actionDef.applicationPoint || bodyToApplyForce.position, // Apply at point or body center
            actionDef.force
          );
        } else {
          console.warn(
            `Could not retrieve body ${actionDef.targetBodyId} for applying force, though it existed moments ago.`
          );
        }
      } else {
        console.warn(
          `Unsupported action type: ${actionDef.actionType} or missing parameters.`
        );
      }
    }
  }

  physicsEngine.update(timeStep / 1000);

  if (debugLoggingCheckbox && debugLoggingCheckbox.checked) {
    if (physicsEngine && typeof physicsEngine.toJSON === "function") {
      const currentState = physicsEngine.toJSON();
      console.log("[PhysicsEngine Current State JSON (Object)]:", currentState);
      console.log(
        "[PhysicsEngine Current State JSON (String)]:",
        JSON.stringify(currentState, null, 2)
      );
    } else {
      console.warn(
        "[Visualizer] physicsEngine.toJSON is not available or not a function."
      );
    }
  }

  currentTick++;

  const scenarioDurationSteps = currentScenario.simulationSteps;
  if (currentTick >= scenarioDurationSteps) {
    pauseSimulation();
    console.log(
      `Scenario ${currentScenarioDisplayName} finished after ${scenarioDurationSteps} steps.`
    );
  }
}

function playSimulation() {
  if (
    !currentScenarioDisplayName ||
    !scenariosMap.has(currentScenarioDisplayName)
  ) {
    alert("Please select and load a scenario first.");
    return;
  }
  if (!currentScenario) {
    loadScenario(currentScenarioDisplayName);
    if (!currentScenario) return;
  }

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
  if (physicsEngine) {
    physicsEngine.setInternalLogging(debugLoggingCheckbox.checked);
    console.log(
      `PhysicsEngine internal logging set to: ${debugLoggingCheckbox.checked}`
    );
    // If a scenario is loaded, you might want to reload it to see logs from its setup phase
    // or just accept that logging changes take effect from this point onwards.
    // For now, it just affects future logs from the existing physicsEngine instance.
  }
});

document.addEventListener("DOMContentLoaded", () => {
  // processScenarioModules(); // This is no longer needed, scenariosMap is directly imported
  if (scenariosMap.size > 0) {
    populateScenarioSelector();
  } else {
    console.error(
      "No scenarios were loaded. Check 'packages/shared/src/physics/scenarios/index.ts' and ensure it populates scenariosMap correctly."
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
