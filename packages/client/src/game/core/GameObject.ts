import Phaser from "phaser";
import { IComponent } from "./IComponent";
import { Logger } from "@one-button-to-space/shared";

const LOGGER_SOURCE = "🧱🔩"; // Building block/Structure emojis

let nextGameObjectId = 0;

/**
 * Represents an entity in the game world.
 * Manages components, hierarchy, and local transform.
 * Designed to be managed by a Phaser.Scene.
 */
export class GameObject {
  public readonly id: number;
  public name: string;
  public active: boolean = true;
  public readonly scene: Phaser.Scene; // Reference to the Phaser scene

  // Basic Transform (Local)
  public x: number = 0;
  public y: number = 0;
  public rotation: number = 0; // Radians
  public scaleX: number = 1;
  public scaleY: number = 1;

  // Hierarchy
  private _parent: GameObject | null = null;
  private _children: GameObject[] = [];

  // Components
  private components: Map<Function, IComponent> = new Map(); // Use constructor type as key
  private componentsAddedInFrame: IComponent[] = []; // For 'start' lifecycle
  private hasStarted: boolean = false;

  constructor(scene: Phaser.Scene, name: string = "GameObject") {
    this.id = nextGameObjectId++;
    this.scene = scene;
    this.name = `${name}_${this.id}`;
    Logger.debug(
      LOGGER_SOURCE,
      `GameObject created: ${this.name} (ID: ${this.id}) in scene ${scene.scene.key}`
    );
  }

  // --- Component Management ---
  public addComponent<T extends IComponent>(componentInstance: T): T {
    const ComponentType = componentInstance.constructor as Function;
    if (this.components.has(ComponentType)) {
      Logger.warn(
        LOGGER_SOURCE,
        `GameObject ${this.name} already has a component of type ${ComponentType.name}. Replacing.`
      );
      this.removeComponent(ComponentType as { new (...args: any[]): T });
    }

    componentInstance.gameObject = this; // Assign reference back to the GameObject
    this.components.set(ComponentType, componentInstance);

    // Call awake immediately
    if (typeof componentInstance.awake === "function") {
      try {
        componentInstance.awake();
      } catch (error) {
        Logger.error(
          LOGGER_SOURCE,
          `Error in ${ComponentType.name}.awake() on ${this.name}:`,
          error
        );
      }
    }

    // Queue for 'start' if the GameObject itself has already started
    if (this.hasStarted && typeof componentInstance.start === "function") {
      this.componentsAddedInFrame.push(componentInstance);
    }

    Logger.debug(
      LOGGER_SOURCE,
      `Component ${ComponentType.name} added to ${this.name}`
    );
    return componentInstance;
  }

  public getComponent<T extends IComponent>(ComponentType: {
    new (...args: any[]): T;
  }): T | null {
    const component = this.components.get(ComponentType);
    return (component as T) || null;
  }

  public removeComponent<T extends IComponent>(ComponentType: {
    new (...args: any[]): T;
  }): void {
    const component = this.components.get(ComponentType);
    if (component) {
      // Call destroy before removing
      if (typeof component.destroy === "function") {
        try {
          component.destroy();
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${ComponentType.name}.destroy() on ${this.name}:`,
            error
          );
        }
      }
      component.gameObject = null; // Clear reference
      this.components.delete(ComponentType);
      Logger.debug(
        LOGGER_SOURCE,
        `Component ${ComponentType.name} removed from ${this.name}`
      );
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Component ${ComponentType.name} not found on ${this.name} for removal.`
      );
    }
  }

  public hasComponent<T extends IComponent>(ComponentType: {
    new (...args: any[]): T;
  }): boolean {
    return this.components.has(ComponentType);
  }

  // --- Hierarchy Management ---

  public get parent(): GameObject | null {
    return this._parent;
  }

  public get children(): ReadonlyArray<GameObject> {
    return this._children;
  }

  /** Adds a child GameObject. Ensures the child is removed from its previous parent. */
  public addChild(child: GameObject): void {
    if (child._parent === this || child === this) {
      return; // Already a child or trying to add self
    }
    if (child.isAncestor(this)) {
      Logger.error(
        LOGGER_SOURCE,
        `Cannot add ancestor GameObject ${this.name} as a child of ${child.name}.`
      );
      return;
    }

    if (child._parent) {
      child._parent.removeChild(child);
    }
    child._parent = this;
    this._children.push(child);
    Logger.debug(LOGGER_SOURCE, `${child.name} added as child to ${this.name}`);
    // World transform will be updated by components that need it (e.g., SpriteRenderer)
  }

  /** Removes a specific child GameObject. */
  public removeChild(child: GameObject): void {
    const index = this._children.indexOf(child);
    if (index !== -1) {
      child._parent = null;
      this._children.splice(index, 1);
      Logger.debug(
        LOGGER_SOURCE,
        `${child.name} removed as child from ${this.name}`
      );
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `${child.name} not found as child of ${this.name}`
      );
    }
  }

