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
  creationParams?: // Added for body reconstruction
  | { type: "box"; width: number; height: number }
    | { type: "circle"; radius: number }
    | { type: "rocket" } // The compound rocket body itself
    | { type: "polygon"; vertices: Matter.Vector[] }; // Generic polygons, e.g., rocket parts
  // other custom flags or data can be added here
}

const DefaultRender = {
  fillStyle: "#B0B0B0", // Default grey
  strokeStyle: "#505050",
  lineWidth: 1,
  // No sprite by default, but if we added one here, ensure texture is valid string
};

export class PhysicsEngine {
  private engine: Matter.Engine;
  private world: Matter.World;
  private fixedTimeStepMs: number = 1000 / 60; // e.g., 60 FPS
  private accumulatedTime: number = 0;
  private celestialBodies: ICelestialBody[] = []; // For variable gravity
  private G: number; // Gravitational constant, now instance-specific
  private currentTick: number = 0; // <<< ADDED THIS LINE
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
      this.currentTick++; // <<< ADDED THIS LINE
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
      plugin: {
        // Initialize plugin if not present from options
        ...options?.plugin,
        creationParams: { type: "box", width, height },
      },
    };

    let combinedOptions = {
      ...defaultBoxOptions,
      ...options, // User options override defaults
      label: finalLabel, // Ensure finalLabel is set
      plugin: {
        // Ensure plugin and creationParams are correctly merged
        ...options?.plugin,
        ...defaultBoxOptions.plugin, // Default plugin (with creationParams) comes after user's plugin
        creationParams: { type: "box", width, height }, // Explicitly set/override creationParams
      },
    };

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
      plugin: {
        // Initialize plugin
        ...options?.plugin,
        creationParams: { type: "circle", radius },
      },
    };

    let combinedOptions = {
      ...defaultCircleOptions,
      ...options, // User options override defaults
      label: finalLabel, // Ensure finalLabel is set
      plugin: {
        // Ensure plugin and creationParams are correctly merged
        ...options?.plugin,
        ...defaultCircleOptions.plugin,
        creationParams: { type: "circle", radius }, // Explicitly set/override
      },
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
    const labelPrefix = options?.label || "rocket";
    const commonOptions = { ...options }; // Clone to avoid modifying input

    // Define collision filters
    const commonRocketCollisionFilter = createCollisionFilter(
      CollisionCategories.ROCKET,
      CollisionMasks.ROCKET
    );
    const partCollisionFilter = commonRocketCollisionFilter;
    const mainCollisionFilter =
      options?.collisionFilter || commonRocketCollisionFilter;

    // Remove properties that are for the compound body from commonOptions for parts
    delete commonOptions.parts;
    delete commonOptions.label; // Parts will get their own labels
    delete commonOptions.collisionFilter;
    delete commonOptions.plugin;

    // Helper to create render options for parts
    // Ensures a valid render object is always returned.
    const getPartRenderOpts = (partDefaults: {
      fillStyle: string;
      strokeStyle?: string;
      lineWidth?: number;
    }): Matter.IBodyRenderOptions => {
      const inputRender = options?.render;
      let finalRender: Matter.IBodyRenderOptions = {
        fillStyle: partDefaults.fillStyle,
        strokeStyle: partDefaults.strokeStyle ?? DefaultRender.strokeStyle,
        lineWidth: partDefaults.lineWidth ?? DefaultRender.lineWidth,
        visible: true, // Default visible to true for parts
        opacity: 1, // Default opacity to 1
      };

      if (typeof inputRender === "object" && inputRender !== null) {
        // If inputRender is an object, merge it, letting its properties override
        finalRender = {
          ...finalRender, // Start with our defaults (like partDefaults.fillStyle)
          ...inputRender, // Overlay with user's full render object
          // Ensure fillStyle from partDefaults is used if inputRender doesn't have one or is generic
          fillStyle: inputRender.fillStyle ?? partDefaults.fillStyle,
          strokeStyle: inputRender.strokeStyle ?? finalRender.strokeStyle, // Use already set default if not in inputRender
          lineWidth: inputRender.lineWidth ?? finalRender.lineWidth,
          visible: inputRender.visible ?? finalRender.visible,
          opacity: inputRender.opacity ?? finalRender.opacity,
        };
        // Sprite handling for parts, if inputRender has sprite info
        if (
          inputRender.sprite &&
          typeof inputRender.sprite.texture === "string"
        ) {
          finalRender.sprite = {
            texture: inputRender.sprite.texture,
            xScale: inputRender.sprite.xScale ?? 1,
            yScale: inputRender.sprite.yScale ?? 1,
          };
        }
      } else if (inputRender === true) {
        // If inputRender is true, it means use defaults (which finalRender is already set to)
        // Potentially, one might want to use DefaultRender more broadly here if inputRender === true
      }
      // If inputRender is undefined or false, finalRender remains as initialized with partDefaults
      return finalRender;
    };

    // Define parts with their own specific render properties
    const fuselageVertices: Matter.Vector[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 60 },
      { x: 0, y: 60 },
    ];
    const fuselage = Matter.Bodies.fromVertices(
      x,
      y - 20, // Assuming y is center, adjust parts relative to this new interpretation
      [fuselageVertices],
      {
        ...commonOptions, // Spread common physical properties (mass, friction etc. if any)
        label: `${labelPrefix}_fuselage`,
        collisionFilter: partCollisionFilter,
        plugin: {
          creationParams: { type: "polygon", vertices: fuselageVertices },
        } as ICustomBodyPlugin,
        render: getPartRenderOpts({ fillStyle: "#C0C0C0" }), // Silver
      }
    );

    const noseConeVertices: Matter.Vector[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 10, y: -20 },
    ];
    const noseCone = Matter.Bodies.fromVertices(
      x,
      y - 60, // Positioned above the fuselage top
      [noseConeVertices],
      {
        ...commonOptions,
        label: `${labelPrefix}_noseCone`,
        collisionFilter: partCollisionFilter,
        plugin: {
          creationParams: { type: "polygon", vertices: noseConeVertices },
        } as ICustomBodyPlugin,
        render: getPartRenderOpts({ fillStyle: "#D3D3D3" }), // Light grey
      }
    );

    // For engineBlock, using a rectangle directly is simpler
    // For creationParams, we can approximate its vertices if needed or simplify
    const engineBlockWidth = 22;
    const engineBlockHeight = 20;
    // Vertices for engine block if needed by creationParams (relative to its center)
    const engineBlockVertices: Matter.Vector[] = [
      { x: -engineBlockWidth / 2, y: -engineBlockHeight / 2 },
      { x: engineBlockWidth / 2, y: -engineBlockHeight / 2 },
      { x: engineBlockWidth / 2, y: engineBlockHeight / 2 },
      { x: -engineBlockWidth / 2, y: engineBlockHeight / 2 },
    ];

    const engineBlock = Matter.Bodies.rectangle(
      x,
      y + 40,
      engineBlockWidth,
      engineBlockHeight,
      {
        ...commonOptions,
        label: `${labelPrefix}_engineBlock`,
        collisionFilter: partCollisionFilter,
        plugin: {
          creationParams: { type: "polygon", vertices: engineBlockVertices },
        } as ICustomBodyPlugin,
        render: getPartRenderOpts({ fillStyle: "#A9A9A9" }), // Dark grey
      }
    );

    const parts = [fuselage, noseCone, engineBlock].filter(
      (p) => p !== undefined
    ) as Matter.Body[];
    if (parts.length === 0) {
      if (this.internalLoggingEnabled) {
        console.error(
          `Rocket body ${labelPrefix} created with no parts successfully defined.`
        );
      }
      // Fallback: create a simple box if all parts failed, to avoid returning undefined
      // though the factories for parts should throw if fromVertices fails due to poly-decomp
      const fallbackBox = this.createBox(x, y, 20, 80, {
        label: `${labelPrefix}_fallback`,
        collisionFilter: mainCollisionFilter,
        plugin: { creationParams: { type: "rocket" } }, // Still mark as rocket type
        render: options?.render ?? { fillStyle: DefaultRender.fillStyle },
      });
      this.localBodyCache.set(fallbackBox.label, fallbackBox);
      return fallbackBox;
    }

    const rocketBody = Matter.Body.create({
      parts: parts,
      label: labelPrefix,
      collisionFilter: mainCollisionFilter,
      plugin: { creationParams: { type: "rocket" } } as ICustomBodyPlugin,
      // Render options for the compound body itself (often not directly visible, parts are)
      render: options?.render ?? { visible: false }, // Compound body often not rendered directly, or use DefaultRender
      // Apply other properties from original options that are for the compound body
      isStatic: options?.isStatic,
      isSensor: options?.isSensor,
      // Mass, density, inertia etc. for the compound body will be calculated by Matter.js from parts
      // unless explicitly provided in options and overriding calculated values.
      // We should be careful not to pass part-level density/mass in `options` here if we want auto-calc.
      // If `options` contains `mass` or `density`, it will apply to the compound body.
      ...(options?.density && { density: options.density }),
      ...(options?.mass && { mass: options.mass }),
      ...(options?.friction && { friction: options.friction }),
      ...(options?.frictionAir && { frictionAir: options.frictionAir }),
      ...(options?.frictionStatic && {
        frictionStatic: options.frictionStatic,
      }),
      ...(options?.restitution && { restitution: options.restitution }),
      ...(options?.slop && { slop: options.slop }),
      ...(options?.angle && { angle: options.angle }),
      ...(options?.angularVelocity && {
        angularVelocity: options.angularVelocity,
      }),
    });

    // Store in local cache by label. This is now the main rocket body.
    this.localBodyCache.set(rocketBody.label, rocketBody);
    if (
      !this.world.bodies.includes(rocketBody) &&
      !this.world.composites.some((c) => c.bodies.includes(rocketBody))
    ) {
      Matter.Composite.add(this.world, rocketBody);
    }

    if (this.internalLoggingEnabled) {
      // console.log(`Rocket body ${rocketBody.label} created with parts: ${rocketBody.parts.map(p => p.label).join(", ")}`);
    }
    return rocketBody;
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
    this.currentTick++; // <<< ADDED THIS LINE (for non-fixedStep usage like visualizer)
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
          isStatic: typeof body.isStatic === "boolean" ? body.isStatic : false,
          isSensor: typeof body.isSensor === "boolean" ? body.isSensor : false,
          isSleeping:
            typeof body.isSleeping === "boolean" ? body.isSleeping : false,
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
      this.celestialBodies.map((cb) => {
        const serializedCb: ICelestialBodyData = {
          id: cb.id,
          mass: cb.mass,
          position: { x: cb.position.x, y: cb.position.y },
          gravityRadius: cb.gravityRadius,
        };

        if (cb.radius !== undefined) {
          serializedCb.radius = cb.radius;
        }
        if (cb.hasAtmosphere !== undefined) {
          serializedCb.hasAtmosphere = cb.hasAtmosphere;
        }
        if (cb.atmosphereLimitAltitude !== undefined) {
          serializedCb.atmosphereLimitAltitude = cb.atmosphereLimitAltitude;
        }
        if (cb.surfaceAirDensity !== undefined) {
          serializedCb.surfaceAirDensity = cb.surfaceAirDensity;
        }
        if (cb.scaleHeight !== undefined) {
          serializedCb.scaleHeight = cb.scaleHeight;
        }
        return serializedCb;
      });

    return {
      simulationTick: this.currentTick, // <<< MODIFIED THIS LINE
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

  public fromJSON(state: ISerializedPhysicsEngineState): void {
    if (this.internalLoggingEnabled) {
      console.log(
        "PhysicsEngine.fromJSON called. Resetting and loading state."
      );
    }
    // Reset existing engine state
    Matter.World.clear(this.world, false); // Clear composites, bodies, constraints
    Matter.Engine.clear(this.engine); // Clear engine events, etc.
    this.celestialBodies = [];
    this.localBodyCache.clear();
    this.bodyIdCounter = 0; // Reset counter if it's used for IDs managed by PhysicsEngine
    this.currentTick =
      state.simulationTick !== undefined ? state.simulationTick : 0;

    // Restore engine properties
    this.fixedTimeStepMs = state.fixedTimeStepMs || this.fixedTimeStepMs; // Corrected: No 'engine' sub-object
    this.G = state.G || this.G; // Corrected: No 'engine' sub-object
    // Gravity is managed by PhysicsEngine, defaults are set in constructor/setExternalMatterEngine

    // Restore celestial bodies
    if (state.celestialBodies) {
      this.celestialBodies = state.celestialBodies.map((scb) => ({
        // Map ICelestialBodyData to ICelestialBody
        id: scb.id,
        mass: scb.mass,
        position: { x: scb.position.x, y: scb.position.y }, // Already plain object
        gravityRadius: scb.gravityRadius,
        radius: scb.radius,
        hasAtmosphere: scb.hasAtmosphere,
        atmosphereLimitAltitude: scb.atmosphereLimitAltitude,
        surfaceAirDensity: scb.surfaceAirDensity,
        scaleHeight: scb.scaleHeight,
      }));
    }

    const createdBodies: Map<number, Matter.Body> = new Map();
    const serializedBodiesMap: Map<number, ISerializedMatterBody> = new Map();
    if (state.world?.bodies) {
      state.world.bodies.forEach((sBody) =>
        serializedBodiesMap.set(sBody.id, sBody)
      );
    }

    if (state.world?.bodies) {
      for (const sBody of state.world.bodies) {
        if (!sBody.plugin?.creationParams) {
          if (this.internalLoggingEnabled) {
            console.warn(
              `Skipping body ID ${sBody.id} (label: ${sBody.label}) in fromJSON: missing creationParams.`
            );
          }
          continue;
        }

        let newBody: Matter.Body | undefined;
        const creationParams = sBody.plugin.creationParams;

        let renderOptions: Matter.IBodyRenderOptions = {};
        if (sBody.render) {
          renderOptions = {
            visible: sBody.render.visible,
            opacity: sBody.render.opacity,
            strokeStyle: sBody.render.strokeStyle,
            fillStyle: sBody.render.fillStyle,
            lineWidth: sBody.render.lineWidth,
          };

          let spriteOpts: Matter.IBodyRenderOptionsSprite | undefined =
            undefined;
          if (
            sBody.render.sprite &&
            typeof sBody.render.sprite.texture === "string"
          ) {
            spriteOpts = {
              texture: sBody.render.sprite.texture,
              xScale: sBody.render.sprite.xScale ?? 1, // Corrected: Default to 1
              yScale: sBody.render.sprite.yScale ?? 1, // Corrected: Default to 1
            };
          }
          renderOptions.sprite = spriteOpts;
        }

        const bodyOptions: Matter.IBodyDefinition = {
          angle: sBody.angle === null ? undefined : sBody.angle, // Corrected: null to undefined
          angularVelocity:
            sBody.angularVelocity === null ? undefined : sBody.angularVelocity, // Corrected: null to undefined
          // area: sBody.area, // Removed: Not in ISerializedMatterBody, derived by Matter
          // axes: sBody.axes?.map((a: ISerializedVector) => ({ ...a })), // Removed: Not in ISerializedMatterBody
          // bounds: sBody.bounds && { // Removed: Not in ISerializedMatterBody, derived by Matter
          //   min: { ...(sBody.bounds.min || { x: 0, y: 0 }) },
          //   max: { ...(sBody.bounds.max || { x: 0, y: 0 }) },
          // },
          collisionFilter: sBody.collisionFilter && {
            // Assuming sBody.collisionFilter structure matches
            category: sBody.collisionFilter.category,
            group: sBody.collisionFilter.group,
            mask: sBody.collisionFilter.mask,
          },
          density: sBody.density,
          // force: { ...(sBody.force || { x: 0, y: 0 }) }, // Removed: Not in ISerializedMatterBody, transient
          friction: sBody.friction,
          frictionAir: sBody.frictionAir,
          frictionStatic: sBody.frictionStatic,
          id: sBody.id, // Matter.js will manage this if not unique, but good to provide
          inertia: sBody.inertia,
          inverseInertia: sBody.inverseInertia,
          inverseMass: sBody.inverseMass,
          isSensor: sBody.isSensor,
          isSleeping: sBody.isSleeping,
          isStatic: sBody.isStatic,
          label: sBody.label || `body_${sBody.id}`,
          mass: sBody.mass,
          // motion: sBody.motion, // Removed: Not in ISerializedMatterBody, transient
          // parent: sBody.parent ? createdBodies.get(sBody.parent.id) : undefined, // Removed: Not in ISerializedMatterBody, handled by parts
          plugin: {
            dragCoefficientArea: sBody.plugin.dragCoefficientArea,
            effectiveNoseRadius: sBody.plugin.effectiveNoseRadius,
            currentHeatFlux: sBody.plugin.currentHeatFlux,
            creationParams: sBody.plugin.creationParams,
          } as ICustomBodyPlugin,
          position: { ...(sBody.position || { x: 0, y: 0 }) },
          render: renderOptions,
          restitution: sBody.restitution,
          // sleepCounter: sBody.sleepCounter, // Removed: Not in ISerializedMatterBody, transient
          // sleepThreshold: sBody.sleepThreshold, // Removed: Not in ISerializedMatterBody or engine global
          slop: sBody.slop,
          // timeScale: sBody.timeScale, // Removed: Not in ISerializedMatterBody
          // torque: sBody.torque, // Removed: Not in ISerializedMatterBody, transient
          type: sBody.type === "body" ? undefined : sBody.type, // Matter.Body.create expects 'body' to be undefined for type
          velocity: { ...(sBody.velocity || { x: 0, y: 0 }) },
          // vertices: sBody.vertices?.map((v: ISerializedVector) => ({ ...v })), // Removed: Use creationParams for polygons
        };

        if (
          bodyOptions.type === "composite" &&
          creationParams.type !== "rocket"
        ) {
          // If it's a generic composite not handled by a factory, we might need to skip direct creation here
          // and handle it in a separate pass or ensure its parts are processed first.
          // For now, we primarily expect rockets as compound bodies handled by factories,
          // or simple bodies.
          // This path is for bodies that have sBody.type === 'composite' but no specific factory.
          // We will attempt to create it using Matter.Body.create later, assuming parts are set correctly.
        }

        if (creationParams.type === "rocket") {
          // Rocket factory handles its own parts based on its internal definition,
          // not from sBody.parts directly here.
          newBody = this.createRocketBody(
            bodyOptions.position?.x || 0,
            bodyOptions.position?.y || 0,
            bodyOptions
          );
        } else if (creationParams.type === "box") {
          newBody = this.createBox(
            bodyOptions.position?.x || 0,
            bodyOptions.position?.y || 0,
            creationParams.width,
            creationParams.height,
            bodyOptions
          );
        } else if (creationParams.type === "circle") {
          newBody = this.createCircle(
            bodyOptions.position?.x || 0,
            bodyOptions.position?.y || 0,
            creationParams.radius,
            bodyOptions
          );
        } else if (creationParams.type === "polygon") {
          if (creationParams.vertices) {
            // vertices are from creationParams
            newBody = Matter.Bodies.fromVertices(
              bodyOptions.position?.x || 0,
              bodyOptions.position?.y || 0,
              [creationParams.vertices], // fromVertices expects Vector[][]
              bodyOptions
            );
          }
        } else if (
          sBody.parts &&
          sBody.parts.length > 0 &&
          sBody.type === "composite" &&
          !newBody
        ) {
          // Fallback for generic composite bodies (not rockets handled by factory)
          // sBody.parts contains IDs of part bodies. These parts should have already been created
          // in this loop and exist in `createdBodies`.
          const actualPartBodies: Matter.Body[] = [];
          for (const partId of sBody.parts) {
            // partId is a number
            const partMatterBody = createdBodies.get(partId);
            if (partMatterBody) {
              actualPartBodies.push(partMatterBody);
            } else {
              if (this.internalLoggingEnabled) {
                console.warn(
                  `Could not find already created Matter.Body for part ID ${partId} when reconstructing composite ${sBody.label}`
                );
              }
            }
          }
          if (actualPartBodies.length > 0) {
            // Ensure bodyOptions for the composite parent don't themselves define parts that conflict.
            // Matter.Body.create will set the .parent property on the parts.
            const compositeOptions = { ...bodyOptions };
            delete compositeOptions.parts; // Remove if present from sBody, use actualPartBodies

            newBody = Matter.Body.create({
              ...compositeOptions,
              parts: actualPartBodies,
            });
            // After Matter.Body.create with parts, the parts are cloned, and their .parent is set.
            // We might need to update `createdBodies` to store these new part instances if we need to reference them later.
            // For now, assume the parent `newBody` is the main reference.
          } else {
            if (this.internalLoggingEnabled) {
              console.warn(
                `Composite body ${sBody.label} (ID: ${sBody.id}) had part IDs listed but no corresponding Matter.Body parts were found/recreated.`
              );
            }
          }
        }

        if (newBody) {
          // Apply post-creation properties that might not be fully set by options or factories
          if (sBody.velocity)
            Matter.Body.setVelocity(newBody, { ...sBody.velocity });
          if (sBody.angularVelocity !== null)
            Matter.Body.setAngularVelocity(newBody, sBody.angularVelocity); // Corrected: Check for null
          if (sBody.position)
            Matter.Body.setPosition(newBody, { ...sBody.position });
          if (sBody.angle !== null) Matter.Body.setAngle(newBody, sBody.angle); // Corrected: Check for null
          if (sBody.isSleeping !== undefined)
            Matter.Sleeping.set(newBody, sBody.isSleeping); // Corrected: Matter.Sleeping.set

          // Mass and inertia are usually set by density/geometry via factory, or by direct options.
          // Explicitly setting them post-creation if they were in sBody:
          if (sBody.mass !== undefined)
            Matter.Body.setMass(newBody, sBody.mass);
          if (sBody.inertia !== undefined)
            Matter.Body.setInertia(newBody, sBody.inertia);

          // Add to world and cache
          // Note: factory methods (createBox, etc.) ALREADY add to world and localBodyCache.
          // If newBody was created by a factory, this.addBody might be redundant or harmless.
          // If created by Matter.Bodies.fromVertices or Matter.Body.create, it needs to be added.
          if (
            !this.localBodyCache.has(newBody.label) &&
            !this.world.bodies.includes(newBody)
          ) {
            this.addBody(newBody); // Adds to world and localBodyCache
          } else if (
            this.localBodyCache.has(newBody.label) &&
            !this.world.bodies.includes(newBody)
          ) {
            // It's in cache but not world (can happen if factory adds to cache but not world, though unlikely for ours)
            Matter.Composite.add(this.world, newBody);
          } else if (
            !this.localBodyCache.has(newBody.label) &&
            this.world.bodies.includes(newBody)
          ) {
            // In world but not cache (e.g. if a factory added to world but not cache)
            this.localBodyCache.set(newBody.label, newBody);
          }
          // Ensure the final body instance (which might be a clone if parts were involved) is in createdBodies
          createdBodies.set(sBody.id, newBody);

          if (this.internalLoggingEnabled) {
            console.log(
              `Recreated/Processed body ID ${newBody.id} (original sBody.id ${
                sBody.id
              }, label: ${newBody.label}) using type: ${
                creationParams?.type || sBody.type
              }`
            );
          }
        } else {
          if (this.internalLoggingEnabled) {
            console.warn(
              `Failed to recreate body ID ${sBody.id} (label: ${sBody.label}). No suitable creation logic found or parts were empty.`
            );
          }
        }
      }
    }

    if (this.internalLoggingEnabled) {
      console.log("PhysicsEngine.fromJSON state loading completed.");
      console.log(
        `Engine has ${
          Matter.Composite.allBodies(this.world).length
        } bodies after fromJSON.`
      );
    }
  }
}
