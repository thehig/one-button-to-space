import Phaser from "phaser";
import { PhysicsWorkerClient } from "../../src/physicsWorkerClient.ts";
import { CommandType } from "../../src/commands.ts";

class DemoUIManager {
  logOutput = null;
  logCount = 0;
  scene = null; // To call methods on DemoScene

  // --- World Control Inputs ---
  worldWidthInput = null;
  worldHeightInput = null;
  gravityXInput = null;
  gravityYInput = null;
  gravityScaleInput = null;
  initWorldButton = null;

  // --- Add Body Inputs ---
  bodyIdInput = null;
  bodyTypeSelect = null;
  bodyXInput = null;
  bodyYInput = null;
  bodyIsStaticCheckbox = null;
  // Type-specific input divs
  rectangleInputsDiv = null;
  circleInputsDiv = null;
  polygonInputsDiv = null;
  // Type-specific inputs
  rectWidthInput = null;
  rectHeightInput = null;
  circleRadiusInput = null;
  polygonSidesInput = null;
  polygonRadiusInput = null;
  addBodyButton = null;

  // --- Remove Body Inputs ---
  removeBodyIdInput = null;
  removeBodyButton = null;

  // --- Simulation Step Inputs ---
  stepDeltaTimeInput = null;
  stepButton = null;

  // --- Advance Simulation Time Inputs ---
  advanceTotalDeltaTimeInput = null;
  advanceInternalStepSizeInput = null;
  advanceTimeButton = null;

  // --- General Buttons ---
  loopButton = null;
  resetSimulationButton = null;
  terminateButton = null;

  constructor(scene) {
    this.scene = scene;
    this.logOutput = document.getElementById("logOutput");
    if (this.logOutput) {
      this.logOutput.textContent = ""; // Clear initial "Initializing..." text
    }

    // Get World Control elements
    this.worldWidthInput = document.getElementById("worldWidth");
    this.worldHeightInput = document.getElementById("worldHeight");
    this.gravityXInput = document.getElementById("gravityX");
    this.gravityYInput = document.getElementById("gravityY");
    this.gravityScaleInput = document.getElementById("gravityScale");
    this.initWorldButton = document.getElementById("initWorldButton");

    // Get Add Body elements
    this.bodyIdInput = document.getElementById("bodyId");
    this.bodyTypeSelect = document.getElementById("bodyType");
    this.bodyXInput = document.getElementById("bodyX");
    this.bodyYInput = document.getElementById("bodyY");
    this.bodyIsStaticCheckbox = document.getElementById("bodyIsStatic");
    this.rectangleInputsDiv = document.getElementById("rectangleInputs");
    this.circleInputsDiv = document.getElementById("circleInputs");
    this.polygonInputsDiv = document.getElementById("polygonInputs");
    this.rectWidthInput = document.getElementById("rectWidth");
    this.rectHeightInput = document.getElementById("rectHeight");
    this.circleRadiusInput = document.getElementById("circleRadius");
    this.polygonSidesInput = document.getElementById("polygonSides");
    this.polygonRadiusInput = document.getElementById("polygonRadius");
    this.addBodyButton = document.getElementById("addBodyButton");

    // Get Remove Body elements
    this.removeBodyIdInput = document.getElementById("removeBodyId");
    this.removeBodyButton = document.getElementById("removeBodyButton");

    // Get Step Simulation elements
    this.stepDeltaTimeInput = document.getElementById("stepDeltaTime");
    this.stepButton = document.getElementById("stepButton");

    // Get Advance Simulation Time elements
    this.advanceTotalDeltaTimeInput = document.getElementById(
      "advanceTotalDeltaTime"
    );
    this.advanceInternalStepSizeInput = document.getElementById(
      "advanceInternalStepSize"
    );
    this.advanceTimeButton = document.getElementById("advanceTimeButton");

    // Get General buttons
    this.loopButton = document.getElementById("loopButton");
    this.resetSimulationButton = document.getElementById(
      "resetSimulationButton"
    );
    this.terminateButton = document.getElementById("terminateButton");

    this._logMessage({
      type: "CLIENT_SCRIPT_LOADED",
      note: "Demo page script and UIManager initialized.",
    });
    this.setInitialButtonStates(); // Initial state before worker ready
    this._setupBodyTypeVisibility();
  }

