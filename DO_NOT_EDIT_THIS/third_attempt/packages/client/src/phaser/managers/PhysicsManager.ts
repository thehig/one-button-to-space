import Phaser from "phaser";
import { PhysicsEngine } from "../../../../shared/src/physics/PhysicsEngine";
import { FIXED_TIMESTEP } from "../../../../shared/src/physics/constants";
import Matter from "matter-js"; // Need direct access for Body type
import { CommunicationManager } from "./CommunicationManager"; // Import CommunicationManager

export default class PhysicsManager {
  private scene: Phaser.Scene;
  private physicsEngine!: PhysicsEngine;
  private accumulator: number = 0;
  private communicationManager: CommunicationManager; // Add property
  // Map to link Phaser GameObjects to Matter Bodies (if needed for updates)
  private gameObjectToBodyMap: Map<Phaser.GameObjects.GameObject, Matter.Body> =
    new Map();
  private bodyToGameObjectMap: Map<number, Phaser.GameObjects.GameObject> =
    new Map(); // Map by Matter Body ID

  constructor(scene: Phaser.Scene, communicationManager: CommunicationManager) {
    // Add parameter
    this.scene = scene;
    this.communicationManager = communicationManager; // Store instance
    this.communicationManager.logEvent("PhysicsManager", "constructor");
  }

  init() {
    this.communicationManager.logEvent("PhysicsManager", "initStart");
    // Initialize physics settings, possibly based on shared config
    this.communicationManager.logEvent(
      "PhysicsManager",
      "initializingSharedEngine"
    );
    // TODO: Pass logger to PhysicsEngine when it's refactored
    // For now, PhysicsEngine will still use console.log
    this.physicsEngine = new PhysicsEngine();
    this.communicationManager.logEvent(
      "PhysicsManager",
      "sharedEngineInitialized"
    );
    // No need to call startRunner if we use manualStep
    this.communicationManager.logEvent("PhysicsManager", "initComplete");
  }

  create() {
    this.communicationManager.logEvent("PhysicsManager", "create");
    // Set up world bounds, collision layers, etc. via physicsEngine if needed
    // Example: Add ground if not done in PhysicsEngine constructor
    // const ground = Matter.Bodies.rectangle(400, 610, 810, 60, { isStatic: true, label: 'ground' });
    // this.physicsEngine.addBody(ground);
  }

  // Correlate a Phaser GameObject with a Matter.js Body
  addMapping(gameObject: Phaser.GameObjects.GameObject, body: Matter.Body) {
    this.gameObjectToBodyMap.set(gameObject, body);
    this.bodyToGameObjectMap.set(body.id, gameObject);
  }

  // Remove the correlation
  removeMapping(gameObject: Phaser.GameObjects.GameObject) {
    const body = this.gameObjectToBodyMap.get(gameObject);
    if (body) {
      this.gameObjectToBodyMap.delete(gameObject);
      this.bodyToGameObjectMap.delete(body.id);
    }
  }

  // Get Matter Body associated with a GameObject
  getBody(gameObject: Phaser.GameObjects.GameObject): Matter.Body | undefined {
    return this.gameObjectToBodyMap.get(gameObject);
  }

  // Get GameObject associated with a Matter Body ID
  getGameObject(bodyId: number): Phaser.GameObjects.GameObject | undefined {
    return this.bodyToGameObjectMap.get(bodyId);
  }

