import Phaser from "phaser";
import { PhysicsWorkerClient } from "../../src/index.ts";
import { CommandType } from "../../src/commands.ts";

class DemoUIManager {
  logOutput = null;
  logCount = 0;
  scene = null; // To call methods on DemoScene

  // Button elements
  initWorldButton = null;
  addRectButton = null;
  addCircleButton = null;
  removeLastButton = null;
  stepButton = null;
  loopButton = null;
  terminateButton = null;

  constructor(scene) {
    this.scene = scene;
    this.logOutput = document.getElementById("logOutput");
    if (this.logOutput) {
      this.logOutput.textContent = ""; // Clear initial "Initializing..." text
    }

    // Get button elements
    this.initWorldButton = document.getElementById("initWorldButton");
    this.addRectButton = document.getElementById("addRectButton");
    this.addCircleButton = document.getElementById("addCircleButton");
    this.removeLastButton = document.getElementById("removeLastButton");
    this.stepButton = document.getElementById("stepButton");
    this.loopButton = document.getElementById("loopButton");
    this.terminateButton = document.getElementById("terminateButton");

    this._logMessage({
      type: "CLIENT_SCRIPT_LOADED",
      note: "Demo page script and UIManager initialized.",
    });
    this.setInitialButtonStates(); // Initial state before worker ready
  }

  _logMessage(message) {
    this.logCount++;
    const formattedMessage = `${this.logCount}: ${JSON.stringify(
      message,
      null,
      2
    )}\n\n`;
    console.log(`[Demo Page UI Manager] ${this.logCount}:`, message);

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
    this.addRectButton.disabled = true;
    this.addCircleButton.disabled = true;
    this.removeLastButton.disabled = true;
    this.stepButton.disabled = true;
    this.loopButton.disabled = true;
    this.terminateButton.disabled = true; // Enabled once worker is ready
  }

  setWorkerReadyButtonStates() {
    this.initWorldButton.disabled = false;
    this.terminateButton.disabled = false;
  }

  setWorldInitializedButtonStates() {
    this.addRectButton.disabled = false;
    this.addCircleButton.disabled = false;
    this.stepButton.disabled = false;
    this.loopButton.disabled = false;
    // removeLastButton is enabled when a body is added
  }

  setBodyAddedButtonStates() {
    this.removeLastButton.disabled = false;
  }

  setBodyRemovedButtonStates() {
    // If lastAddedBodyId is null (handled by scene logic), disable button
    // This might need scene to inform UIManager, or UIManager checks scene.lastAddedBodyId
    // For now, listener itself disables it directly.
  }

  disableLoopControls(disable) {
    this.initWorldButton.disabled = disable;
    this.addRectButton.disabled = disable;
    this.addCircleButton.disabled = disable;
    this.removeLastButton.disabled = disable; // Should be careful here if a body exists
    this.stepButton.disabled = disable;
    this.loopButton.disabled = disable; // The loop button itself
  }

  setTerminatedButtonStates() {
    this.initWorldButton.disabled = true;
    this.addRectButton.disabled = true;
    this.addCircleButton.disabled = true;
    this.removeLastButton.disabled = true;
    this.stepButton.disabled = true;
    this.loopButton.disabled = true;
    this.terminateButton.disabled = true;
  }

