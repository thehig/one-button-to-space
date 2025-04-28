import Phaser from "phaser";
import { IComponent } from "./IComponent";
import { Logger, LogLevel } from "@one-button-to-space/shared";
import { MainScene } from "../scenes/MainScene"; // Adjust path as needed

const LOGGER_SOURCE = "📦✨"; // GameObject emoji

let nextGameObjectId = 0;

/**
 * Represents a fundamental entity in the game scene.
 * Manages components, transform, and hierarchy.
 */
export class GameObject {
  public readonly id: number;
  public name: string;
  public active: boolean = true;
  public scene: MainScene; // Make scene reference mandatory

  // Hierarchy
  public parent: GameObject | null = null;
  public readonly children: GameObject[] = [];

  // Transform (relative to parent)
  private _x: number = 0;
  private _y: number = 0;
  private _rotation: number = 0;
  private _scaleX: number = 1;
  private _scaleY: number = 1;

  // Components
  private readonly components: Map<Function, IComponent> = new Map(); // Use constructor as key
  public isAwake: boolean = false;
  public isStarted: boolean = false;
  public isDestroyed: boolean = false;

  constructor(
    scene: MainScene,
    name: string = "GameObject",
    x: number = 0,
    y: number = 0
  ) {
    this.id = nextGameObjectId++;
    this.scene = scene;
    this.name = `${name}_${this.id}`;
    this.x = x;
    this.y = y;

    // Logger.debug(LOGGER_SOURCE, `Created ${this.name} (ID: ${this.id})`);
    // Register with the scene
    this.scene.addGameObject(this);
    Logger.trace(
      LOGGER_SOURCE,
      `${this.name}: Added to scene's managed objects via constructor.`
    );
  }

  // --- Transform Getters/Setters ---
  get x(): number {
    return this._x;
  }
  set x(value: number) {
    this._x = value;
    // TODO: Mark transform dirty if needed for optimization
  }

  get y(): number {
    return this._y;
  }
  set y(value: number) {
    this._y = value;
  }

  get rotation(): number {
    return this._rotation;
  }
  set rotation(value: number) {
    this._rotation = value;
  }

  get scaleX(): number {
    return this._scaleX;
  }
  set scaleX(value: number) {
    this._scaleX = value;
  }

  get scaleY(): number {
    return this._scaleY;
  }
  set scaleY(value: number) {
    this._scaleY = value;
  }

  // --- World Transform Helpers (Consider caching if performance becomes an issue) ---
  public getWorldX(): number {
    if (this.parent) {
      // Basic parent transform application (no rotation/scale yet)
      return this.parent.getWorldX() + this.x; // Add basic parent rotation/scale later
    } else {
      return this.x;
    }
  }

  public getWorldY(): number {
    if (this.parent) {
      return this.parent.getWorldY() + this.y;
    } else {
      return this.y;
    }
  }

  // --- Hierarchy Management ---
  public addChild(child: GameObject): void {
    if (child.parent === this) return; // Already a child
    if (child.parent) {
      child.parent.removeChild(child); // Remove from previous parent
    }
    child.parent = this;
    this.children.push(child);
    // Logger.debug(LOGGER_SOURCE, `Added ${child.name} as child of ${this.name}`);
  }

  public removeChild(child: GameObject): void {
    const index = this.children.indexOf(child);
    if (index !== -1) {
      child.parent = null;
      this.children.splice(index, 1);
      // Logger.debug(LOGGER_SOURCE, `Removed ${child.name} from ${this.name}`);
    }
  }

  // --- Component Management ---