  /** Checks if the given GameObject is an ancestor of this one. */
  public isAncestor(potentialAncestor: GameObject): boolean {
    let current: GameObject | null = this._parent;
    while (current) {
      if (current === potentialAncestor) {
        return true;
      }
      current = current._parent;
    }
    return false;
  }

  // --- Lifecycle Methods (Called by Phaser Scene) ---

  /** Internal method called by the Scene to signal the first frame update. */
  public _internalStart(): void {
    if (this.hasStarted) return;
    this.hasStarted = true;

    // Call start on existing components
    this.components.forEach((component, ComponentType) => {
      if (typeof component.start === "function") {
        try {
          component.start();
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${ComponentType.name}.start() on ${this.name}:`,
            error
          );
        }
      }
    });

    // Call start on components added during the first frame before start was called
    this.processComponentsAddedInFrame();
  }

  /** Internal method called by the Scene's update loop. */
  public _internalUpdate(deltaTimeS: number): void {
    if (!this.active) return;

    // Process any components added mid-frame before update
    this.processComponentsAddedInFrame();

    // Update components
    this.components.forEach((component, ComponentType) => {
      if (typeof component.update === "function") {
        try {
          component.update(deltaTimeS);
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${ComponentType.name}.update() on ${this.name}:`,
            error
          );
        }
      }
    });

    // Update children (active check is done within their own update)
    // this._children.forEach(child => child._internalUpdate(deltaTimeS));
    // NO - Scene should iterate through its root objects and call their updates directly
  }

  /** Internal method called by the Scene's fixed update loop. */
  public _internalFixedUpdate(fixedDeltaTimeS: number): void {
    if (!this.active) return;

    // Process any components added mid-frame before fixed update
    this.processComponentsAddedInFrame();

    // Update components
    this.components.forEach((component, ComponentType) => {
      if (typeof component.fixedUpdate === "function") {
        try {
          component.fixedUpdate(fixedDeltaTimeS);
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${ComponentType.name}.fixedUpdate() on ${this.name}:`,
            error
          );
        }
      }
    });

    // Update children (active check is done within their own fixed update)
    // this._children.forEach(child => child._internalFixedUpdate(fixedDeltaTimeS));
    // NO - Scene should iterate through its root objects and call their fixed updates directly
  }

  /** Destroys the GameObject, its components, and its children. */
  public destroy(): void {
    if (!this.active) return; // Prevent double destruction
    this.active = false; // Mark as inactive immediately
    Logger.debug(LOGGER_SOURCE, `Destroying GameObject: ${this.name}`);

    // Remove self from parent *first* to prevent potential issues during child/component destruction
    if (this._parent) {
      this._parent.removeChild(this);
    }

    // Destroy children recursively
    // Iterate over a copy since child.destroy() will modify the array via removeChild
    [...this._children].forEach((child) => child.destroy());
    this._children = []; // Clear children array

    // Destroy components
    this.components.forEach((component, ComponentType) => {
      if (typeof component.destroy === "function") {
        try {
          component.destroy();
        } catch (error) {
          Logger.error(
            LOGGER_SOURCE,
            `Error in ${ComponentType.name}.destroy() on ${this.name}:`,
            error
          );
        }
      }
      component.gameObject = null;
    });
    this.components.clear();

    // Clear frame-added components just in case
    this.componentsAddedInFrame = [];

    // TODO: Notify the Scene to remove this GameObject from its managed list?
    // This might be better handled by the code calling destroy().
  }

  /** Processes components added during the current frame, calling their start() method. */
  private processComponentsAddedInFrame(): void {
    if (this.componentsAddedInFrame.length > 0) {
      const newlyAdded = [...this.componentsAddedInFrame];
      this.componentsAddedInFrame = []; // Clear before processing
      newlyAdded.forEach((component) => {
        // Check again in case it was removed before start could be called
        if (
          component.gameObject === this &&
          typeof component.start === "function"
        ) {
          try {
            component.start();
          } catch (error) {
            // Assuming ComponentType lookup might be tricky here, log name if possible
            const componentName =
              (component.constructor as any).name || "UnknownComponent";
            Logger.error(
              LOGGER_SOURCE,
              `Error in ${componentName}.start() on ${this.name}:`,
              error
            );
          }
        }
      });
    }
  }
}
