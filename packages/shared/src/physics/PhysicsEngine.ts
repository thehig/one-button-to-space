import Matter from "matter-js";
import {
  CollisionCategories,
  CollisionMasks,
  createCollisionFilter,
} from "../constants/collisionCategories";
import type {
  ISerializedPhysicsEngineState,
  ISerializedMatterBody,
  ISerializedBodyRenderOptions,
  ISerializedCustomBodyPlugin,
  ICelestialBodyData,
} from "./scenarios/types"; // Added import for serialization types

export interface ICelestialBody {
  id: string;
  mass: number;
  position: Matter.Vector;
  gravityRadius: number; // Max distance at which its gravity has a significant effect
  radius?: number; // Radius of the celestial body itself, for altitude calculations
  // Atmospheric properties (optional)
  hasAtmosphere?: boolean;
  atmosphereLimitAltitude?: number; // Altitude above which atmosphere is negligible
  surfaceAirDensity?: number; // Air density at surface (e.g., sea level for Earth)
  scaleHeight?: number; // Characteristic height for atmospheric density decay
}

// For type-safe access to custom properties on Matter.Body.plugin
export interface ICustomBodyPlugin {
  dragCoefficientArea?: number;
  effectiveNoseRadius?: number; // For heating calculations (meters)
  currentHeatFlux?: number; // Calculated heat flux (W/m^2)
  // other custom flags or data can be added here
}

export class PhysicsEngine {
  private engine: Matter.Engine;
  private world: Matter.World;
  private fixedTimeStepMs: number = 1000 / 60; // e.g., 60 FPS
  private accumulatedTime: number = 0;
  private celestialBodies: ICelestialBody[] = []; // For variable gravity
  private G: number; // Gravitational constant, now instance-specific
  // Potentially a renderer if we want to debug draw on server or share debug logic
  // private renderer: Matter.Render;
  private internalLoggingEnabled: boolean = false;
  private ownsEngine: boolean = true; // New flag

  constructor(fixedTimeStepMs: number = 1000 / 60, customG?: number) {
    this.fixedTimeStepMs = fixedTimeStepMs;
    this.G = customG !== undefined ? customG : 0.001; // Default G if not provided

    // Default: create and own the engine
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this.ownsEngine = true;

    // Disable global engine gravity; we will apply it manually or variably
    this.engine.gravity.scale = 0;
    // this.engine.gravity.y = 0; // Ensuring x and y are also 0 initially
    // this.engine.gravity.x = 0; // This is often default but good to be explicit

    if (this.internalLoggingEnabled)
      console.log("PhysicsEngine initialized (owns engine by default)");
  }

  // New method to use an external engine
  public setExternalMatterEngine(externalEngine: Matter.Engine): void {
    if (this.engine && this.ownsEngine) {
      // If we previously owned an engine, it will be orphaned.
      // This is acceptable for the visualizer's use case where a new PhysicsEngine
      // is created and immediately given an external engine.
    }
    this.engine = externalEngine;
    this.world = this.engine.world; // Update world reference
    this.ownsEngine = false;

    // Ensure the external engine also has our desired global gravity settings
    // This is important if PhysicsEngine normally sets these for its owned engine.
    // Matter.Engine.create() defaults to { x: 0, y: 1, scale: 0.001 }
    // We want scale = 0 for our custom gravity/forces approach.
    this.engine.gravity.scale = 0;
    this.engine.gravity.x = 0; // Explicitly set for clarity
    this.engine.gravity.y = 0; // Explicitly set for clarity

    if (this.internalLoggingEnabled)
      console.log("PhysicsEngine now using an external Matter.js engine.");
  }

  public init(celestialBodies?: ICelestialBody[]): void {
    if (celestialBodies) {
      this.celestialBodies = celestialBodies;
    }
    // Example: Add a default central celestial body if none provided
    // if (this.celestialBodies.length === 0) {
    //   this.celestialBodies.push({ id: 'earth', mass: 5.972e10, position: { x: 400, y: 3000 }, gravityRadius: 5000 });
    // }
    if (this.internalLoggingEnabled)
      console.log("PhysicsEngine explicit init called");
  }