  _setupBodyTypeVisibility() {
    if (!this.bodyTypeSelect) return;
    this.bodyTypeSelect.onchange = () => {
      const selectedType = this.bodyTypeSelect.value;
      this.rectangleInputsDiv.style.display =
        selectedType === "rectangle" ? "" : "none";
      this.circleInputsDiv.style.display =
        selectedType === "circle" ? "" : "none";
      this.polygonInputsDiv.style.display =
        selectedType === "polygon" ? "" : "none";
    };
    // Trigger change once to set initial visibility
    this.bodyTypeSelect.onchange();
  }

  _logMessage(message) {
    this.logCount++;
    const formattedMessage = `${this.logCount}: ${JSON.stringify(
      message,
      null,
      2
    )}\n\n`;
    console.log(`[Demo Page Raw Log #${this.logCount}]:`, message);

    if (this.logOutput) {
      this.logOutput.textContent += formattedMessage; // Append new message

      // Scroll to the bottom to show the latest log
      this.logOutput.scrollTop = this.logOutput.scrollHeight;

      if (this.logCount > 100) {
        // If log gets too long, trim from the top
        const lines = this.logOutput.textContent.split("\n");
        // Estimate lines per message (JSON stringify can vary, avg ~5-7 lines with double spacing)
        // Let's aim to keep around 50 messages, so ~250-350 lines.
        // If we remove first 50 lines (approx 10 messages) when count is 100, it's a bit aggressive.
        // Better to trim a smaller number of lines more frequently or a larger chunk less often.
        // For simplicity, let's trim a fixed number of lines from the top if it exceeds a certain threshold.
        // This example keeps it simple: if lines > ~200 (roughly 40-50 messages with spacing), trim.
        // Count 100 messages, each is roughly 4 lines (id: {},
        // If we want to keep 50 messages, that's 200 lines.
        // So if lines > 400, slice to keep the last 200 lines.
        const maxLines = 400; // Approximate max lines for ~100 messages with their formatting
        const linesToKeep = 200; // Approximate lines for ~50 messages
        if (lines.length > maxLines) {
          this.logOutput.textContent = lines
            .slice(lines.length - linesToKeep)
            .join("\n");
        }
      }
    } else {
      console.warn("Log output element not found by UIManager.");
    }
  }

  log(message) {
    this._logMessage(message);
  }

  // --- Button State Management ---
  setInitialButtonStates() {
    this.initWorldButton.disabled = true;
    // Add Body section
    this.addBodyButton.disabled = true;
    this.bodyIdInput.disabled = true;
    this.bodyTypeSelect.disabled = true;
    this.bodyXInput.disabled = true;
    this.bodyYInput.disabled = true;
    this.bodyIsStaticCheckbox.disabled = true;
    this.rectWidthInput.disabled = true;
    this.rectHeightInput.disabled = true;
    this.circleRadiusInput.disabled = true;
    this.polygonSidesInput.disabled = true;
    this.polygonRadiusInput.disabled = true;
    // Remove Body section
    this.removeBodyButton.disabled = true;
    this.removeBodyIdInput.disabled = true;
    // Step Simulation section
    this.stepButton.disabled = true;
    this.stepDeltaTimeInput.disabled = true;
    // Advance Time section
    this.advanceTimeButton.disabled = true;
    this.advanceTotalDeltaTimeInput.disabled = true;
    this.advanceInternalStepSizeInput.disabled = true;
    // General
    this.loopButton.disabled = true;
    this.resetSimulationButton.disabled = true;
    this.terminateButton.disabled = true; // Enabled once worker is ready
  }

  setWorkerReadyButtonStates() {
    this.initWorldButton.disabled = false;
    this.resetSimulationButton.disabled = false;
    this.terminateButton.disabled = false;
  }

