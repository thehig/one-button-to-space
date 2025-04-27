// Forward declare GameObject to avoid circular dependency issues if components import GameObject
// This might not be strictly necessary depending on usage, but can be safer.
declare class GameObject {}

/**
 * Base interface for all components that can be attached to a GameObject.
 * Components encapsulate data and/or behavior.
 */
export interface IComponent {
  /** Reference to the GameObject this component is attached to. Set automatically by GameObject. */
  gameObject: GameObject | null;

  /** Called only once by GameObject when the component instance is first added and enabled. */
  awake?(): void;

  /** Called only once by GameObject on the first frame the component is active, before the first update. */
  start?(): void;

  /** Called every frame by the Phaser Scene's update loop, if the component and GameObject are active. For variable-rate updates. */
  update?(deltaTimeS: number): void;

  /** Called at fixed-rate intervals by the Phaser Scene's physics update (e.g., Matter update event), if the component and GameObject are active. Good for physics calculations. */
  fixedUpdate?(fixedDeltaTimeS: number): void;

  /** Called by GameObject when the component or its owning GameObject is being destroyed. */
  destroy?(): void;
}