  /**
   * Applies gravitational forces from celestial bodies to all dynamic bodies in the world.
   */
  private applyGravitationalForces(): void {
    const bodies = Matter.Composite.allBodies(this.world);
    for (const body of bodies) {
      if (body.isStatic || body.isSleeping) continue;

      if (this.celestialBodies.length > 0) {
        let totalForce = { x: 0, y: 0 };
        for (const celestial of this.celestialBodies) {
          const dVector = Matter.Vector.sub(celestial.position, body.position);
          let distanceSq = Matter.Vector.magnitudeSquared(dVector);

          // Prevent extreme forces at very close distances
          const r_min_sq = 1.0; // Minimum squared distance for force calculation
          if (distanceSq < r_min_sq) {
            distanceSq = r_min_sq;
          }

          if (
            distanceSq === 0 ||
            distanceSq > celestial.gravityRadius * celestial.gravityRadius
          )
            continue;

          const forceMagnitude =
            (this.G * celestial.mass * body.mass) / distanceSq;
          const direction = Matter.Vector.normalise(
            Matter.Vector.sub(celestial.position, body.position)
          );
          const forceVector = Matter.Vector.mult(direction, forceMagnitude);

          // Apply the calculated force, scaled to achieve desired deltaV per step
          const scalingFactor = 1 / (this.fixedTimeStepMs * 1000.0); // ax_true * dt_seconds
          const scaledForce = Matter.Vector.mult(forceVector, scalingFactor);
          if (this.internalLoggingEnabled) {
            console.log(
              `Applying scaled gravitational force to body ${
                body.id || body.label
              }: (${scaledForce.x.toFixed(6)}, ${scaledForce.y.toFixed(
                6
              )}) from celestial ${celestial.id}`
            );
          }
          Matter.Body.applyForce(body, body.position, scaledForce);
        }
      } else {
        // Fallback to simple downward gravity
        const downwardGravityForceMagnitude = body.mass * 0.001 * 9.81; // True force magnitude
        const downwardGravityForce = { x: 0, y: downwardGravityForceMagnitude };
        Matter.Body.applyForce(body, body.position, downwardGravityForce); // Use wrapper
      }
    }
  }

  private applyAtmosphericDragForces(): void {
    const bodies = Matter.Composite.allBodies(this.world);
    for (const body of bodies) {
      if (
        body.isStatic ||
        body.isSleeping ||
        !body.velocity ||
        (body.velocity.x === 0 && body.velocity.y === 0)
      )
        continue;

      const primaryAtmosphericBody = this.celestialBodies.find(
        (cb) => cb.hasAtmosphere
      );
      if (!primaryAtmosphericBody) continue;

      // Use celestial body's radius for accurate altitude from surface
      const bodyRadius = primaryAtmosphericBody.radius || 0;
      const altitude =
        Matter.Vector.magnitude(
          Matter.Vector.sub(body.position, primaryAtmosphericBody.position)
        ) - bodyRadius;

      if (
        altitude < 0 ||
        altitude > (primaryAtmosphericBody.atmosphereLimitAltitude || Infinity)
      ) {
        continue;
      }

      const surfaceDensity = primaryAtmosphericBody.surfaceAirDensity || 1.225;
      const scaleHeight = primaryAtmosphericBody.scaleHeight || 8500;
      const density =
        surfaceDensity * Math.exp(-Math.max(0, altitude) / scaleHeight);

      const bodyPlugin = body.plugin as ICustomBodyPlugin; // Use defined interface
      const dragCoefficientArea = bodyPlugin?.dragCoefficientArea || 0.5;
      const speedSquared = Matter.Vector.magnitudeSquared(body.velocity);
      const dragMagnitude = 0.5 * density * speedSquared * dragCoefficientArea;

      if (dragMagnitude === 0) continue;

      const dragForce = Matter.Vector.mult(
        Matter.Vector.normalise(body.velocity),
        -dragMagnitude
      );

      this.applyForceToBody(body, body.position, dragForce); // Use wrapper
    }
  }