  setWorldInitializedButtonStates() {
    // Add Body section
    this.addBodyButton.disabled = false;
    this.bodyIdInput.disabled = false;
    this.bodyTypeSelect.disabled = false;
    this.bodyXInput.disabled = false;
    this.bodyYInput.disabled = false;
    this.bodyIsStaticCheckbox.disabled = false;
    this.rectWidthInput.disabled = false; // Assuming rectangle is default
    this.rectHeightInput.disabled = false;
    this.circleRadiusInput.disabled = false;
    this.polygonSidesInput.disabled = false;
    this.polygonRadiusInput.disabled = false;
    this._setupBodyTypeVisibility(); // Ensure correct visibility based on default
    // Remove Body section
    this.removeBodyButton.disabled = false;
    this.removeBodyIdInput.disabled = false;
    // Step Simulation section
    this.stepButton.disabled = false;
    this.stepDeltaTimeInput.disabled = false;
    // Advance Time section
    this.advanceTimeButton.disabled = false;
    this.advanceTotalDeltaTimeInput.disabled = false;
    this.advanceInternalStepSizeInput.disabled = false;
    // General
    this.loopButton.disabled = false;
    this.resetSimulationButton.disabled = false;
  }

  setBodyAddedButtonStates() {
    // No specific buttons need to change state just on body add,
    // removeBodyButton is always enabled after world init.
  }

  setBodyRemovedButtonStates() {
    // No specific buttons need to change state just on body remove.
  }

  disableLoopControls(disable) {
    this.initWorldButton.disabled = disable;
    // Add Body
    this.addBodyButton.disabled = disable;
    this.bodyIdInput.disabled = disable;
    this.bodyTypeSelect.disabled = disable;
    // ... (disable all add body inputs)
    // Remove Body
    this.removeBodyButton.disabled = disable;
    this.removeBodyIdInput.disabled = disable;
    // Step & Advance
    this.stepButton.disabled = disable;
    this.stepDeltaTimeInput.disabled = disable;
    this.advanceTimeButton.disabled = disable;
    this.advanceTotalDeltaTimeInput.disabled = disable;
    this.advanceInternalStepSizeInput.disabled = disable;
    // Loop button itself
    this.loopButton.disabled = disable;
    this.resetSimulationButton.disabled = disable;
  }

  setTerminatedButtonStates() {
    this.initWorldButton.disabled = true;
    // Add Body section
    this.addBodyButton.disabled = true;
    this.bodyIdInput.disabled = true;
    // ... (disable all add body inputs)
    // Remove Body section
    this.removeBodyButton.disabled = true;
    this.removeBodyIdInput.disabled = true;
    // Step Simulation section
    this.stepButton.disabled = true;
    this.stepDeltaTimeInput.disabled = true;
    // Advance Time section
    this.advanceTimeButton.disabled = true;
    this.advanceTotalDeltaTimeInput.disabled = true;
    this.advanceInternalStepSizeInput.disabled = true;
    // General
    this.loopButton.disabled = true;
    this.resetSimulationButton.disabled = true;
    this.terminateButton.disabled = true;
  }