  // --- UI Event Listeners ---
  setupUIListeners() {
    this.initWorldButton.onclick = () => {
      this.log({ type: "DEMO_ACTION", note: "INIT_WORLD button clicked." });
      this.scene.physicsClient?.initWorld({
        width: 800,
        height: 600,
        gravity: { x: 0, y: 1, scale: 0.001 },
      });
      this.scene.clearVisuals();
    };

    let bodyIdCounter = 0;
    this.addRectButton.onclick = () => {
      const id = `rect-${bodyIdCounter++}`;
      this.scene.lastAddedBodyId = id;
      const payload = {
        id,
        type: "rectangle",
        x: Math.random() * 700 + 50,
        y: Math.random() * 100,
        width: Math.random() * 30 + 20,
        height: Math.random() * 30 + 20,
        options: { restitution: 0.7 },
      };
      this.log({
        type: "DEMO_ACTION",
        note: `Sending ADD_BODY (rectangle). ID: ${id}`,
      });
      this.scene.pendingBodies.set(id, payload);
      this.scene.physicsClient?.sendMessage({
        type: CommandType.ADD_BODY,
        payload,
      });
    };

    this.addCircleButton.onclick = () => {
      const id = `circle-${bodyIdCounter++}`;
      this.scene.lastAddedBodyId = id;
      const payload = {
        id,
        type: "circle",
        x: Math.random() * 700 + 50,
        y: Math.random() * 100,
        radius: Math.random() * 15 + 10,
        options: { restitution: 0.7 },
      };
      this.log({
        type: "DEMO_ACTION",
        note: `Sending ADD_BODY (circle). ID: ${id}`,
      });
      this.scene.pendingBodies.set(id, payload);
      this.scene.physicsClient?.sendMessage({
        type: CommandType.ADD_BODY,
        payload,
      });
    };

    this.removeLastButton.onclick = () => {
      if (this.scene.lastAddedBodyId !== null) {
        this.log({
          type: "DEMO_ACTION",
          note: `Sending REMOVE_BODY. ID: ${this.scene.lastAddedBodyId}`,
        });
        this.scene.physicsClient?.sendMessage({
          type: CommandType.REMOVE_BODY,
          payload: { id: this.scene.lastAddedBodyId },
        });
        this.scene.lastAddedBodyId = null;
        this.removeLastButton.disabled = true; // Managed by listener for now
      } else {
        this.log({
          type: "DEMO_ACTION",
          note: "No body ID tracked to remove.",
        });
      }
    };

    this.stepButton.onclick = () => {
      if (this.scene.isLooping) return;
      this.scene.physicsClient?.sendMessage({
        type: CommandType.STEP_SIMULATION,
        payload: { deltaTime: 16.666 },
      });
    };

    this.loopButton.onclick = () => {
      if (this.scene.isLooping) return;
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
  lastAddedBodyId = null;
  isLooping = false;
  loopEndTime = 0;
  uiManager = null;

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
      // Use UIManager for logging
      type: "CLIENT_ATTEMPT_INIT",
      note: "PhysicsWorkerClient instantiated in scene.",
    });

    this.physicsClient.onMessage((message) => {
      this.uiManager.log(message); // Log all incoming worker messages

      switch (message.type) {
        case CommandType.WORKER_READY:
          this.handleWorkerReady();
          break;
        case CommandType.WORLD_INITIALIZED:
          this.handleWorldInitialized(message.payload);
          break;
        case CommandType.BODY_ADDED:
          this.handleBodyAdded(message.payload);
          break;
        case CommandType.BODY_REMOVED:
          this.handleBodyRemoved(message.payload);
          break;
        case CommandType.SIMULATION_STEPPED:
          this.handleSimulationStepped(message.payload);
          break;
        case CommandType.PHYSICS_EVENTS:
          this.handlePhysicsEvents(message.payload);
          break;
        case CommandType.ERROR:
          console.error("Error from worker:", message.payload);
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
    this.physicsClient?.initWorld({
      width: 800,
      height: 600,
      gravity: { x: 0, y: 1, scale: 0.001 },
    });
  }

  handleWorldInitialized(payload) {
    if (payload.success) {
      this.uiManager.setWorldInitializedButtonStates();
      const ground = this.add.rectangle(400, 590, 800, 20, 0x888888);
      this.gameObjects.set("ground", ground);
    }
  }

  handleBodyAdded(payload) {
    if (payload.success && this.pendingBodies.has(payload.id)) {
      const initialProps = this.pendingBodies.get(payload.id);
      let gameObject = null;
      const color = Phaser.Display.Color.RandomRGB().color;

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
        this.lastAddedBodyId = payload.id;
        this.uiManager.setBodyAddedButtonStates();
      }
      this.pendingBodies.delete(payload.id); // Clean up
    }
  }

  handleBodyRemoved(payload) {
    if (payload.success && payload.id) {
      const go = this.gameObjects.get(payload.id);
      if (go) {
        go.destroy();
        this.gameObjects.delete(payload.id);
        this.uiManager.log({
          // Use UIManager for logging
          type: "PHASER_ACTION",
          note: `Destroyed visual for body ID: ${payload.id}`,
        });
      }
    }
  }

  handleSimulationStepped(payload) {
    if (payload.success) {
      payload.bodies.forEach((bodyUpdate) => {
        const go = this.gameObjects.get(bodyUpdate.id);

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