  update(time: number, delta: number) {
    // Fixed timestep update logic
    this.accumulator += delta;

    const fixedTimestampMillis = FIXED_TIMESTEP;
    let stepped = false; // Flag to see if step happens

    while (this.accumulator >= fixedTimestampMillis) {
      this.physicsEngine.manualStep(fixedTimestampMillis); // Step the engine
      this.accumulator -= fixedTimestampMillis;
      stepped = true;
      // console.log(`PhysicsManager: Stepped engine by ${fixedTimestampMillis}ms`); // Add log inside loop
    }

    // if (stepped) { // Optional: only log body state if a step occurred
    //    console.log(`PhysicsManager: Update after step(s). Accumulator: ${this.accumulator.toFixed(2)}ms`);
    // }

    // Sync Phaser GameObject positions with Matter body positions
    this.bodyToGameObjectMap.forEach((gameObject, bodyId) => {
      const body = this.physicsEngine.getBodyById(bodyId);
      if (body && gameObject.active) {
        // Log body properties BEFORE applying them to GameObject
        // Check the player body (ID 1)
        // if (body.id === 1) {
        //   console.log(
        //     `PhysicsManager: Body ${
        //       body.id
        //     } (Player) - Pos: (${body.position.x.toFixed(
        //       2
        //     )}, ${body.position.y.toFixed(2)}), Vel: (${body.velocity.x.toFixed(
        //       2
        //     )}, ${body.velocity.y.toFixed(2)}), isStatic: ${body.isStatic}`
        //   );
        // }

        gameObject.setPosition(body.position.x, body.position.y);
        gameObject.setRotation(body.angle);
      } else if (!body) {
        // Body might have been removed from physics engine, remove mapping
        // console.warn(
        //   `PhysicsManager: Body ID ${bodyId} not found in engine. Removing mapping.`
        // );
        this.communicationManager.logEvent(
          "PhysicsManager",
          "bodyNotFoundWarning",
          { bodyId } // Include missing ID
        );
        // Need the corresponding GameObject to remove mapping fully
        // This case needs careful handling - perhaps removal should manage mappings
        this.bodyToGameObjectMap.delete(bodyId);
        // We don't have the gameObject readily here to remove from the other map
      }
    });

    // --- Debug Rendering (Optional) ---
    // If you have a graphics object for debug drawing:
    // graphics.clear();
    // const bodies = this.physicsEngine.getAllBodies();
    // graphics.lineStyle(1, 0x00ff00, 1);
    // bodies.forEach(body => {
    //     graphics.strokePoints(body.vertices, true, true);
    //     // Draw position marker
    //     graphics.fillStyle(0xff0000, 1);
    //     graphics.fillCircle(body.position.x, body.position.y, 2);
    // });
  }

  shutdown() {
    this.communicationManager.logEvent("PhysicsManager", "shutdownStart");
    // Clean up physics engine
    if (this.physicsEngine) {
      this.physicsEngine.destroy();
      // @ts-ignore - Explicitly nullify to help GC and prevent accidental use
      this.physicsEngine = null;
    }
    this.gameObjectToBodyMap.clear();
    this.bodyToGameObjectMap.clear();
    this.communicationManager.logEvent("PhysicsManager", "shutdownComplete");
  }

  // Expose engine methods if needed by other managers (use carefully)
  getEngine(): PhysicsEngine {
    return this.physicsEngine;
  }

  // --- Body Creation / Deletion with Mapping ---

  createAndMapBody(
    gameObject: Phaser.GameObjects.GameObject,
    type: string,
    x: number,
    y: number,
    options?: Matter.IBodyDefinition
  ): Matter.Body | null {
    let body: Matter.Body | null = null;

    // Use the shared engine's creation methods based on type
    switch (type) {
      case "rocket": // Match type expected by shared engine
      case "player": // Treat player as a rocket for physics
        body = this.physicsEngine.createRocket(x, y, options);
        break;
      case "planet":
        // Example: Need radius for planet
        const radius = (options?.plugin as any)?.radius || 50; // Get radius from options or default
        body = this.physicsEngine.createPlanet(x, y, radius, options);
        break;
      case "debris":
        // Example: Need size for debris
        const size = (options?.plugin as any)?.size || 10;
        body = this.physicsEngine.createDebris(x, y, size, options);
        break;
      // Add more types as needed
      default:
        this.communicationManager.logEvent(
          "PhysicsManager",
          "unknownBodyTypeWarning",
          { type } // Include type in payload
        );
        return null;
    }

    if (body) {
      this.communicationManager.logEvent(
        "PhysicsManager",
        "matterBodyCreated",
        { bodyId: body.id, type: type } // Include id and type
      );
      this.physicsEngine.addBody(body);
      this.addMapping(gameObject, body);
      // IMPORTANT: Sync initial GameObject position AFTER body creation and mapping
      gameObject.setPosition(body.position.x, body.position.y);
      gameObject.setRotation(body.angle);
    } else {
      this.communicationManager.logEvent(
        "PhysicsManager",
        "failedToCreateBodyError", // Use a more specific name for errors
        { type } // Include type
      );
    }
    return body;
  }

  removeBodyAndMapping(gameObject: Phaser.GameObjects.GameObject) {
    const body = this.getBody(gameObject);
    if (body) {
      this.communicationManager.logEvent(
        "PhysicsManager",
        "removingMatterBody",
        { bodyId: body.id } // Include ID
      );
      this.removeMapping(gameObject); // Remove mapping first
      this.physicsEngine.removeBody(body); // Then remove from engine
    } else {
      this.communicationManager.logEvent(
        "PhysicsManager",
        "removeNonMappedBodyWarning", // Use a more specific name for warnings
        { gameObjectId: (gameObject as any).id || "unknown" } // Log GameObject ID if available
      );
    }
  }
}