  /**
   * Adds a component instance to this GameObject.
   * @param component The component instance to add.
   * @returns The added component instance.
   */
  public addComponent<T extends IComponent>(component: T): T {
    const componentType = component.constructor as Function;
    if (this.components.has(componentType)) {
      Logger.warn(
        LOGGER_SOURCE,
        `${this.name} already has a component of type ${componentType.name}. Replacing is not supported, returning existing.`
      );
      return this.components.get(componentType) as T;
    }

    component.gameObject = this; // Set the back-reference
    this.components.set(componentType, component);

    // If the GameObject is already awake/started, call the lifecycle methods immediately
    if (this.isAwake) {
      try {
        component.awake();
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Error in ${component.constructor.name}.awake() on ${this.name}:`,
          error
        );
      }
      if (this.isStarted) {
        try {
          component.start();
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${component.constructor.name}.start() on ${this.name}:`,
            error
          );
        }
      }
    }

    // Logger.debug(LOGGER_SOURCE, `Added component ${componentType.name} to ${this.name}`);
    return component;
  }

  /**
   * Retrieves a component of a specific type attached to this GameObject.
   * @param componentType The constructor of the component type to retrieve (e.g., SpriteRenderer).
   * @returns The component instance, or undefined if not found.
   */
  public getComponent<T extends IComponent>(
    componentType: new (...args: any[]) => T
  ): T | undefined {
    return this.components.get(componentType) as T | undefined;
  }

  /**
   * Checks if a component of a specific type is attached.
   * @param componentType The constructor of the component type.
   * @returns True if the component exists, false otherwise.
   */
  public hasComponent<T extends IComponent>(
    componentType: new (...args: any[]) => T
  ): boolean {
    return this.components.has(componentType);
  }

  /**
   * Removes a component of a specific type from this GameObject.
   * @param componentType The constructor of the component type to remove.
   */
  public removeComponent<T extends IComponent>(
    componentType: new (...args: any[]) => T
  ): void {
    const component = this.components.get(componentType);
    if (component) {
      try {
        component.destroy(); // Call component's destroy method
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Error in ${component.constructor.name}.destroy() on ${this.name}:`,
          error
        );
      }
      this.components.delete(componentType);
      // Logger.debug(LOGGER_SOURCE, `Removed component ${componentType.name} from ${this.name}`);
    }
  }

  // --- Internal Lifecycle Methods (Called by Scene) ---

  /** Called by the Scene once after creation. Calls awake on all components. */
  public _internalAwake(): void {
    if (this.isAwake || this.isDestroyed) return;
    Logger.debug(LOGGER_SOURCE, `${this.name} _internalAwake`);
    this.components.forEach((component) => {
      if (component.active) {
        try {
          component.awake();
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${component.constructor.name}.awake() on ${this.name}:`,
            error
          );
        }
      }
    });
    this.isAwake = true;
  }

  /** Called by the Scene once after awake. Calls start on all components. */
  public _internalStart(): void {
    if (!this.isAwake || this.isStarted || this.isDestroyed) return;
    Logger.debug(LOGGER_SOURCE, `${this.name} _internalStart`);
    this.components.forEach((component) => {
      if (component.active) {
        try {
          component.start();
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${component.constructor.name}.start() on ${this.name}:`,
            error
          );
        }
      }
    });
    this.isStarted = true;
  }

  /** Called by the Scene every frame. Calls update on all active components. */
  public _internalUpdate(deltaTimeS: number): void {
    if (!this.active || !this.isStarted || this.isDestroyed) return;
    // Logger.debug(LOGGER_SOURCE, `${this.name} _internalUpdate`);
    this.components.forEach((component) => {
      if (component.active) {
        try {
          component.update(deltaTimeS);
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${component.constructor.name}.update() on ${this.name}:`,
            error
          );
        }
      }
    });
  }

  /** Called by the Scene at fixed intervals. Calls fixedUpdate on all active components. */
  public _internalFixedUpdate(fixedDeltaTimeS: number): void {
    if (!this.active || !this.isStarted || this.isDestroyed) return;
    // Logger.debug(LOGGER_SOURCE, `${this.name} _internalFixedUpdate`);
    this.components.forEach((component) => {
      if (component.active) {
        try {
          component.fixedUpdate(fixedDeltaTimeS);
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${component.constructor.name}.fixedUpdate() on ${this.name}:`,
            error
          );
        }
      }
    });
  }

  /** Destroys the GameObject, its components, and removes it from the scene and parent. */
  public destroy(): void {
    if (this.isDestroyed) return;
    Logger.info(LOGGER_SOURCE, `Destroying ${this.name} (ID: ${this.id})`);
    this.isDestroyed = true;
    this.active = false;

    // Destroy components first (iterate backwards or on a copy in case destroy modifies map)
    [...this.components.values()].forEach((component) => {
      try {
        component.destroy();
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Error destroying component ${component.constructor.name} on ${this.name}:`,
          error
        );
      }
    });
    this.components.clear();

    // Remove from parent
    if (this.parent) {
      this.parent.removeChild(this);
    }

    // Destroy children (make copies of arrays to avoid issues during iteration)
    [...this.children].forEach((child) => child.destroy());
    this.children.length = 0; // Clear array

    // Unregister from the scene
    this.scene.removeGameObject(this);

    Logger.debug(LOGGER_SOURCE, `${this.name} destroyed successfully.`);
  }
}