  // --- UI Event Listeners ---
  setupUIListeners() {
    this.initWorldButton.onclick = () => {
      this.log({ type: "DEMO_ACTION", note: "INIT_WORLD button clicked." });
      const width = parseInt(this.worldWidthInput.value, 10) || 800;
      const height = parseInt(this.worldHeightInput.value, 10) || 600;
      const gravityX = parseFloat(this.gravityXInput.value);
      const gravityY = parseFloat(this.gravityYInput.value);
      const gravityScale = parseFloat(this.gravityScaleInput.value);

      const payload = { width, height };
      if (!isNaN(gravityX) && !isNaN(gravityY)) {
        payload.gravity = { x: gravityX, y: gravityY };
        if (!isNaN(gravityScale)) {
          payload.gravity.scale = gravityScale;
        }
      }

      this.scene.physicsClient?.initWorld(payload);
      this.scene.clearVisuals(); // Clear old visuals
      this.scene.pendingBodies.clear(); // Clear pending bodies from previous world
      this.scene.lastUsedBodyId = 0; // Reset for new world
    };

    let bodyIdCounter = this.scene.lastUsedBodyId || 0; // Use scene's counter

    this.addBodyButton.onclick = () => {
      bodyIdCounter++;
      const id = this.bodyIdInput.value || `body-${bodyIdCounter}`;
      this.bodyIdInput.value = id; // Update input if it was empty

      const type = this.bodyTypeSelect.value;
      const x = parseFloat(this.bodyXInput.value) || Math.random() * 700 + 50;
      const y = parseFloat(this.bodyYInput.value) || Math.random() * 100;
      const isStatic = this.bodyIsStaticCheckbox.checked;

      const payload = {
        id,
        type,
        x,
        y,
        options: { isStatic, restitution: 0.7 }, // Example option
      };

      switch (type) {
        case "rectangle":
          payload.width = parseFloat(this.rectWidthInput.value) || 50;
          payload.height = parseFloat(this.rectHeightInput.value) || 50;
          break;
        case "circle":
          payload.radius = parseFloat(this.circleRadiusInput.value) || 25;
          break;
        case "polygon":
          payload.sides = parseInt(this.polygonSidesInput.value, 10) || 5;
          payload.radius = parseFloat(this.polygonRadiusInput.value) || 25;
          break;
      }

      this.log({
        type: "DEMO_ACTION",
        note: `Sending ADD_BODY (${type}). ID: ${id}`,
        payloadSent: payload,
      });
      this.scene.pendingBodies.set(id, payload); // Track for potential visual before confirmation
      this.scene.physicsClient?.sendMessage({
        type: CommandType.ADD_BODY,
        payload,
      });
      this.scene.lastUsedBodyId = bodyIdCounter; // Persist counter
      this.bodyIdInput.value = ""; // Clear the input for the next body
    };

    this.removeBodyButton.onclick = () => {
      const idToRemove = this.removeBodyIdInput.value;
      if (idToRemove) {
        this.log({
          type: "DEMO_ACTION",
          note: `Sending REMOVE_BODY. ID: ${idToRemove}`,
        });
        this.scene.physicsClient?.sendMessage({
          type: CommandType.REMOVE_BODY,
          payload: { id: idToRemove },
        });
        // No longer disable button here, it stays enabled after world init
      } else {
        this.log({
          type: "DEMO_ACTION",
          note: "No body ID entered to remove.",
        });
      }
    };

    this.stepButton.onclick = () => {
      if (this.scene.isLooping) {
        return;
      }
      const deltaTime = parseFloat(this.stepDeltaTimeInput.value) || 16.666;
      this.log({
        type: "DEMO_ACTION",
        note: `Sending STEP_SIMULATION. DeltaTime: ${deltaTime}`,
      });
      this.scene.physicsClient?.sendMessage({
        type: CommandType.STEP_SIMULATION,
        payload: { deltaTime },
      });
    };

    this.advanceTimeButton.onclick = () => {
      if (this.scene.isLooping) {
        return;
      }
      const totalDeltaTime =
        parseFloat(this.advanceTotalDeltaTimeInput.value) || 100;
      const internalStepSizeValue = this.advanceInternalStepSizeInput.value;
      const internalStepSize = internalStepSizeValue
        ? parseFloat(internalStepSizeValue)
        : undefined;

      const payload = { totalDeltaTime };
      if (
        internalStepSize !== undefined &&
        !isNaN(internalStepSize) &&
        internalStepSize > 0
      ) {
        payload.internalStepSize = internalStepSize;
      }
      this.log({
        type: "DEMO_ACTION",
        note: `Sending ADVANCE_SIMULATION_TIME. Total: ${totalDeltaTime}, Step: ${
          internalStepSize === undefined ? "default" : internalStepSize
        }`,
      });
      this.scene.physicsClient?.sendMessage({
        type: CommandType.ADVANCE_SIMULATION_TIME,
        payload,
      });
    };

    this.loopButton.onclick = () => {
      if (this.scene.isLooping) {
        return;
      }
      this.log({
        type: "DEMO_ACTION",
        note: "Starting simulation loop for 5 seconds.",
      });
      this.scene.isLooping = true;
      this.scene.loopEndTime = Date.now() + 5000;
      this.disableLoopControls(true);

      const runStep = () => {
        if (!this.scene.isLooping || Date.now() >= this.scene.loopEndTime) {
          this.scene.isLooping = false;
          this.disableLoopControls(false);
          this.log({ type: "DEMO_ACTION", note: "Simulation loop finished." });
          return;
        }
        this.scene.physicsClient?.sendMessage({
          type: CommandType.STEP_SIMULATION,
          payload: { deltaTime: 16.666 },
        });
        requestAnimationFrame(runStep);
      };
      requestAnimationFrame(runStep);
    };

    this.resetSimulationButton.onclick = () => {
      this.log({
        type: "DEMO_ACTION",
        note: "RESET_SIMULATION button clicked.",
      });
      // Perform the same actions as initWorldButton
      // It will trigger handleWorldInitialized in the scene, which then adds boundaries.
      const width = parseInt(this.worldWidthInput.value, 10) || 800;
      const height = parseInt(this.worldHeightInput.value, 10) || 600;
      const gravityX = parseFloat(this.gravityXInput.value);
      const gravityY = parseFloat(this.gravityYInput.value);
      const gravityScale = parseFloat(this.gravityScaleInput.value);

      const initPayload = { width, height };
      if (!isNaN(gravityX) && !isNaN(gravityY)) {
        initPayload.gravity = { x: gravityX, y: gravityY };
        if (!isNaN(gravityScale)) {
          initPayload.gravity.scale = gravityScale;
        }
      }

      this.scene.physicsClient?.initWorld(initPayload);
      this.scene.clearVisuals();
      this.scene.pendingBodies.clear();
      this.scene.lastUsedBodyId = 0;
    };

    this.terminateButton.onclick = () => {
      this.scene.isLooping = false;
      this.log({ type: "DEMO_ACTION", note: "Terminate button clicked." });
      this.scene.physicsClient?.terminate();
      this.scene.clearVisuals();
      this.setTerminatedButtonStates();
    };
  }
}