  private applyAtmosphericHeatingEffects(
    body: Matter.Body,
    primaryAtmosphericBody: ICelestialBody
  ): void {
    if (
      body.isStatic ||
      body.isSleeping ||
      !body.velocity ||
      (body.velocity.x === 0 && body.velocity.y === 0)
    ) {
      (body.plugin as ICustomBodyPlugin).currentHeatFlux = 0;
      return;
    }

    const bodyPlugin = body.plugin as ICustomBodyPlugin;
    const noseRadius = bodyPlugin.effectiveNoseRadius;

    if (typeof noseRadius !== "number" || noseRadius <= 0) {
      (body.plugin as ICustomBodyPlugin).currentHeatFlux = 0; // No nose radius, no heating calculation
      return;
    }

    const bodyRadius = primaryAtmosphericBody.radius || 0;
    const altitude =
      Matter.Vector.magnitude(
        Matter.Vector.sub(body.position, primaryAtmosphericBody.position)
      ) - bodyRadius;

    if (
      altitude < 0 ||
      altitude > (primaryAtmosphericBody.atmosphereLimitAltitude || Infinity)
    ) {
      (body.plugin as ICustomBodyPlugin).currentHeatFlux = 0;
      return;
    }

    const surfaceDensity = primaryAtmosphericBody.surfaceAirDensity || 1.225;
    const scaleHeight = primaryAtmosphericBody.scaleHeight || 8500;
    const rho = surfaceDensity * Math.exp(-Math.max(0, altitude) / scaleHeight);

    const V = Matter.Vector.magnitude(body.velocity);
    if (V === 0) {
      (body.plugin as ICustomBodyPlugin).currentHeatFlux = 0;
      return;
    }

    const Rn = noseRadius;
    const C_heating = 1.83e-4; // Sutton-Graves constant for Earth-like air (approx.)

    const heatFlux = C_heating * Math.sqrt(rho / Rn) * Math.pow(V, 3);
    (body.plugin as ICustomBodyPlugin).currentHeatFlux = heatFlux;
  }

  public step(deltaTime: number): void {
    Matter.Engine.update(this.engine, deltaTime);
  }

  /**
   * Advances the physics simulation by a fixed time step.
   * Call this method from your game loop, passing the real elapsed time (deltaMs).
   * It will internally call Matter.Engine.update the appropriate number of times.
   * @param deltaMs The real time elapsed since the last call to this method.
   */
  public fixedStep(deltaMs: number): void {
    // Original fixedStep logic:
    this.accumulatedTime += deltaMs;
    while (this.accumulatedTime >= this.fixedTimeStepMs) {
      // Apply custom forces like gravity before stepping the engine
      this.applyGravitationalForces();
      this.applyAtmosphericDragForces(); // Apply drag

      // Apply atmospheric heating effects
      const allBodies = Matter.Composite.allBodies(this.world);
      for (const body of allBodies) {
        const primaryAtmosphericBody = this.celestialBodies.find(
          (cb) => cb.hasAtmosphere
        );
        if (primaryAtmosphericBody) {
          this.applyAtmosphericHeatingEffects(body, primaryAtmosphericBody);
        } else {
          if (body.plugin) {
            (body.plugin as ICustomBodyPlugin).currentHeatFlux = 0;
          }
        }
      }

      Matter.Engine.update(this.engine, this.fixedTimeStepMs);
      this.accumulatedTime -= this.fixedTimeStepMs;
    }
    // End Original fixedStep logic
  }

  public getWorld(): Matter.World {
    return this.world;
  }

  public addBody(body: Matter.Body | Matter.Body[] | Matter.Composite): void {
    Matter.World.add(this.world, body);
  }

  public removeBody(
    body: Matter.Body | Matter.Body[] | Matter.Composite
  ): void {
    Matter.World.remove(this.world, body);
  }

  // --- Factory Methods ---
  public createBox(
    x: number,
    y: number,
    width: number,
    height: number,
    options?: any
  ): Matter.Body {
    const defaultBoxOptions = {
      isStatic: false, // Default to dynamic unless specified
      collisionFilter: createCollisionFilter(
        CollisionCategories.DEFAULT,
        CollisionMasks.DEFAULT
      ),
    };
    const mergedOptions = { ...defaultBoxOptions, ...options };
    if (options && options.isStatic && !options.collisionFilter) {
      // If it's static and no filter is provided, assume it's static environment
      mergedOptions.collisionFilter = createCollisionFilter(
        CollisionCategories.STATIC_ENVIRONMENT,
        CollisionMasks.STATIC_ENVIRONMENT
      );
    }

    const body = Matter.Bodies.rectangle(x, y, width, height, mergedOptions);
    this.addBody(body);
    return body;
  }

