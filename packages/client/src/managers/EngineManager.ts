import { InputManager } from "./InputManager";
import { NetworkManager } from "./NetworkManager";
import { EntityManager } from "./EntityManager";
import { PhysicsManager } from "./PhysicsManager";
import { SceneManager } from "./SceneManager";
import { TimeManager } from "./TimeManager";
import { CameraManager } from "./CameraManager";

export class EngineManager {
  private inputManager?: InputManager;
  private networkManager?: NetworkManager;
  private entityManager?: EntityManager;
  private physicsManager?: PhysicsManager;
  private sceneManager?: SceneManager;
  private timeManager?: TimeManager;
  private cameraManager?: CameraManager;

  // --- Registration ---

  public registerInputManager(manager: InputManager): void {
    this.inputManager = manager;
  }

  public registerNetworkManager(manager: NetworkManager): void {
    this.networkManager = manager;
  }

  public registerEntityManager(manager: EntityManager): void {
    this.entityManager = manager;
  }

  public registerPhysicsManager(manager: PhysicsManager): void {
    this.physicsManager = manager;
  }

  public registerSceneManager(manager: SceneManager): void {
    this.sceneManager = manager;
  }

  public registerTimeManager(manager: TimeManager): void {
    this.timeManager = manager;
  }

  public registerCameraManager(manager: CameraManager): void {
    this.cameraManager = manager;
  }

  // --- Accessors ---

  public getInputManager(): InputManager {
    if (!this.inputManager) throw new Error("InputManager not registered");
    return this.inputManager;
  }

  public getNetworkManager(): NetworkManager {
    if (!this.networkManager) throw new Error("NetworkManager not registered");
    return this.networkManager;
  }

  public getEntityManager(): EntityManager {
    if (!this.entityManager) throw new Error("EntityManager not registered");
    return this.entityManager;
  }

  public getPhysicsManager(): PhysicsManager {
    if (!this.physicsManager) throw new Error("PhysicsManager not registered");
    return this.physicsManager;
  }

  public getSceneManager(): SceneManager {
    if (!this.sceneManager) throw new Error("SceneManager not registered");
    return this.sceneManager;
  }

  public getTimeManager(): TimeManager {
    if (!this.timeManager) throw new Error("TimeManager not registered");
    return this.timeManager;
  }

  public getCameraManager(): CameraManager {
    if (!this.cameraManager) throw new Error("CameraManager not registered");
    return this.cameraManager;
  }

  // --- Lifecycle ---

  public async setup(): Promise<void> {
    console.log("EngineManager: Setting up all managers...");
    // Adjust setup order as needed. SceneManager likely sets up Phaser game instance.
    await this.timeManager?.setup();
    await this.sceneManager?.setup(); // Setup Phaser Game/Scenes
    await this.entityManager?.setup(); // Depends on Scene
    await this.physicsManager?.setup(); // Depends on Scene/Matter
    await this.networkManager?.setup(); // Connect to server
    await this.inputManager?.setup(); // Setup input listeners (needs scene)
    await this.cameraManager?.setup(); // Setup camera controls (needs scene)
    console.log("EngineManager: Setup complete.");
  }

  public teardown(): void {
    console.log("EngineManager: Tearing down all managers...");
    // Teardown in reverse order of setup might be safer
    this.cameraManager?.teardown();
    this.inputManager?.teardown();
    this.networkManager?.teardown();
    this.physicsManager?.teardown();
    this.entityManager?.teardown();
    this.sceneManager?.teardown();
    this.timeManager?.teardown();
    console.log("EngineManager: Teardown complete.");
  }
}
