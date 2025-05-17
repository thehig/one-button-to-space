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
  private bodyIdCounter: number = 0; // Added declaration
  private localBodyCache: Map<string, Matter.Body> = new Map(); // Added declaration

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
    options?: Matter.IBodyDefinition
  ): Matter.Body {
    this.bodyIdCounter++; // For generating fallback labels
    const finalLabel = options?.label || `box-${this.bodyIdCounter}`;

    const defaultBoxOptions: Matter.IBodyDefinition = {
      isStatic: false,
      collisionFilter: createCollisionFilter(
        CollisionCategories.DEFAULT,
        CollisionMasks.DEFAULT
      ),
      label: finalLabel, // Ensure label is part of default consideration
    };

    let combinedOptions = {
      ...defaultBoxOptions,
      ...options,
      label: finalLabel,
    }; // options will override defaults, then ensure finalLabel

    if (combinedOptions.isStatic && options && !options.collisionFilter) {
      // If it's static and no filter was *explicitly provided in the incoming options*,
      // then apply the static environment collision filter.
      combinedOptions.collisionFilter = createCollisionFilter(
        CollisionCategories.STATIC_ENVIRONMENT,
        CollisionMasks.STATIC_ENVIRONMENT
      );
    }

    const box = Matter.Bodies.rectangle(x, y, width, height, combinedOptions);
    Matter.Composite.add(this.world, box); // Directly add to world
    this.localBodyCache.set(finalLabel, box); // Cache it with the definitive label
    return box;
  }

  public createCircle(
    x: number,
    y: number,
    radius: number,
    options?: Matter.IBodyDefinition
  ): Matter.Body {
    this.bodyIdCounter++;
    const finalLabel = options?.label || `circle-${this.bodyIdCounter}`;

    const defaultCircleOptions: Matter.IBodyDefinition = {
      isStatic: false,
      collisionFilter: createCollisionFilter(
        CollisionCategories.DEFAULT,
        CollisionMasks.DEFAULT
      ),
      label: finalLabel,
    };

    let combinedOptions = {
      ...defaultCircleOptions,
      ...options,
      label: finalLabel,
    };

    if (combinedOptions.isStatic && options && !options.collisionFilter) {
      combinedOptions.collisionFilter = createCollisionFilter(
        CollisionCategories.STATIC_ENVIRONMENT,
        CollisionMasks.STATIC_ENVIRONMENT
      );
    }

    const circle = Matter.Bodies.circle(x, y, radius, combinedOptions);
    Matter.Composite.add(this.world, circle);
    this.localBodyCache.set(finalLabel, circle);
    return circle;
  }

  public createRocketBody(
    x: number,
    y: number,
    options?: Matter.IBodyDefinition
  ): Matter.Body {
    this.bodyIdCounter++;
    const finalLabel = options?.label || `rocket-${this.bodyIdCounter}`;

    // Define the convex parts for the rocket, relative to (0,0) which will be the rocket's tip
    const triangle1Vertices: Matter.Vector[] = [
      { x: 0, y: 0 },
      { x: 10, y: 25 },
      { x: 0, y: 20 },
    ];
    const triangle2Vertices: Matter.Vector[] = [
      { x: 0, y: 0 },
      { x: 0, y: 20 },
      { x: -10, y: 25 },
    ];

    // Base options for the compound body (these apply to the overall rocket)
    const defaultRocketBaseOptions: Matter.IBodyDefinition = {
      label: finalLabel,
      isStatic: false,
      collisionFilter: createCollisionFilter(
        CollisionCategories.ROCKET,
        CollisionMasks.ROCKET
      ),
      density: 0.05, // Example density for the whole rocket
      frictionAir: 0.05, // Example air friction for the whole rocket
      plugin: { dragCoefficientArea: 0.5, effectiveNoseRadius: 0.1 }, // Custom plugin data
    };

    // Merge user-provided options with defaults for the compound body
    const finalCompoundOptions = {
      ...defaultRocketBaseOptions,
      ...options, // User options can override density, frictionAir, plugin, label etc.
      label: finalLabel, // Ensure the label is correctly set
    };

    // Critical: Remove 'vertices' from finalCompoundOptions if it exists from input 'options',
    // as we are using 'parts' to define the shape.
    if ("vertices" in finalCompoundOptions) {
      delete (finalCompoundOptions as any).vertices;
    }

    // Options for the individual parts. They should typically be sensors if the parent is a sensor.
    // Other properties like collisionFilter are usually handled by the compound body.
    const partCreationOptions: Matter.IBodyDefinition = {
      isSensor: finalCompoundOptions.isSensor,
    };

    const part1 = Matter.Bodies.fromVertices(
      0,
      0,
      [triangle1Vertices],
      partCreationOptions
    );
    const part2 = Matter.Bodies.fromVertices(
      0,
      0,
      [triangle2Vertices],
      partCreationOptions
    );

    if (!part1 || !part2) {
      console.error(
        `[PhysicsEngine.createRocketBody] FAILED to create one or more parts for rocket: ${finalLabel}. Part1: ${!!part1}, Part2: ${!!part2}`
      );
      throw new Error(`Failed to create parts for rocket body: ${finalLabel}`);
    }

    // Create the compound body from these parts
    const rocket = Matter.Body.create({
      parts: [part1, part2],
      ...finalCompoundOptions, // Apply all other options (label, density, friction, plugin, etc.)
    });

    // Set the initial position of the compound body in the world
    Matter.Body.setPosition(rocket, { x, y });

    // Apply initial angle and angular velocity if provided in options
    if (options?.angle) {
      Matter.Body.setAngle(rocket, options.angle);
    }
    if (options?.angularVelocity) {
      Matter.Body.setAngularVelocity(rocket, options.angularVelocity);
    }

    // Remove extensive logging, keep one success message
    console.log(
      `[PhysicsEngine.createRocketBody] Successfully created COMPOUND rocket body: ${finalLabel}, Matter ID: ${rocket.id}, Parts: ${rocket.parts.length}`
    );

    Matter.Composite.add(this.world, rocket);
    this.localBodyCache.set(finalLabel, rocket);
    return rocket;
  }

  // --- Utility functions for applying forces/impulses ---
  public applyForceToBody(
    body: Matter.Body,
    position: Matter.Vector,
    trueForce: Matter.Vector
  ): void {
    let scaledForce = Matter.Vector.mult(trueForce, 1 / this.fixedTimeStepMs);

    const maxScaledForceMagnitude = 50;
    const currentScaledForceMagnitude = Matter.Vector.magnitude(scaledForce);
    if (currentScaledForceMagnitude > maxScaledForceMagnitude) {
      scaledForce = Matter.Vector.mult(
        Matter.Vector.normalise(scaledForce),
        maxScaledForceMagnitude
      );
    }

    Matter.Body.applyForce(body, position, scaledForce);
  }

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

  public update(deltaTimeSeconds: number): void {
    if (this.internalLoggingEnabled) {
      console.log(
        `[PhysicsEngine.update] Called. deltaTime: ${deltaTimeSeconds}, LoggingEnabled: ${this.internalLoggingEnabled}`
      );
      console.log(
        "[PhysicsEngine.update] Bodies in world:",
        Matter.Composite.allBodies(this.world).length
      );
    }

    this.applyGravitationalForces();
    this.applyAtmosphericDragForces();

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
              : [],
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
        position: { x: cb.position.x, y: cb.position.y },
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
}
