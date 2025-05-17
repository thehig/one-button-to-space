import Matter from "matter-js";
import { PhysicsEngine } from "../PhysicsEngine";
// Import the scenariosMap from the new index file
import { scenariosMap } from "../scenarios/index.ts";
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

  render = Matter.Render.create({
    element: matterContainer,
    engine: engine,
    options: {
      width: 800,
      height: 600,
      wireframes: false,
      showAngleIndicator: true,
      showCollisions: true,
      showVelocity: true,
      background: "#ffffff",
    },
  });

  Matter.Render.run(render);
  runner = Matter.Runner.create();
  console.log("Matter.js engine and renderer (re)initialized.");
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

  physicsEngine = new PhysicsEngine(
    currentScenario.engineSettings?.enableInternalLogging || false
  );
  if (currentScenario.engineSettings?.customG !== undefined) {
    physicsEngine.setGravity(currentScenario.engineSettings.customG);
  }
  if (currentScenario.engineSettings?.fixedTimeStepMs !== undefined) {
    console.warn(
      "Scenario's fixedTimeStepMs is noted, but visualizer runs on its own ~60FPS loop."
    );
  }

  physicsEngine.setExternalMatterEngine(engine);

  (currentScenario.celestialBodies || []).forEach((cb) =>
    physicsEngine.addCelestialBody(cb)
  );

  currentScenario.initialBodies.forEach((bodyDef: ScenarioBodyInitialState) => {
    physicsEngine.addBody(
      bodyDef.id,
      bodyDef.type as "box" | "circle",
      bodyDef.initialPosition,
      bodyDef.width || (bodyDef.radius ? bodyDef.radius * 2 : 0),
      bodyDef.height || (bodyDef.radius ? bodyDef.radius * 2 : 0),
      bodyDef.initialAngle,
      bodyDef.initialVelocity,
      bodyDef.initialAngularVelocity,
      bodyDef.label,
      bodyDef.options
    );
  });

  actionQueue = currentScenario.actions ? [...currentScenario.actions] : [];
  actionQueue.sort((a, b) => a.step - b.step);

  currentTick = 0;
  isPlaying = false;
  playPauseButton.textContent = "Play";
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
        // Corrected variable name from targetBody to targetBodyExists
        console.warn(`Action target body ${actionDef.targetBodyId} not found.`);
        continue;
      }
      if (actionDef.actionType === "applyForce" && actionDef.force) {
        physicsEngine.applyForce(
          actionDef.targetBodyId,
          actionDef.force,
          actionDef.applicationPoint
        );
      } else {
        console.warn(
          `Unsupported action type: ${actionDef.actionType} or missing parameters.`
        );
      }
    }
  }

  physicsEngine.update(timeStep / 1000);
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
