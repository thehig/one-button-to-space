import { GameObject } from "./GameObject";
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "🧩"; // Component emoji

/**
 * Interface for all components attached to GameObjects.
 * Defines the lifecycle methods managed by the GameObject.
 */
export interface IComponent {
  /**
   * The GameObject this component is attached to.
   * Set automatically when the component is added.
   */
  gameObject: GameObject;

  /**
   * Indicates if the component is currently active and should receive updates.
   * Managed by the component itself or its parent GameObject.
   */
  active: boolean;

  /**
   * Called once when the component is first added to a GameObject
   * and the GameObject is initialized within the scene.
   * Use this for initialization logic that might depend on other components
   * or the GameObject being fully set up.
   */
  awake(): void;

  /**
   * Called once after all components have been awoken, just before the first update.
   * Use this for setup that needs to happen after all other initializations.
   */
  start(): void;

  /**
   * Called every frame if the component is active.
   * Use this for logic that needs to run at the rendering framerate (visual updates, input polling).
   * @param deltaTimeS Time elapsed since the last frame in seconds.
   */
  update(deltaTimeS: number): void;

  /**
   * Called at a fixed rate, suitable for physics calculations or logic
   * that needs consistent timing independent of the framerate.
   * @param fixedDeltaTimeS The fixed time step duration in seconds.
   */
  fixedUpdate(fixedDeltaTimeS: number): void;

  /**
   * Called when the component or its parent GameObject is destroyed.
   * Use this to clean up resources, remove listeners, or unregister from systems.
   */
  destroy(): void;
}

/**
 * Abstract base class for components providing default implementations
 * and basic properties like activeness and the parent GameObject reference.
 */
export abstract class ComponentBase implements IComponent {
  public gameObject!: GameObject; // Set by GameObject upon adding
  public active: boolean = true;

  constructor() {
    // Logger.debug(LOGGER_SOURCE, `ComponentBase constructor for ${this.constructor.name}`);
  }

  // Default empty implementations for lifecycle methods
  awake(): void {
    // Logger.debug(LOGGER_SOURCE, `${this.constructor.name} awake on GameObject ${this.gameObject.id}`);
  }
  start(): void {
    // Logger.debug(LOGGER_SOURCE, `${this.constructor.name} start on GameObject ${this.gameObject.id}`);
  }
  update(deltaTimeS: number): void {
    /* Logger.debug(LOGGER_SOURCE, `${this.constructor.name} update`); */
  }
  fixedUpdate(fixedDeltaTimeS: number): void {
    /* Logger.debug(LOGGER_SOURCE, `${this.constructor.name} fixedUpdate`); */
  }
  destroy(): void {
    Logger.debug(
      LOGGER_SOURCE,
      `${this.constructor.name} destroy on GameObject ${this.gameObject?.id}`
    );
    this.active = false;
    // Basic cleanup - subclasses should call super.destroy() if overriding
  }
}
