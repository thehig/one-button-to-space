import Phaser from "phaser";
import { PhysicsWorkerClient } from "../../src/physicsWorkerClient.ts";
import { CommandType } from "../../src/commands.ts";

class DemoUIManager {
  logEntriesContainer = null;
  logCount = 0;
  scene = null; // To call methods on DemoScene

  // --- World Control Inputs ---
  gravityXInput = null;
  gravityYInput = null;
  gravityScaleInput = null;
  worldEnableSleepingCheckbox = null;
  worldTimeScaleInput = null;
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
  removableBodyListContainer = null;

  // --- NEW Simulation Updates Inputs ---
  playButton = null;
  pauseButton = null;
  stepOnceButton = null;
  advanceTotalDeltaTimeInputNew = null;
  advanceInternalStepSizeInputNew = null;
  advanceTimeButtonNew = null;

  // --- General Buttons ---
  loopButton = null;
  resetSimulationButton = null;
  terminateButton = null;

  constructor(scene) {
    this.scene = scene;
    this.logEntriesContainer = document.getElementById("logEntriesContainer");
    if (this.logEntriesContainer) {
      this.logEntriesContainer.innerHTML = ""; // Clear initial placeholder content
    }

    // Get World Control elements
    this.gravityXInput = document.getElementById("gravityX");
    this.gravityYInput = document.getElementById("gravityY");
    this.gravityScaleInput = document.getElementById("gravityScale");
    this.worldEnableSleepingCheckbox = document.getElementById(
      "worldEnableSleeping"
    );
    this.worldTimeScaleInput = document.getElementById("worldTimeScale");
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
    this.removableBodyListContainer = document.getElementById(
      "removableBodyListContainer"
    );

    // Get NEW Simulation Updates elements
    this.playButton = document.getElementById("playButton");
    this.pauseButton = document.getElementById("pauseButton");
    this.stepOnceButton = document.getElementById("stepOnceButton");
    this.advanceTotalDeltaTimeInputNew = document.getElementById(
      "advanceTotalDeltaTime"
    );
    this.advanceInternalStepSizeInputNew = document.getElementById(
      "advanceInternalStepSize"
    );
    this.advanceTimeButtonNew = document.getElementById("advanceTimeButtonNew");

    // Get General buttons
    this.loopButton = document.getElementById("loopButton");
    this.resetSimulationButton = document.getElementById(
      "resetSimulationButton"
    );
    this.terminateButton = document.getElementById("terminateButton");

    this._logMessage(
      {
        type: "CLIENT_SCRIPT_LOADED",
        note: "Demo page script and UIManager initialized.",
      },
      "client-event"
    );
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

  _logMessage(message, origin = "client-event") {
    this.logCount++;
    const formattedMessage = `${this.logCount}: ${JSON.stringify(
      message,
      null,
      2
    )}`;

    if (this.logEntriesContainer) {
      const logEntryRow = document.createElement("div");
      logEntryRow.className = "flex items-stretch border-b border-gray-100";

      const leftCell = document.createElement("pre");
      leftCell.className =
        "w-1/2 p-1 text-xs whitespace-pre-wrap break-words border-r border-gray-200";

      const rightCell = document.createElement("pre");
      rightCell.className = "w-1/2 p-1 text-xs whitespace-pre-wrap break-words";

      if (origin === "worker-response") {
        rightCell.textContent = formattedMessage;
        leftCell.innerHTML = "&nbsp;";
        logEntryRow.classList.add("bg-blue-50");
      } else {
        leftCell.textContent = formattedMessage;
        rightCell.innerHTML = "&nbsp;";
        if (message && message.type === CommandType.ERROR) {
          logEntryRow.classList.add("bg-red-50");
        } else {
          logEntryRow.classList.add("bg-green-50");
        }
      }

      logEntryRow.appendChild(leftCell);
      logEntryRow.appendChild(rightCell);
      this.logEntriesContainer.appendChild(logEntryRow);

      const maxLogEntries = 100;
      if (this.logEntriesContainer.children.length > maxLogEntries) {
        this.logEntriesContainer.removeChild(
          this.logEntriesContainer.firstChild
        );
      }
    } else {
      console.warn(
        "Log entries container not found. Logging to console:",
        origin,
        message
      );
    }
  }

  log(message, origin = "client-event") {
    this._logMessage(message, origin);
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
    if (this.removableBodyListContainer) {
      this.removableBodyListContainer.innerHTML =
        '<p class="text-gray-500 italic">No bodies yet.</p>';
    }
    // NEW Simulation Updates section
    this.playButton.disabled = true;
    this.pauseButton.disabled = true;
    this.stepOnceButton.disabled = true;
    this.advanceTotalDeltaTimeInputNew.disabled = true;
    this.advanceInternalStepSizeInputNew.disabled = true;
    this.advanceTimeButtonNew.disabled = true;
    // General
    this.loopButton.disabled = true;
    this.resetSimulationButton.disabled = true;
    this.terminateButton.disabled = true; // Enabled once worker is ready
  }

  setWorkerReadyButtonStates() {
    this.initWorldButton.disabled = false;
    this.resetSimulationButton.disabled = false;
    this.terminateButton.disabled = false;
    // World options should be enabled
    this.gravityXInput.disabled = false;
    this.gravityYInput.disabled = false;
    this.gravityScaleInput.disabled = false;
    this.worldEnableSleepingCheckbox.disabled = false;
    this.worldTimeScaleInput.disabled = false;
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
    if (this.removableBodyListContainer) {
      this.removableBodyListContainer.innerHTML =
        '<p class="text-gray-500 italic">No bodies yet.</p>';
    }
    // NEW Simulation Updates section
    this.playButton.disabled = false;
    this.pauseButton.disabled = false; // Initially, play is active, so pause is an option
    this.stepOnceButton.disabled = false;
    this.advanceTotalDeltaTimeInputNew.disabled = false;
    this.advanceInternalStepSizeInputNew.disabled = false;
    this.advanceTimeButtonNew.disabled = false;
    // General
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
    if (this.removableBodyListContainer) {
      this.removableBodyListContainer.innerHTML =
        '<p class="text-gray-500 italic">No bodies yet.</p>';
    }
    // NEW Simulation Updates controls
    this.playButton.disabled = disable;
    this.pauseButton.disabled = disable;
    this.stepOnceButton.disabled = disable;
    this.advanceTotalDeltaTimeInputNew.disabled = disable;
    this.advanceInternalStepSizeInputNew.disabled = disable;
    this.advanceTimeButtonNew.disabled = disable;
    // Loop button itself (old, should be removed if play/pause fully replaces it)
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
    if (this.removableBodyListContainer) {
      this.removableBodyListContainer.innerHTML =
        '<p class="text-red-500 italic">Worker terminated. Body list cleared.</p>';
    }
    // NEW Simulation Updates section
    this.playButton.disabled = true;
    this.pauseButton.disabled = true;
    this.stepOnceButton.disabled = true;
    this.advanceTotalDeltaTimeInputNew.disabled = true;
    this.advanceInternalStepSizeInputNew.disabled = true;
    this.advanceTimeButtonNew.disabled = true;
    // General
    this.loopButton.disabled = true;
    this.resetSimulationButton.disabled = true;
    this.terminateButton.disabled = true;
  }

  // --- UI Event Listeners ---
  setupUIListeners() {
    this.initWorldButton.onclick = () => {
      this.log(
        { type: "DEMO_ACTION", note: "INIT_WORLD button clicked." },
        "client-event"
      );
      const gravityX = parseFloat(this.gravityXInput.value);
      const gravityY = parseFloat(this.gravityYInput.value);
      const gravityScale = parseFloat(this.gravityScaleInput.value);
      const enableSleeping = this.worldEnableSleepingCheckbox.checked;
      const timeScale = parseFloat(this.worldTimeScaleInput.value);

      const payload = {
        options: {},
      };
      if (!isNaN(gravityX) && !isNaN(gravityY)) {
        payload.gravity = { x: gravityX, y: gravityY };
        if (!isNaN(gravityScale) && gravityScale !== 0.001) {
          payload.gravity.scale = gravityScale;
        }
      }
      if (enableSleeping !== undefined) {
        payload.options.enableSleeping = enableSleeping;
      }
      if (!isNaN(timeScale) && timeScale !== 1) {
        payload.options.timing = { timeScale: timeScale };
      }

      this.scene.physicsClient?.initWorld(payload);
      this.scene.clearVisuals();
      this.scene.pendingBodies.clear();
      this.scene.lastUsedBodyId = 0;
    };

    this.addBodyButton.onclick = () => {
      this.handleAddBodyRequest(); // No coordinates, will use form inputs for X,Y
    };

    this.playButton.onclick = () => {
      if (this.scene.isLooping) return;
      this.log(
        { type: "DEMO_ACTION", note: "Play button clicked." },
        "client-event"
      );
      this.scene.isLooping = true;
      this.disableLoopControls(true);
      this.playButton.disabled = true;
      this.pauseButton.disabled = false;
      this.stepOnceButton.disabled = true;

      const runStep = () => {
        if (!this.scene.isLooping) {
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

    this.pauseButton.onclick = () => {
      if (!this.scene.isLooping) return;
      this.log(
        { type: "DEMO_ACTION", note: "Pause button clicked." },
        "client-event"
      );
      this.scene.isLooping = false;
      this.disableLoopControls(false);
      this.playButton.disabled = false;
      this.pauseButton.disabled = true;
      this.stepOnceButton.disabled = false;
    };

    this.stepOnceButton.onclick = () => {
      if (this.scene.isLooping) return;
      const deltaTime = 16.666;
      this.log(
        {
          type: "DEMO_ACTION",
          note: `Step Once button clicked. DeltaTime: ${deltaTime}`,
        },
        "client-event"
      );
      this.scene.physicsClient?.sendMessage({
        type: CommandType.STEP_SIMULATION,
        payload: { deltaTime },
      });
    };

    this.advanceTimeButtonNew.onclick = () => {
      if (this.scene.isLooping) return;
      const totalDeltaTime =
        parseFloat(this.advanceTotalDeltaTimeInputNew.value) || 100;
      const internalStepSizeValue = this.advanceInternalStepSizeInputNew.value;
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
      this.log(
        {
          type: "DEMO_ACTION",
          note: `Advance Time (New) button clicked. Total: ${totalDeltaTime}, Step: ${
            internalStepSize === undefined ? "default" : internalStepSize
          }`,
        },
        "client-event"
      );
      this.scene.physicsClient?.sendMessage({
        type: CommandType.ADVANCE_SIMULATION_TIME,
        payload,
      });
    };

    this.resetSimulationButton.onclick = () => {
      this.log(
        {
          type: "DEMO_ACTION",
          note: "RESET_SIMULATION button clicked.",
        },
        "client-event"
      );
      // Perform the same actions as initWorldButton
      // It will trigger handleWorldInitialized in the scene, which then adds boundaries.
      const gravityX = parseFloat(this.gravityXInput.value);
      const gravityY = parseFloat(this.gravityYInput.value);
      const gravityScale = parseFloat(this.gravityScaleInput.value);
      const enableSleeping = this.worldEnableSleepingCheckbox.checked;
      const timeScale = parseFloat(this.worldTimeScaleInput.value);

      const initPayload = { options: {} };
      if (!isNaN(gravityX) && !isNaN(gravityY)) {
        initPayload.gravity = { x: gravityX, y: gravityY };
        if (!isNaN(gravityScale) && gravityScale !== 0.001) {
          initPayload.gravity.scale = gravityScale;
        }
      }
      if (enableSleeping !== undefined) {
        initPayload.options.enableSleeping = enableSleeping;
      }
      if (!isNaN(timeScale) && timeScale !== 1) {
        initPayload.options.timing = { timeScale: timeScale };
      }

      this.scene.physicsClient?.initWorld(initPayload);
      this.scene.clearVisuals();
      this.scene.pendingBodies.clear();
      this.scene.lastUsedBodyId = 0;
    };

    this.terminateButton.onclick = () => {
      this.scene.isLooping = false;
      this.log(
        { type: "DEMO_ACTION", note: "Terminate button clicked." },
        "client-event"
      );
      this.scene.physicsClient?.terminate();
      this.scene.clearVisuals();
      this.setTerminatedButtonStates();
    };
  }

  // NEW METHOD: handleAddBodyRequest
  handleAddBodyRequest(clickX = null, clickY = null) {
    if (!this.scene.physicsClient || !this.scene.isWorldReadyForAdds) {
      // Check scene flag
      this.log(
        {
          type: "UI_ERROR",
          note: "Cannot add body: Physics client not ready or world not initialized.",
        },
        "client-event"
      );
      return;
    }

    let idToUse;
    let idWasAutoGenerated = false;
    let descriptiveName = "body";

    const type = this.bodyTypeSelect.value;
    const isStatic = this.bodyIsStaticCheckbox.checked;

    // Generate descriptive part of name
    switch (type) {
      case "rectangle": {
        const w = parseFloat(this.rectWidthInput.value) || 50;
        const h = parseFloat(this.rectHeightInput.value) || 50;
        descriptiveName = `rect-${w}x${h}`;
        break;
      }
      case "circle": {
        const r = parseFloat(this.circleRadiusInput.value) || 25;
        descriptiveName = `circ-${r}r`;
        break;
      }
      case "polygon": {
        const s = parseInt(this.polygonSidesInput.value, 10) || 5;
        const pr = parseFloat(this.polygonRadiusInput.value) || 25;
        descriptiveName = `poly-${s}s-${pr}r`;
        break;
      }
    }
    if (isStatic) {
      descriptiveName += "-static";
    }

    if (this.bodyIdInput.value) {
      idToUse = this.bodyIdInput.value;
    } else {
      this.scene.lastUsedBodyId++;
      idToUse = `${descriptiveName}-${this.scene.lastUsedBodyId}`;
      idWasAutoGenerated = true;
    }

    // Use click coordinates if provided, otherwise use form values or random
    const x =
      clickX !== null
        ? clickX
        : parseFloat(this.bodyXInput.value) ||
          Math.random() * (this.scene.worldDimensions.width - 100) + 50;
    const y =
      clickY !== null
        ? clickY
        : parseFloat(this.bodyYInput.value) ||
          Math.random() * (this.scene.worldDimensions.height * 0.5); // Random y in top half

    const payload = {
      id: idToUse,
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

    this.log(
      {
        type: "DEMO_ACTION",
        note: `Requesting ADD_BODY (${type}). ID: ${idToUse}. FromClick: ${
          clickX !== null
        }`,
        payloadSent: payload,
      },
      "client-event"
    );

    this.scene.pendingBodies.set(idToUse, payload);
    this.scene.physicsClient?.sendMessage({
      type: CommandType.ADD_BODY,
      payload,
    });

    // If ID was auto-generated AND this was a button click (not canvas click),
    // then clear the input field for the next manual input.
    if (idWasAutoGenerated && clickX === null) {
      this.bodyIdInput.value = "";
    } else if (clickX === null && !idWasAutoGenerated) {
      // If it was a button click and user provided an ID, clear the input for next time.
      this.bodyIdInput.value = "";
    }
    // If it's a canvas click, the bodyIdInput field is NOT changed.
    // The scene.lastUsedBodyId was already updated if an ID was auto-generated.
  }

  updateRemovableBodyList(bodyIds) {
    if (!this.removableBodyListContainer) return;

    this.removableBodyListContainer.innerHTML = ""; // Clear previous list

    if (!bodyIds || bodyIds.length === 0) {
      const p = document.createElement("p");
      p.textContent = "No dynamic bodies to remove.";
      p.className = "text-gray-500 italic";
      this.removableBodyListContainer.appendChild(p);
      return;
    }

    bodyIds.forEach((bodyId) => {
      if (bodyId.startsWith("boundary-")) return; // Optionally skip static boundaries

      const button = document.createElement("button");
      button.textContent = bodyId;
      button.className =
        "w-full text-left p-2 border border-gray-300 rounded hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 focus:bg-red-50 mb-1 text-sm";
      button.onclick = () => {
        this.log(
          {
            type: "DEMO_ACTION",
            note: `Requesting REMOVE_BODY for ID: ${bodyId} (via list click)`,
          },
          "client-event"
        );
        this.scene.requestRemoveBodyById(bodyId);
      };
      this.removableBodyListContainer.appendChild(button);
    });
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
  isWorldReadyForAdds = false; // NEW: Flag to indicate if world is ready for add operations

  worldDimensions = { width: 800, height: 600 }; // Initialized properly in create

  constructor() {
    super({ key: "DemoScene" });
  }

  preload() {
    // No assets needed for simple shapes yet
  }

  create() {
    // Set worldDimensions based on the actual game canvas size after Phaser boots up
    this.worldDimensions = {
      width: this.scale.width,
      height: this.scale.height,
    };

    this.uiManager = new DemoUIManager(this); // Pass scene instance
    this.uiManager.setupUIListeners(); // Call it here

    this.uiManager.log(
      {
        type: "PHASER_SCENE_CREATE",
        note: "Phaser scene creating...",
      },
      "client-event"
    );
    this.physicsClient = new PhysicsWorkerClient();
    this.uiManager.log(
      {
        type: "CLIENT_ATTEMPT_INIT",
        note: "PhysicsWorkerClient instantiated in scene.",
      },
      "client-event"
    );

    this.physicsClient.onMessage((message) => {
      this.uiManager.log(message, "worker-response");

      const { type, payload, commandId } = message;

      if (!this.uiManager) {
        console.error(
          "UIManager not initialized when message received:",
          message
        );
        return;
      }

      switch (type) {
        case CommandType.WORKER_READY:
          this.handleWorkerReady();
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
          this.handlePhysicsEvents(payload);
          break;
        case CommandType.ERROR:
          console.error(`Error from worker (CmdID: ${commandId}):`, payload);
          this.uiManager.log(
            { type: CommandType.ERROR, payload, commandId },
            "worker-response"
          );
          break;
      }
    });

    // Listen for resize events
    this.scale.on("resize", this.handleResize, this);

    // NEW: Listen for pointer down events on the canvas
    this.input.on(
      "pointerdown",
      (pointer) => {
        if (
          !this.physicsClient ||
          !this.uiManager ||
          !this.isWorldReadyForAdds
        ) {
          if (
            this.uiManager &&
            this.physicsClient &&
            !this.isWorldReadyForAdds
          ) {
            this.uiManager.log(
              {
                type: "SCENE_INPUT_EVENT",
                note: "Canvas click ignored: World not ready for adding bodies.",
              },
              "client-event"
            );
          }
          return;
        }
        // Ensure click is within the game canvas bounds (Phaser default pointer.worldX/Y handles this)
        this.uiManager.handleAddBodyRequest(pointer.worldX, pointer.worldY);
      },
      this
    );
  }

  clearVisuals() {
    this.gameObjects.forEach((go) => go.destroy());
    this.gameObjects.clear();
    this.pendingBodies.clear();
    if (this.uiManager) {
      this.uiManager.updateRemovableBodyList([]); // Update UI list
    }
  }

  handleWorkerReady() {
    this.uiManager.setWorkerReadyButtonStates();
    this.isWorldReadyForAdds = false;
    this.uiManager.log(
      {
        type: "DEMO_ACTION",
        note: "Worker ready. Auto-sending INIT_WORLD with current canvas dimensions.",
      },
      "client-event"
    );

    const gravityX = parseFloat(this.uiManager.gravityXInput.value);
    const gravityY = parseFloat(this.uiManager.gravityYInput.value);
    const gravityScale = parseFloat(this.uiManager.gravityScaleInput.value);
    const enableSleeping = this.uiManager.worldEnableSleepingCheckbox.checked;
    const timeScale = parseFloat(this.uiManager.worldTimeScaleInput.value);

    const initialPayload = { options: {} };
    if (!isNaN(gravityX) && !isNaN(gravityY)) {
      initialPayload.gravity = { x: gravityX, y: gravityY };
      if (!isNaN(gravityScale) && gravityScale !== 0.001) {
        initialPayload.gravity.scale = gravityScale;
      }
    }
    if (enableSleeping !== undefined) {
      initialPayload.options.enableSleeping = enableSleeping;
    }
    if (!isNaN(timeScale) && timeScale !== 1) {
      initialPayload.options.timing = { timeScale: timeScale };
    }

    this.physicsClient?.initWorld(initialPayload);
  }

  handleWorldInitialized(payload, commandId) {
    if (payload.success) {
      this.isWorldReadyForAdds = true; // SET FLAG HERE
      this.uiManager.setWorldInitializedButtonStates();
      this.uiManager.log(
        {
          type: "DEMO_SCENE_EVENT",
          note: "World initialized by worker. Adding static boundaries.",
          originalCommandId: commandId,
          payloadReceived: payload,
        },
        "client-event"
      );
      this.addStaticBoundaries();
    } else {
      this.isWorldReadyForAdds = false; // Ensure it's false on failure
    }
  }

  addStaticBoundaries() {
    const thickness = 50; // Common thickness for all walls
    const { width, height } = this.worldDimensions;

    const wallOptions = { isStatic: true, restitution: 0.5 };

    // Bottom wall
    const bottomWallPayload = {
      id: "boundary-bottom",
      type: "rectangle",
      x: width / 2,
      y: height + thickness / 2 - 10,
      width: width + thickness * 2,
      height: thickness,
      options: wallOptions,
    };
    this.pendingBodies.set(bottomWallPayload.id, bottomWallPayload);
    this.physicsClient?.sendMessage({
      type: CommandType.ADD_BODY,
      payload: bottomWallPayload,
    });

    // Left wall
    const leftWallPayload = {
      id: "boundary-left",
      type: "rectangle",
      x: thickness / 2,
      y: height / 2,
      width: thickness,
      height: height,
      options: wallOptions,
    };
    this.pendingBodies.set(leftWallPayload.id, leftWallPayload);
    this.physicsClient?.sendMessage({
      type: CommandType.ADD_BODY,
      payload: leftWallPayload,
    });

    // Right wall
    const rightWallPayload = {
      id: "boundary-right",
      type: "rectangle",
      x: width - thickness / 2,
      y: height / 2,
      width: thickness,
      height: height,
      options: wallOptions,
    };
    this.pendingBodies.set(rightWallPayload.id, rightWallPayload);
    this.physicsClient?.sendMessage({
      type: CommandType.ADD_BODY,
      payload: rightWallPayload,
    });

    this.uiManager.log(
      {
        type: "DEMO_SCENE",
        note: "Sent commands to add static U-boundaries.",
      },
      "client-event"
    );
  }

  handleBodyAdded(payload, commandId) {
    if (payload.success && this.pendingBodies.has(payload.id)) {
      const initialProps = this.pendingBodies.get(payload.id);
      let gameObject = null;
      const color = parseInt(
        Phaser.Display.Color.RandomRGB().color32.toString(16).substring(0, 6),
        16
      );

      this.uiManager.log(
        {
          type: "DEMO_SCENE_HANDLER",
          event: "handleBodyAdded",
          status: "Attempting to create visual",
          receivedPayloadId: payload.id,
          initialPropsFromPending: initialProps,
        },
        "client-event"
      );

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
      } else if (
        initialProps.type === "polygon" &&
        initialProps.sides &&
        initialProps.radius
      ) {
        const { sides, radius } = initialProps;
        const vertices = [];
        // Matter.js Bodies.polygon orients the first vertex along the positive x-axis from the center.
        // Phaser's polygon might draw differently, but we generate points around (0,0) then Phaser positions the whole shape.
        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * 2 * Math.PI;
          vertices.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle),
          });
        }
        // Phaser's Polygon takes an array of numbers [x1,y1, x2,y2,...] or an array of points [{x,y},...]
        // We've created an array of points, which is fine.
        gameObject = this.add.polygon(
          initialProps.x,
          initialProps.y,
          vertices,
          color
        );
        // Polygons in Phaser are filled by default. If stroke is needed: gameObject.setStrokeStyle(2, 0xffffff);
      }

      if (gameObject) {
        this.gameObjects.set(
          payload.id,
          Object.assign(gameObject, { bodyType: initialProps.type })
        );
        this.pendingBodies.delete(payload.id);
        this.uiManager.log(
          {
            type: "DEMO_SCENE_HANDLER",
            event: "handleBodyAdded",
            status: "Visual created and stored",
            bodyId: payload.id,
            gameObjectProperties: {
              x: gameObject.x,
              y: gameObject.y,
              type: initialProps.type,
            },
          },
          "client-event"
        );
        if (this.uiManager) {
          this.uiManager.updateRemovableBodyList(
            Array.from(this.gameObjects.keys())
          );
        }
      } else {
        this.uiManager.log(
          {
            type: "DEMO_SCENE_HANDLER",
            event: "handleBodyAdded",
            status: "Failed to create visual for body",
            bodyId: payload.id,
            initialPropsFromPending: initialProps,
          },
          "client-event"
        );
      }
    }
  }

  handleBodyRemoved(payload, commandId) {
    this.uiManager.log(
      {
        type: "WORKER_RESPONSE",
        subtype: "BODY_REMOVED",
        payload,
        commandId,
      },
      "worker-response"
    );
    if (payload.success && payload.id) {
      const existingObject = this.gameObjects.get(payload.id);
      if (existingObject) {
        this.uiManager.log(
          {
            type: "DEMO_SCENE_EVENT",
            note: `Destroying visual for ${payload.id}`,
          },
          "client-event"
        );
        existingObject.destroy();
        this.gameObjects.delete(payload.id);
      }
      this.pendingBodies.delete(payload.id);
      if (this.uiManager) {
        this.uiManager.updateRemovableBodyList(
          Array.from(this.gameObjects.keys())
        );
      }
    }
  }

  handleSimulationStepped(payload, commandId) {
    if (payload.success) {
      this.uiManager.log(
        {
          type: "DEMO_SCENE_HANDLER",
          event: "handleSimulationStepped",
          receivedBodiesCount: payload.bodies.length,
          allBodiesData: payload.bodies,
        },
        "client-event"
      );
      payload.bodies.forEach((bodyUpdate) => {
        const go = this.gameObjects.get(bodyUpdate.id);
        this.uiManager.log(
          {
            type: "DEMO_SCENE_HANDLER",
            event: "handleSimulationStepped_ForEach",
            bodyUpdateId: bodyUpdate.id,
            foundGameObject: !!go,
          },
          "client-event"
        );

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
    this.uiManager.log(
      {
        type: "WORKER_RESPONSE",
        subtype: "SIMULATION_ADVANCED_TIME_COMPLETED",
        payload,
        commandId,
      },
      "worker-response"
    );
    if (payload.success && payload.bodies) {
      this.uiManager.log(
        {
          type: "DEMO_SCENE_HANDLER",
          event: "handleSimulationAdvancedTimeCompleted",
          receivedBodiesCount: payload.bodies.length,
          allBodiesData: payload.bodies,
        },
        "client-event"
      );
      payload.bodies.forEach((bodyState) => {
        let gameObject = this.gameObjects.get(bodyState.id);
        this.uiManager.log(
          {
            type: "DEMO_SCENE_HANDLER",
            event: "handleSimulationAdvancedTimeCompleted_ForEach",
            bodyStateId: bodyState.id,
            foundGameObject: !!gameObject,
          },
          "client-event"
        );

        if (gameObject) {
          this.uiManager.log(
            {
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
            },
            "client-event"
          );
          gameObject.setPosition(bodyState.x, bodyState.y);
          gameObject.setAngle(Phaser.Math.RadToDeg(bodyState.angle));
        } else {
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

  update(_time, _delta) {
    // We get physics updates from the worker via messages
  }

  handleResize(gameSize, _baseSize, _displaySize, _resolution) {
    const newWidth = gameSize.width;
    const newHeight = gameSize.height;

    this.worldDimensions.width = newWidth;
    this.worldDimensions.height = newHeight;

    this.cameras.main.setSize(newWidth, newHeight);

    this.isWorldReadyForAdds = false;
    this.uiManager.log(
      {
        type: "PHASER_SCENE_RESIZE",
        note: `Canvas resized to ${newWidth}x${newHeight}. Re-initializing physics world. Existing bodies will be cleared.`,
        newDimensions: { width: newWidth, height: newHeight },
      },
      "client-event"
    );

    this.clearVisuals();
    this.pendingBodies.clear();
    this.lastUsedBodyId = 0;

    const gravityX = parseFloat(this.uiManager.gravityXInput.value);
    const gravityY = parseFloat(this.uiManager.gravityYInput.value);
    const gravityScale = parseFloat(this.uiManager.gravityScaleInput.value);
    const enableSleeping = this.uiManager.worldEnableSleepingCheckbox.checked;
    const timeScale = parseFloat(this.uiManager.worldTimeScaleInput.value);

    const initPayload = { options: {} };
    if (!isNaN(gravityX) && !isNaN(gravityY)) {
      initPayload.gravity = { x: gravityX, y: gravityY };
      if (!isNaN(gravityScale) && gravityScale !== 0.001) {
        initPayload.gravity.scale = gravityScale;
      }
    }
    if (enableSleeping !== undefined) {
      initPayload.options.enableSleeping = enableSleeping;
    }
    if (!isNaN(timeScale) && timeScale !== 1) {
      initPayload.options.timing = { timeScale: timeScale };
    }

    this.physicsClient?.initWorld(initPayload);
  }

  requestRemoveBodyById(bodyId) {
    if (bodyId) {
      this.uiManager.log(
        {
          type: "DEMO_ACTION_SCENE",
          note: `Scene sending REMOVE_BODY. ID: ${bodyId}`,
        },
        "client-event"
      );
      this.physicsClient?.sendMessage({
        type: CommandType.REMOVE_BODY,
        payload: { id: bodyId },
      });
    } else {
      this.uiManager.log(
        {
          type: "DEMO_ACTION_SCENE",
          note: "Scene received request to remove body, but ID was empty.",
        },
        "client-event"
      );
    }
  }
}

// --- Phaser Game Config ---
const phaserContainer = document.getElementById("phaser-container");

const config = {
  type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
  width: phaserContainer ? phaserContainer.clientWidth : 800,
  height: phaserContainer ? phaserContainer.clientHeight : 600,
  parent: "phaser-container", // Render into the div
  scene: [DemoScene],
  scale: {
    mode: Phaser.Scale.RESIZE, // Resize game canvas to fill the parent element
    autoCenter: Phaser.Scale.CENTER_BOTH, // Center the game canvas in the parent element
  },
};

// Start the game
const _game = new Phaser.Game(config);