  public createCircle(
    x: number,
    y: number,
    radius: number,
    options?: any
  ): Matter.Body {
    const defaultCircleOptions = {
      isStatic: false,
      collisionFilter: createCollisionFilter(
        CollisionCategories.DEFAULT,
        CollisionMasks.DEFAULT
      ),
    };
    const mergedOptions = { ...defaultCircleOptions, ...options };
    if (options && options.isStatic && !options.collisionFilter) {
      mergedOptions.collisionFilter = createCollisionFilter(
        CollisionCategories.STATIC_ENVIRONMENT,
        CollisionMasks.STATIC_ENVIRONMENT
      );
    }
    const body = Matter.Bodies.circle(x, y, radius, mergedOptions);
    this.addBody(body);
    return body;
  }

  public createRocketBody(x: number, y: number): Matter.Body {
    const width = 20;
    const height = 50;
    const options: Matter.IBodyDefinition = {
      label: "rocket",
      density: 0.001,
      frictionAir: 0.01,
      plugin: {
        dragCoefficientArea: 0.5,
      } as ICustomBodyPlugin,
      collisionFilter: createCollisionFilter(
        CollisionCategories.ROCKET,
        CollisionMasks.ROCKET
      ),
    };
    const rocketBody = Matter.Bodies.rectangle(x, y, width, height, options);
    this.addBody(rocketBody);
    return rocketBody;
  }

  // --- Utility functions for applying forces/impulses ---
  public applyForceToBody(
    body: Matter.Body,
    position: Matter.Vector,
    trueForce: Matter.Vector // Assuming this is the desired physical force
  ): void {
    // Scale trueForce by (1 / fixedTimeStepMs) based on Matter.js Engine.update behavior
    // This was based on a previous key discovery for the project's physics.
    let scaledForce = Matter.Vector.mult(trueForce, 1 / this.fixedTimeStepMs);

    // TEMP: Cap scaledForce magnitude to avoid Matter.js instability with large forces
    // (Restoring this as it was part of the previously stable system)
    const maxScaledForceMagnitude = 50;
    const currentScaledForceMagnitude = Matter.Vector.magnitude(scaledForce);
    if (currentScaledForceMagnitude > maxScaledForceMagnitude) {
      // console.warn(`PhysicsEngine: Capping scaledForce magnitude from ${currentScaledForceMagnitude.toFixed(2)} to ${maxScaledForceMagnitude} for body ${body.label || body.id}`);
      scaledForce = Matter.Vector.mult(
        Matter.Vector.normalise(scaledForce),
        maxScaledForceMagnitude
      );
    }

    Matter.Body.applyForce(body, position, scaledForce);
  }

  // Matter.js does not have a direct 'applyImpulse'.
  // An impulse is a force applied over a very short time, or direct velocity change.
  // Option 1: Apply a large force for one step (less physically accurate for true impulse)
  // Option 2: Directly manipulate velocity (use with caution, can break constraints)
  public applyImpulseAsVelocityChange(
    body: Matter.Body,
    velocityChange: Matter.Vector
  ): void {
    Matter.Body.setVelocity(
      body,
      Matter.Vector.add(body.velocity, velocityChange)
    );
  }

  public setBodyVelocity(body: Matter.Body, velocity: Matter.Vector): void {
    Matter.Body.setVelocity(body, velocity);
  }

  public setInternalLogging(enable: boolean): void {
    this.internalLoggingEnabled = enable;
  }

  public getBodyById(label: string): Matter.Body | null {
    const bodies = Matter.Composite.allBodies(this.world);
    const foundBody = bodies.find((body) => body.label === label);
    return foundBody || null;
  }

  /**
   * Advances the physics simulation.
   * This version is intended for use cases like the visualizer where the external loop provides delta time.
   * It applies custom forces and then updates the Matter engine.
   * @param deltaTimeSeconds The time elapsed since the last update, in seconds.
   */
  public update(deltaTimeSeconds: number): void {
    // If internalLoggingEnabled is true, log more frequently within update
    if (this.internalLoggingEnabled) {
      console.log(
        `[PhysicsEngine.update] Called. deltaTime: ${deltaTimeSeconds}, LoggingEnabled: ${this.internalLoggingEnabled}`
      );
      console.log(
        "[PhysicsEngine.update] Bodies in world:",
        Matter.Composite.allBodies(this.world).length
      );
    }

    // Apply custom forces like gravity and drag
    this.applyGravitationalForces();
    this.applyAtmosphericDragForces();

    // Apply atmospheric heating effects
    const allBodies = Matter.Composite.allBodies(this.world);
    for (const body of allBodies) {
      const primaryAtmosphericBody = this.celestialBodies.find(
        (cb) => cb.hasAtmosphere
      );
      if (primaryAtmosphericBody) {
        this.applyAtmosphericHeatingEffects(body, primaryAtmosphericBody);
      } else {
        if (body.plugin) {
          (body.plugin as ICustomBodyPlugin).currentHeatFlux = 0;
        }
      }
    }

    // Update the Matter.js engine
    // Matter.Engine.update expects delta in milliseconds
    Matter.Engine.update(this.engine, deltaTimeSeconds * 1000);
  }

