import Phaser from "phaser";
import { PhysicsWorkerClient } from "../../src/index.ts";
import { CommandType } from "../../src/commands.ts";
import {
  PhysicsSyncState,
  BodyState,
  CollisionPair,
} from "../../src/schemas.ts";

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
    // No longer directly tied to WORLD_INITIALIZED as BODY_ADDED is removed
  }

  setBodyAddedButtonStates() {
    this.removeLastButton.disabled = false;
  }

  setBodyRemovedButtonStates() {
    // If lastAddedBodyId is null (handled by scene logic), disable button
    // This might need scene to inform UIManager, or UIManager checks scene.lastAddedBodyId
    // For now, listener itself disables it directly.
    // With schema, this state might be derived from the gameObjects map size
    if (this.scene.gameObjects.size === 0) {
      this.removeLastButton.disabled = true;
    }
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
    this.uiManager = new DemoUIManager(this); // Initialize UIManager here
    this.uiManager.log({ type: "PHASER_EVENT", event: "preload" });
  }

  create() {
    this.uiManager.log({ type: "PHASER_EVENT", event: "create_start" });
    this.uiManager.setupUIListeners();

    this.physicsClient = new PhysicsWorkerClient();
    this.uiManager.log({
      type: "WORKER_CLIENT_EVENT",
      note: "PhysicsWorkerClient instantiated.",
    });

    this.physicsClient.onMessage((message) => {
      // Log all messages for debugging, then handle based on type
      // this.uiManager.log({ type: "WORKER_MESSAGE_RAW", data: message });

      switch (message.type) {
        case CommandType.WORKER_READY:
          this.uiManager.log({
            type: "WORKER_MESSAGE",
            command: CommandType.WORKER_READY,
          });
          this.handleWorkerReady();
          break;
        case CommandType.WORLD_INITIALIZED:
          this.uiManager.log({
            type: "WORKER_MESSAGE",
            command: CommandType.WORLD_INITIALIZED,
            commandId: message.commandId,
          });
          this.handleWorldInitialized(message.payload);
          break;

        case CommandType.PHYSICS_STATE_UPDATE:
          this.uiManager.log({
            type: "WORKER_MESSAGE",
            command: CommandType.PHYSICS_STATE_UPDATE,
            note: "Received physics state update.",
            commandId: message.commandId,
          });
          this.handlePhysicsStateUpdate(message.payload);
          break;

        /* // Old handlers - to be removed or fully replaced by PHYSICS_STATE_UPDATE
        case CommandType.BODY_ADDED:
          this.uiManager.log({ type: "WORKER_MESSAGE", command: CommandType.BODY_ADDED, commandId: message.commandId });
          this.handleBodyAdded(message.payload);
          break;
        case CommandType.BODY_REMOVED:
          this.uiManager.log({ type: "WORKER_MESSAGE", command: CommandType.BODY_REMOVED, commandId: message.commandId });
          this.handleBodyRemoved(message.payload);
          break;
        case CommandType.SIMULATION_STEPPED:
          // Avoid spamming log for every step, but log if it has a commandId (manual step)
          if (message.commandId) {
            this.uiManager.log({ type: "WORKER_MESSAGE", command: CommandType.SIMULATION_STEPPED, commandId: message.commandId });
          }
          this.handleSimulationStepped(message.payload);
          break;
        case CommandType.PHYSICS_EVENTS:
          this.uiManager.log({ type: "WORKER_MESSAGE", command: CommandType.PHYSICS_EVENTS });
          this.handlePhysicsEvents(message.payload);
          break;
        */

        case CommandType.ERROR:
          this.uiManager.log({
            type: "WORKER_MESSAGE",
            command: CommandType.ERROR,
            error: message.payload,
            commandId: message.commandId,
          });
          console.error("Error from physics worker:", message.payload);
          break;
        default:
          this.uiManager.log({
            type: "WORKER_MESSAGE_UNKNOWN",
            unknownType: message.type,
            data: message,
          });
          console.warn(
            "Unknown message type from physics worker:",
            message.type
          );
      }
    });

    this.physicsClient.onError = (error) => {
      this.uiManager.log({ type: "WORKER_CLIENT_ERROR", error });
      console.error("Error with PhysicsWorkerClient:", error);
      this.uiManager.setTerminatedButtonStates();
    };

    // Terminate button listener
    if (this.uiManager.terminateButton) {
      this.uiManager.terminateButton.onclick = () => {
        this.uiManager.log({
          type: "DEMO_ACTION",
          note: "Terminate worker button clicked.",
        });
        this.physicsClient?.terminate();
        this.uiManager.log({
          type: "WORKER_CLIENT_EVENT",
          note: "Worker terminated by client.",
        });
        this.uiManager.setTerminatedButtonStates();
        this.isLooping = false; // Stop any active loops
      };
    }

    this.uiManager.log({ type: "PHASER_EVENT", event: "create_end" });
  }

  clearVisuals() {
    this.gameObjects.forEach((obj) => obj.destroy());
    this.gameObjects.clear();
    this.pendingBodies.clear();
    this.lastAddedBodyId = null;
    this.uiManager.log({ type: "DEMO_ACTION", note: "Visuals cleared." });
    // Potentially disable removeLastButton if UIManager is aware of gameObjects size
    if (this.uiManager.removeLastButton)
      this.uiManager.removeLastButton.disabled = true;
  }

  handleWorkerReady() {
    this.uiManager.setWorkerReadyButtonStates();
  }

  handleWorldInitialized(payload) {
    if (payload.success) {
      this.uiManager.setWorldInitializedButtonStates();
      // World is ready, existing bodies (if any from a previous state) should come via first state update.
      // If clearVisuals was called before initWorld, this is fine.
    } else {
      this.uiManager.log({
        type: "DEMO_ERROR",
        note: "World initialization failed.",
        payload,
      });
    }
  }

  handlePhysicsStateUpdate(encodedPayload) {
    try {
      const state = new PhysicsSyncState();
      // Assuming encodedPayload is ArrayBuffer or similar, directly from worker
      state.decode(encodedPayload);

      this.uiManager.log({
        type: CommandType.PHYSICS_STATE_UPDATE,
        state: state.toJSON(),
        note: "Decoded state",
      });

      // Update existing game objects and create new ones
      state.bodies.forEach((bodyData, id) => {
        let gameObject = this.gameObjects.get(id);
        if (!gameObject) {
          const initialPayload = this.pendingBodies.get(id);
          if (initialPayload) {
            this.uiManager.log({
              type: "DEMO_LOGIC",
              note: `Creating new visual for body ID: ${id}`,
              shape: initialPayload.type,
            });
            if (initialPayload.type === "rectangle") {
              gameObject = this.add.rectangle(
                bodyData.x,
                bodyData.y,
                initialPayload.width,
                initialPayload.height,
                0x00cc00 // A slightly different green for new schema-driven bodies
              );
            } else if (initialPayload.type === "circle") {
              gameObject = this.add.circle(
                bodyData.x,
                bodyData.y,
                initialPayload.radius,
                0xcc0000 // A slightly different red
              );
            }
            if (gameObject) {
              this.gameObjects.set(id, gameObject);
              this.pendingBodies.delete(id); // Clean up from pending
              this.uiManager.setBodyAddedButtonStates(); // Enable remove button if a body now exists
            }
          } else {
            this.uiManager.log({
              type: "DEMO_WARNING",
              note: `No pending body info for new ID: ${id}. Cannot create visual.`,
            });
          }
        }

        if (gameObject) {
          gameObject.setPosition(bodyData.x, bodyData.y);
          gameObject.setAngle(Phaser.Math.RadToDeg(bodyData.angle));
        }
      });

      // Remove game objects that are no longer in the state
      const currentGameObjectIds = Array.from(this.gameObjects.keys());
      for (const id of currentGameObjectIds) {
        if (!state.bodies.has(id)) {
          this.uiManager.log({
            type: "DEMO_LOGIC",
            note: `Removing visual for body ID: ${id}`,
          });
          const gameObject = this.gameObjects.get(id);
          if (gameObject) {
            gameObject.destroy();
          }
          this.gameObjects.delete(id);
          if (this.lastAddedBodyId === id) {
            // If the removed body was the last one added for UI tracking
            this.lastAddedBodyId = null; // TODO: Need better way to track "last added" for remove button
          }
        }
      }
      if (this.gameObjects.size === 0 && this.uiManager.removeLastButton) {
        this.uiManager.removeLastButton.disabled = true;
      }

      // Handle Collisions
      state.collisionEvents.forEach((collision) => {
        this.uiManager.log({
          type: "DEMO_COLLISION",
          bodyA: collision.bodyAId,
          bodyB: collision.bodyBId,
        });
        const bodyAVisual = this.gameObjects.get(collision.bodyAId);
        const bodyBVisual = this.gameObjects.get(collision.bodyBId);

        if (bodyAVisual) {
          bodyAVisual.setTint(0xffaa00); // Flash orange
          setTimeout(() => bodyAVisual.clearTint(), 150);
        }
        if (bodyBVisual) {
          bodyBVisual.setTint(0xffaa00); // Flash orange
          setTimeout(() => bodyBVisual.clearTint(), 150);
        }
      });
      state.collisionEvents.clear(); // Assuming collisions are per-step and should be cleared after processing
    } catch (error) {
      this.uiManager.log({
        type: "DEMO_ERROR",
        note: "Error decoding PHYSICS_STATE_UPDATE",
        error: error.message,
        stack: error.stack,
      });
      console.error("Error decoding PHYSICS_STATE_UPDATE:", error);
    }
  }

  /* // Old handler methods - can be removed or kept for reference if useful during transition
  handleBodyAdded(payload) {
    if (payload.success) {
      this.uiManager.setBodyAddedButtonStates();
      const originalBodyData = this.pendingBodies.get(payload.id);
      if (originalBodyData) {
        let gameObject;
        if (originalBodyData.type === "rectangle") {
          gameObject = this.add.rectangle(
            originalBodyData.x,
            originalBodyData.y,
            originalBodyData.width,
            originalBodyData.height,
            0x00ff00
          );
        } else if (originalBodyData.type === "circle") {
          gameObject = this.add.circle(
            originalBodyData.x,
            originalBodyData.y,
            originalBodyData.radius,
            0xff0000
          );
        }
        if (gameObject) {
          this.gameObjects.set(payload.id, gameObject);
        }
        this.pendingBodies.delete(payload.id);
      } else {
        this.uiManager.log({ type: "DEMO_ERROR", note: "BODY_ADDED success, but no pending data found for ID", id: payload.id });
      }
    } else {
      this.uiManager.log({ type: "DEMO_ERROR", note: "BODY_ADDED failed", payload });
      this.pendingBodies.delete(payload.id); // Clean up if add failed
      if (this.lastAddedBodyId === payload.id) {
        this.lastAddedBodyId = null; // Reset if the failed body was the last one
      }
    }
  }

  handleBodyRemoved(payload) {
    if (payload.success) {
      const gameObject = this.gameObjects.get(payload.id);
      if (gameObject) {
        gameObject.destroy();
        this.gameObjects.delete(payload.id);
        this.uiManager.log({ type: "DEMO_LOGIC", note: `Visual for body ID: ${payload.id} removed` });
      } else {
        this.uiManager.log({ type: "DEMO_WARNING", note: `BODY_REMOVED success, but no visual found for ID: ${payload.id}` });
      }
      if (this.lastAddedBodyId === payload.id) {
        this.lastAddedBodyId = null; // Clear if this was the one for UI
      }
      if (this.gameObjects.size === 0 && this.uiManager.removeLastButton) {
        this.uiManager.removeLastButton.disabled = true;
      }
    } else {
      this.uiManager.log({ type: "DEMO_ERROR", note: "BODY_REMOVED failed", payload });
    }
  }

  handleSimulationStepped(payload) {
    if (payload.success && payload.bodies) {
      payload.bodies.forEach((bodyData) => {
        const gameObject = this.gameObjects.get(bodyData.id);
        if (gameObject) {
          gameObject.setPosition(bodyData.x, bodyData.y);
          gameObject.setAngle(Phaser.Math.RadToDeg(bodyData.angle)); // Convert radians to degrees for Phaser
        }
      });
    } else if (!payload.success) {
       this.uiManager.log({ type: "DEMO_ERROR", note: "SIMULATION_STEPPED failed", payload });
    }
  }

  handlePhysicsEvents(payload) {
    if (payload.collisions) {
      payload.collisions.forEach((collision) => {
        this.uiManager.log({ type: "DEMO_COLLISION", bodyA: collision.bodyAId, bodyB: collision.bodyBId });
        const bodyAVisual = this.gameObjects.get(collision.bodyAId);
        const bodyBVisual = this.gameObjects.get(collision.bodyBId);

        // Example: make bodies flash on collision
        if (bodyAVisual) {
          bodyAVisual.setTint(0xffaa00); // Flash orange
          setTimeout(() => bodyAVisual.clearTint(), 150);
        }
        if (bodyBVisual) {
          bodyBVisual.setTint(0xffaa00); // Flash orange
          setTimeout(() => bodyBVisual.clearTint(), 150);
        }
      });
    }
  }
  */

  update(time, delta) {
    // The simulation loop is now driven by requestAnimationFrame within the loopButton onclick
    // or manual stepButton clicks. Main Phaser update loop is not directly stepping the physics worker here.
  }
}

// --- Phaser Game Config ---
const config = {
  type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
  width: 800,
  height: 600,
  parent: "phaser-container", // Render into the div
  scene: [DemoScene],
  backgroundColor: "#f0f0f0",
};

// Start the game
const game = new Phaser.Game(config);
// logMessage({ type: "PHASER_INIT", note: "Phaser game instantiated." }); // Will be logged by UIManager if needed, or scene
// The DemoUIManager's constructor now handles the initial script load message.
// The final Phaser init message can be logged by the scene after game creation if desired.
// For now, DemoScene.create logs its own creation.
// If a global "Phaser game instantiated" log is critical, it can be added via uiManager after game creation.
// Example: if (game) { uiManagerInstanceFromSomewhere.log({ type: "PHASER_INIT", note: "Phaser game instantiated." }); }
// However, the current script structure makes a global uiManager instance tricky without further refactoring.
// The DemoScene's uiManager is the most straightforward way to log now.