// --- Phaser Scene ---
class DemoScene extends Phaser.Scene {
  physicsClient = null;
  gameObjects = new Map();
  pendingBodies = new Map();
  lastUsedBodyId = 0; // For generating default body IDs
  isLooping = false;
  loopEndTime = 0;
  uiManager = null;

  worldDimensions = { width: 800, height: 600 }; // Store world dimensions

  constructor() {
    super({ key: "DemoScene" });
  }

  preload() {
    // No assets needed for simple shapes yet
  }

  create() {
    this.uiManager = new DemoUIManager(this); // Pass scene instance
    this.uiManager.setupUIListeners(); // Call it here

    this.uiManager.log({
      type: "PHASER_SCENE_CREATE",
      note: "Phaser scene creating...",
    });
    this.physicsClient = new PhysicsWorkerClient();
    this.uiManager.log({
      type: "CLIENT_ATTEMPT_INIT",
      note: "PhysicsWorkerClient instantiated in scene.",
    });

    this.physicsClient.onMessage((message) => {
      this.uiManager.log(message); // Log raw message including its commandId for correlation

      const { type, payload, commandId } = message; // Destructure commandId here

      switch (type) {
        case CommandType.WORKER_READY:
          this.handleWorkerReady(); // commandId is not directly relevant here
          break;
        case CommandType.WORLD_INITIALIZED:
          this.handleWorldInitialized(payload, commandId);
          break;
        case CommandType.BODY_ADDED:
          this.handleBodyAdded(payload, commandId);
          break;
        case CommandType.BODY_REMOVED:
          this.handleBodyRemoved(payload, commandId);
          break;
        case CommandType.SIMULATION_STEPPED:
          this.handleSimulationStepped(payload, commandId);
          break;
        case CommandType.SIMULATION_ADVANCED_TIME_COMPLETED:
          this.handleSimulationAdvancedTimeCompleted(payload, commandId);
          break;
        case CommandType.PHYSICS_EVENTS:
          this.handlePhysicsEvents(payload); // commandId might not be relevant for these broadcast events
          break;
        case CommandType.ERROR:
          console.error(`Error from worker (CmdID: ${commandId}):`, payload);
          this.uiManager.log({ type: CommandType.ERROR, payload, commandId }); // Log error with commandId
          break;
      }
    });
  }

  clearVisuals() {
    this.gameObjects.forEach((go) => go.destroy());
    this.gameObjects.clear();
    this.pendingBodies.clear();
  }

  handleWorkerReady() {
    this.uiManager.setWorkerReadyButtonStates();
    this.uiManager.log({
      type: "DEMO_ACTION",
      note: "Worker ready. Auto-sending INIT_WORLD.",
    });
    // Use default values from UIManager inputs for auto-init or define them here
    const width = parseInt(this.uiManager.worldWidthInput.value, 10) || 800;
    const height = parseInt(this.uiManager.worldHeightInput.value, 10) || 600;
    const gravityX = parseFloat(this.uiManager.gravityXInput.value);
    const gravityY = parseFloat(this.uiManager.gravityYInput.value);
    const gravityScale = parseFloat(this.uiManager.gravityScaleInput.value);

    const initialPayload = { width, height };
    if (!isNaN(gravityX) && !isNaN(gravityY)) {
      initialPayload.gravity = { x: gravityX, y: gravityY };
      if (!isNaN(gravityScale)) {
        initialPayload.gravity.scale = gravityScale;
      }
    }
    this.worldDimensions = { width, height }; // Store for boundary creation
    this.physicsClient?.initWorld(initialPayload);
  }