  public toJSON(): ISerializedPhysicsEngineState {
    const allBodiesInWorld = Matter.Composite.allBodies(this.world);
    const serializedBodies: ISerializedMatterBody[] = allBodiesInWorld.map(
      (body) => {
        const pluginData = (body.plugin as ICustomBodyPlugin) || {};
        const renderData = body.render || {};

        return {
          id: body.id,
          label: body.label || `body-${body.id}`,
          type: body.type,
          parts:
            body.parts && body.parts.length > 1
              ? body.parts.map((p) => p.id).filter((id) => id !== body.id)
              : [], // Store IDs of parts, excluding self
          position: { x: body.position.x, y: body.position.y },
          angle: body.angle,
          velocity: { x: body.velocity.x, y: body.velocity.y },
          angularVelocity: body.angularVelocity,
          mass: body.mass,
          inverseMass: body.inverseMass,
          inertia: body.inertia,
          inverseInertia: body.inverseInertia,
          density: body.density,
          restitution: body.restitution,
          friction: body.friction,
          frictionStatic: body.frictionStatic,
          frictionAir: body.frictionAir,
          slop: body.slop,
          isStatic: body.isStatic,
          isSensor: body.isSensor,
          isSleeping: body.isSleeping,
          collisionFilter: {
            category:
              body.collisionFilter.category || CollisionCategories.DEFAULT,
            mask: body.collisionFilter.mask || CollisionMasks.DEFAULT,
            group: body.collisionFilter.group || 0,
          },
          render: {
            visible: renderData.visible,
            opacity: renderData.opacity,
            fillStyle: renderData.fillStyle,
            strokeStyle: renderData.strokeStyle,
            lineWidth: renderData.lineWidth,
            sprite: {
              texture: renderData.sprite?.texture ?? null,
              xScale: renderData.sprite?.xScale ?? 1,
              yScale: renderData.sprite?.yScale ?? 1,
              xOffset: (renderData.sprite as any)?.xOffset ?? null,
              yOffset: (renderData.sprite as any)?.yOffset ?? null,
            },
          } as ISerializedBodyRenderOptions,
          plugin: {
            dragCoefficientArea: pluginData.dragCoefficientArea ?? null,
            effectiveNoseRadius: pluginData.effectiveNoseRadius ?? null,
            currentHeatFlux: pluginData.currentHeatFlux ?? null,
          } as ISerializedCustomBodyPlugin,
        };
      }
    );

    const serializedCelestialBodies: ICelestialBodyData[] =
      this.celestialBodies.map((cb) => ({
        id: cb.id,
        mass: cb.mass,
        position: { x: cb.position.x, y: cb.position.y }, // Already {x, y} in ICelestialBody
        gravityRadius: cb.gravityRadius,
        radius: cb.radius,
        hasAtmosphere: cb.hasAtmosphere,
        atmosphereLimitAltitude: cb.atmosphereLimitAltitude,
        surfaceAirDensity: cb.surfaceAirDensity,
        scaleHeight: cb.scaleHeight,
      }));

    return {
      timestamp: Date.now(),
      fixedTimeStepMs: this.fixedTimeStepMs,
      accumulatedTime: this.accumulatedTime,
      G: this.G,
      internalLoggingEnabled: this.internalLoggingEnabled,
      ownsEngine: this.ownsEngine,
      celestialBodies: serializedCelestialBodies,
      world: {
        bodies: serializedBodies,
      },
    };
  }

  // Add more methods as needed for interacting with the physics world
  // e.g., creating bodies, applying forces, handling collisions
}
