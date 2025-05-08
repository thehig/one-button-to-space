import Phaser from "phaser";
import { PhysicsWorkerClient } from "../src/index.ts";
import { CommandType } from "../src/commands.ts";

const logOutput = document.getElementById("logOutput");
const initWorldButton = document.getElementById("initWorldButton");
const addRectButton = document.getElementById("addRectButton");
const addCircleButton = document.getElementById("addCircleButton");
const removeLastButton = document.getElementById("removeLastButton");
const stepButton = document.getElementById("stepButton");
const loopButton = document.getElementById("loopButton");
const terminateButton = document.getElementById("terminateButton");

let logCount = 0;
function logMessage(message) {
  logCount++;
  console.log(`[Demo Page] ${logCount}:`, message);
  logOutput.textContent =
    `${logCount}: ${JSON.stringify(message, null, 2)}\n\n` +
    logOutput.textContent;
  if (logCount > 100) {
    // Prevent excessively long log on page
    const lines = logOutput.textContent.split("\n");
    logOutput.textContent = lines.slice(0, 200).join("\n"); // Keep ~50 messages
  }
}

logMessage({
  type: "CLIENT_SCRIPT_LOADED",
  note: "Demo page script running.",
});

// --- Phaser Scene ---
class DemoScene extends Phaser.Scene {
  physicsClient = null;
  // Map to store Phaser game objects corresponding to physics bodies
  gameObjects = new Map();
  // Store initial properties needed for rendering
  pendingBodies = new Map();
  lastAddedBodyId = null;
  isLooping = false;
  loopEndTime = 0;

  constructor() {
    super({ key: "DemoScene" });
  }

  preload() {
    // No assets needed for simple shapes yet
  }

  create() {
    logMessage({
      type: "PHASER_SCENE_CREATE",
      note: "Phaser scene creating...",
    });
    this.physicsClient = new PhysicsWorkerClient();
    logMessage({
      type: "CLIENT_ATTEMPT_INIT",
      note: "PhysicsWorkerClient instantiated in scene.",
    });

    this.physicsClient.onMessage((message) => {
      logMessage(message);

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

    this.setupUIListeners();
  }

  setupUIListeners() {
    initWorldButton.onclick = () => {
      logMessage({
        type: "DEMO_ACTION",
        note: "INIT_WORLD button clicked.",
      });
      this.physicsClient?.initWorld({
        width: 800,
        height: 600,
        gravity: { x: 0, y: 1, scale: 0.001 },
      });
      // Clear existing visuals
      this.gameObjects.forEach((go) => go.destroy());
      this.gameObjects.clear();
      this.pendingBodies.clear();
    };

    let bodyIdCounter = 0;
    addRectButton.onclick = () => {
      const id = `rect-${bodyIdCounter++}`;
      this.lastAddedBodyId = id;
      const payload = {
        id: id,
        type: "rectangle",
        x: Math.random() * 700 + 50,
        y: Math.random() * 100,
        width: Math.random() * 30 + 20,
        height: Math.random() * 30 + 20,
        options: { restitution: 0.7 },
      };
      logMessage({
        type: "DEMO_ACTION",
        note: `Sending ADD_BODY (rectangle). ID: ${id}`,
      });
      this.pendingBodies.set(id, payload); // Store properties needed for rendering
      this.physicsClient?.sendMessage({
        type: CommandType.ADD_BODY,
        payload,
      });
    };

    addCircleButton.onclick = () => {
      const id = `circle-${bodyIdCounter++}`;
      this.lastAddedBodyId = id;
      const payload = {
        id: id,
        type: "circle",
        x: Math.random() * 700 + 50,
        y: Math.random() * 100,
        radius: Math.random() * 15 + 10,
        options: { restitution: 0.7 },
      };
      logMessage({
        type: "DEMO_ACTION",
        note: `Sending ADD_BODY (circle). ID: ${id}`,
      });
      this.pendingBodies.set(id, payload); // Store properties needed for rendering
      this.physicsClient?.sendMessage({
        type: CommandType.ADD_BODY,
        payload,
      });
    };

    removeLastButton.onclick = () => {
      if (this.lastAddedBodyId !== null) {
        logMessage({
          type: "DEMO_ACTION",
          note: `Sending REMOVE_BODY. ID: ${this.lastAddedBodyId}`,
        });
        this.physicsClient?.sendMessage({
          type: CommandType.REMOVE_BODY,
          payload: { id: this.lastAddedBodyId },
        });
        this.lastAddedBodyId = null;
        removeLastButton.disabled = true;
      } else {
        logMessage({
          type: "DEMO_ACTION",
          note: "No body ID tracked to remove.",
        });
      }
    };

    stepButton.onclick = () => {
      if (this.isLooping) return;
      this.physicsClient?.sendMessage({
        type: CommandType.STEP_SIMULATION,
        payload: { deltaTime: 16.666 },
      });
    };

    loopButton.onclick = () => {
      if (this.isLooping) return;

      logMessage({
        type: "DEMO_ACTION",
        note: "Starting simulation loop for 5 seconds.",
      });
      this.isLooping = true;
      this.loopEndTime = Date.now() + 5000;
      this.disableLoopControls(true);

      const runStep = () => {
        if (!this.isLooping || Date.now() >= this.loopEndTime) {
          this.isLooping = false;
          this.disableLoopControls(false);
          logMessage({
            type: "DEMO_ACTION",
            note: "Simulation loop finished.",
          });
          return;
        }
        this.physicsClient?.sendMessage({
          type: CommandType.STEP_SIMULATION,
          payload: { deltaTime: 16.666 },
        });
        requestAnimationFrame(runStep);
      };
      requestAnimationFrame(runStep);
    };

    terminateButton.onclick = () => {
      this.isLooping = false;
      logMessage({
        type: "DEMO_ACTION",
        note: "Terminate button clicked.",
      });
      this.physicsClient?.terminate();
      // Disable UI, clear visuals
      initWorldButton.disabled = true;
      addRectButton.disabled = true;
      addCircleButton.disabled = true;
      stepButton.disabled = true;
      loopButton.disabled = true;
      terminateButton.disabled = true;
      this.gameObjects.forEach((go) => go.destroy());
      this.gameObjects.clear();
      this.pendingBodies.clear();
    };
  }

  disableLoopControls(disable) {
    initWorldButton.disabled = disable;
    addRectButton.disabled = disable;
    addCircleButton.disabled = disable;
    removeLastButton.disabled = disable;
    stepButton.disabled = disable;
    loopButton.disabled = disable;
  }

  handleWorkerReady() {
    initWorldButton.disabled = false;
    terminateButton.disabled = false;
    logMessage({
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
      addRectButton.disabled = false;
      addCircleButton.disabled = false;
      stepButton.disabled = false;
      loopButton.disabled = false;
      // Optional: Add static ground in Phaser visuals
      const ground = this.add.rectangle(400, 590, 800, 20, 0x888888);
      this.gameObjects.set("ground", ground); // Track it if needed
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
        removeLastButton.disabled = false;
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
        logMessage({
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
  update(time, delta) {
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
const game = new Phaser.Game(config);
logMessage({ type: "PHASER_INIT", note: "Phaser game instantiated." });