  handleWorldInitialized(payload, commandId) {
    if (payload.success) {
      this.uiManager.setWorldInitializedButtonStates();
      this.uiManager.log({
        type: "DEMO_SCENE",
        note: "World initialized by worker. Now adding static U-boundaries.",
        payload,
      });
      // Add static U-shaped boundaries
      this.addStaticBoundaries();
    }
  }

  addStaticBoundaries() {
    const thickness = 50; // Common thickness for all walls
    const { width, height } = this.worldDimensions; // Use stored dimensions

    const wallOptions = { isStatic: true, restitution: 0.5 };

    // Bottom wall
    this.physicsClient?.sendMessage({
      type: CommandType.ADD_BODY,
      payload: {
        id: "boundary-bottom",
        type: "rectangle",
        x: width / 2,
        y: height + thickness / 2 - 10, // Position it slightly overlapping the bottom edge if needed
        width: width + thickness * 2, // Make it wider to prevent corner escapes
        height: thickness,
        options: wallOptions,
      },
    });

    // Left wall
    this.physicsClient?.sendMessage({
      type: CommandType.ADD_BODY,
      payload: {
        id: "boundary-left",
        type: "rectangle",
        x: -thickness / 2,
        y: height / 2,
        width: thickness,
        height: height,
        options: wallOptions,
      },
    });

    // Right wall
    this.physicsClient?.sendMessage({
      type: CommandType.ADD_BODY,
      payload: {
        id: "boundary-right",
        type: "rectangle",
        x: width + thickness / 2,
        y: height / 2,
        width: thickness,
        height: height,
        options: wallOptions,
      },
    });
    this.uiManager.log({
      type: "DEMO_SCENE",
      note: "Sent commands to add static U-boundaries.",
    });
  }

  handleBodyAdded(payload, commandId) {
    if (payload.success && this.pendingBodies.has(payload.id)) {
      const initialProps = this.pendingBodies.get(payload.id);
      let gameObject = null;
      const color = Phaser.Display.Color.RandomRGB().color;

      this.uiManager.log({
        type: "DEMO_SCENE_HANDLER",
        event: "handleBodyAdded",
        status: "Attempting to create visual",
        receivedPayloadId: payload.id,
        initialPropsFromPending: initialProps,
      });

      if (
        initialProps.type === "rectangle" &&
        initialProps.width &&
        initialProps.height
      ) {
        gameObject = this.add.rectangle(
          initialProps.x,
          initialProps.y,
          initialProps.width,
          initialProps.height,
          color
        );
      } else if (initialProps.type === "circle" && initialProps.radius) {
        gameObject = this.add.circle(
          initialProps.x,
          initialProps.y,
          initialProps.radius,
          color
        );
      }
      // TODO: Add polygon/vertex rendering if needed

      if (gameObject) {
        this.gameObjects.set(
          payload.id,
          Object.assign(gameObject, { bodyType: initialProps.type })
        );
        this.pendingBodies.delete(payload.id); // Clean up
        this.uiManager.log({
          type: "DEMO_SCENE_HANDLER",
          event: "handleBodyAdded",
          status: "Visual created and stored",
          bodyId: payload.id,
          gameObjectProperties: {
            x: gameObject.x,
            y: gameObject.y,
            type: initialProps.type,
          },
        });
      } else {
        this.uiManager.log({
          type: "DEMO_SCENE_HANDLER",
          event: "handleBodyAdded",
          status: "Failed to create visual for body",
          bodyId: payload.id,
          initialPropsFromPending: initialProps,
        });
      }
    }
  }

  handleBodyRemoved(payload, commandId) {
    this.uiManager.log({
      type: "WORKER_RESPONSE",
      subtype: "BODY_REMOVED",
      payload,
      commandId,
    });
    if (payload.success && payload.id) {
      const existingObject = this.gameObjects.get(payload.id);
      if (existingObject) {
        existingObject.destroy();
        this.gameObjects.delete(payload.id);
      }
      this.pendingBodies.delete(payload.id); // Also remove from pending if it was there
    }
  }

  handleSimulationStepped(payload, commandId) {
    if (payload.success) {
      this.uiManager.log({
        type: "DEMO_SCENE_HANDLER",
        event: "handleSimulationStepped",
        receivedBodiesCount: payload.bodies.length,
        allBodiesData: payload.bodies,
      });
      payload.bodies.forEach((bodyUpdate) => {
        const go = this.gameObjects.get(bodyUpdate.id);
        this.uiManager.log({
          type: "DEMO_SCENE_HANDLER",
          event: "handleSimulationStepped_ForEach",
          bodyUpdateId: bodyUpdate.id,
          foundGameObject: !!go,
        });

        if (go) {
          if (go.isTinted) {
            go.clearTint();
          }
          go.setPosition(bodyUpdate.x, bodyUpdate.y);
          go.rotation = bodyUpdate.angle;
        }
      });
    }
  }

  handleSimulationAdvancedTimeCompleted(payload, commandId) {
    this.uiManager.log({
      type: "WORKER_RESPONSE", // Keep original log for this message
      subtype: "SIMULATION_ADVANCED_TIME_COMPLETED",
      payload,
      commandId,
    });
    if (payload.success && payload.bodies) {
      this.uiManager.log({
        type: "DEMO_SCENE_HANDLER",
        event: "handleSimulationAdvancedTimeCompleted",
        receivedBodiesCount: payload.bodies.length,
        allBodiesData: payload.bodies,
      });
      payload.bodies.forEach((bodyState) => {
        let gameObject = this.gameObjects.get(bodyState.id);
        this.uiManager.log({
          type: "DEMO_SCENE_HANDLER",
          event: "handleSimulationAdvancedTimeCompleted_ForEach",
          bodyStateId: bodyState.id,
          foundGameObject: !!gameObject,
        });

        if (gameObject) {
          this.uiManager.log({
            type: "DEMO_SCENE_HANDLER",
            event: "handleSimulationAdvancedTimeCompleted_UpdateVisual",
            bodyId: bodyState.id,
            oldVisualState: {
              x: gameObject.x,
              y: gameObject.y,
              angle: gameObject.angle,
            },
            newPhysicsState: {
              x: bodyState.x,
              y: bodyState.y,
              angle: Phaser.Math.RadToDeg(bodyState.angle),
            },
          });
          gameObject.setPosition(bodyState.x, bodyState.y);
          gameObject.setAngle(Phaser.Math.RadToDeg(bodyState.angle));
        } else {
          // If body was added and confirmed but no visual created yet (e.g. during a long advance)
          // This part might need more robust handling if visuals are crucial during the advance.
          // For now, we assume visuals are created on BODY_ADDED.
          console.warn(
            `[DemoScene] Received advanced state for unknown body ID: ${bodyState.id}`
          );
        }
      });
    }
  }

  handlePhysicsEvents(payload) {
    payload.collisions.forEach((collision) => {
      const bodyA = this.gameObjects.get(collision.bodyAId);
      const bodyB = this.gameObjects.get(collision.bodyBId);

      [bodyA, bodyB].forEach((go) => {
        if (go && go.setTint) {
          go.setTint(0xff0000);
        }
      });
    });
  }

  // Phaser's update loop
  update(_time, _delta) {
    // We get physics updates from the worker via messages
  }
}

// --- Phaser Game Config ---
const config = {
  type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
  width: 800,
  height: 600,
  parent: "phaser-container", // Render into the div
  scene: [DemoScene],
};

// Start the game
const _game = new Phaser.Game(config);
// logMessage({ type: "PHASER_INIT", note: "Phaser game instantiated." }); // Will be logged by UIManager if needed, or scene
// The DemoUIManager's constructor now handles the initial script load message.
// The final Phaser init message can be logged by the scene after game creation if desired.
// For now, DemoScene.create logs its own creation.
// If a global "Phaser game instantiated" log is critical, it can be added via uiManager after game creation.
// Example: if (game) { uiManagerInstanceFromSomewhere.log({ type: "PHASER_INIT", note: "Phaser game instantiated." }); }
// However, the current script structure makes a global uiManager instance tricky without further refactoring.
// The DemoScene's uiManager is the most straightforward way to log now.
