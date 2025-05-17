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
  fillStyle: undefined, // Was "#B0B0B0"
  strokeStyle: undefined, // Was "#505050"
  lineWidth: undefined, // Was 1
  // visible and opacity are typically true/1 by default, handled in factories
  // No sprite by default
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

    let mergedRenderOptions: Matter.IBodyRenderOptions;

    if (typeof options?.render === "boolean" && options.render === false) {
      mergedRenderOptions = { visible: false };
    } else if (
      options?.render === undefined ||
      (typeof options?.render === "boolean" && options.render === true)
    ) {
      // Render with full defaults from DefaultRender, plus explicit visible/opacity
      mergedRenderOptions = {
        visible: true,
        opacity: 1,
        fillStyle: DefaultRender.fillStyle, // Will be undefined
        strokeStyle: DefaultRender.strokeStyle, // Will be undefined
        lineWidth: DefaultRender.lineWidth, // Will be undefined
        // sprite: undefined, // Explicitly no sprite by default
      };
    } else {
      // options.render is an object
      const userRenderObject = options.render;
      mergedRenderOptions = {
        visible: userRenderObject.visible ?? true,
        opacity: userRenderObject.opacity ?? 1,
        strokeStyle: userRenderObject.strokeStyle ?? DefaultRender.strokeStyle,
        lineWidth: userRenderObject.lineWidth ?? DefaultRender.lineWidth,
        fillStyle: userRenderObject.fillStyle ?? DefaultRender.fillStyle,
      };
      if (userRenderObject.sprite) {
        mergedRenderOptions.sprite = {
          texture: userRenderObject.sprite.texture,
          xScale: userRenderObject.sprite.xScale ?? 1,
          yScale: userRenderObject.sprite.yScale ?? 1,
        };
      }
    }

    const bodyOptions: Matter.IBodyDefinition = {
      collisionFilter: createCollisionFilter(
        CollisionCategories.DEFAULT,
        CollisionMasks.DEFAULT
      ),
      ...options,
      render: mergedRenderOptions,
      plugin: {
        ...(options?.plugin || {}),
        creationParams: { type: "box", width, height },
      } as ICustomBodyPlugin,
    };
    // Ensure label is part of the final options for Matter.js
    if (finalLabel) bodyOptions.label = finalLabel;

    const box = Matter.Bodies.rectangle(x, y, width, height, bodyOptions);
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

    let mergedRenderOptions: Matter.IBodyRenderOptions;

    if (typeof options?.render === "boolean" && options.render === false) {
      mergedRenderOptions = { visible: false };
    } else if (
      options?.render === undefined ||
      (typeof options?.render === "boolean" && options.render === true)
    ) {
      // Render with full defaults from DefaultRender, plus explicit visible/opacity
      mergedRenderOptions = {
        visible: true,
        opacity: 1,
        fillStyle: DefaultRender.fillStyle, // Will be undefined
        strokeStyle: DefaultRender.strokeStyle, // Will be undefined
        lineWidth: DefaultRender.lineWidth, // Will be undefined
        // sprite: undefined, // Explicitly no sprite by default
      };
    } else {
      // options.render is an object
      const userRenderObject = options.render;
      mergedRenderOptions = {
        visible: userRenderObject.visible ?? true,
        opacity: userRenderObject.opacity ?? 1,
        strokeStyle: userRenderObject.strokeStyle ?? DefaultRender.strokeStyle,
        lineWidth: userRenderObject.lineWidth ?? DefaultRender.lineWidth,
        fillStyle: userRenderObject.fillStyle ?? DefaultRender.fillStyle,
      };
      if (userRenderObject.sprite) {
        mergedRenderOptions.sprite = {
          texture: userRenderObject.sprite.texture,
          xScale: userRenderObject.sprite.xScale ?? 1,
          yScale: userRenderObject.sprite.yScale ?? 1,
        };
      }
    }

    const bodyOptions: Matter.IBodyDefinition = {
      collisionFilter: createCollisionFilter(
        CollisionCategories.DEFAULT,
        CollisionMasks.DEFAULT
      ),
      ...options,
      render: mergedRenderOptions,
      plugin: {
        ...(options?.plugin || {}),
        creationParams: { type: "circle", radius },
      } as ICustomBodyPlugin,
    };
    // Ensure label is part of the final options for Matter.js
    if (finalLabel) bodyOptions.label = finalLabel;

    const circle = Matter.Bodies.circle(x, y, radius, bodyOptions);
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
      fillStyle: string | undefined | null; // Allow undefined/null for part-specific defaults to mean "Matter default"
      strokeStyle?: string | undefined | null;
      lineWidth?: number | undefined | null;
    }): Matter.IBodyRenderOptions => {
      const inputRender = options?.render; // Compound body's render option

      let finalRender: Matter.IBodyRenderOptions;

      if (typeof inputRender === "boolean" && inputRender === false) {
        // If compound body is not rendered, parts are also not rendered.
        finalRender = { visible: false };
      } else if (
        inputRender === undefined ||
        (typeof inputRender === "boolean" && inputRender === true)
      ) {
        // Compound body rendered with defaults, parts use their specific defaults.
        finalRender = {
          visible: true,
          opacity: 1,
          fillStyle:
            partDefaults.fillStyle === null
              ? undefined
              : partDefaults.fillStyle,
          strokeStyle:
            partDefaults.strokeStyle === null
              ? undefined
              : partDefaults.strokeStyle ?? DefaultRender.strokeStyle,
          lineWidth:
            partDefaults.lineWidth === null
              ? undefined
              : partDefaults.lineWidth ?? DefaultRender.lineWidth,
        };
      } else {
        // inputRender is an object (for the compound body)
        finalRender = {
          visible: true,
          opacity: 1,
          fillStyle:
            partDefaults.fillStyle === null
              ? undefined
              : partDefaults.fillStyle,
          strokeStyle:
            partDefaults.strokeStyle === null
              ? undefined
              : partDefaults.strokeStyle ?? DefaultRender.strokeStyle,
          lineWidth:
            partDefaults.lineWidth === null
              ? undefined
              : partDefaults.lineWidth ?? DefaultRender.lineWidth,
        };

        finalRender.visible = inputRender.visible ?? finalRender.visible;
        finalRender.opacity = inputRender.opacity ?? finalRender.opacity;

        if (inputRender.fillStyle !== undefined) {
          finalRender.fillStyle =
            inputRender.fillStyle === null ? undefined : inputRender.fillStyle;
        }
        if (inputRender.strokeStyle !== undefined) {
          finalRender.strokeStyle =
            inputRender.strokeStyle === null
              ? undefined
              : inputRender.strokeStyle;
        }
        if (inputRender.lineWidth !== undefined) {
          finalRender.lineWidth =
            inputRender.lineWidth === null ? undefined : inputRender.lineWidth;
        }

        if (
          inputRender.sprite &&
          typeof inputRender.sprite.texture === "string"
        ) {
          finalRender.sprite = {
            texture: inputRender.sprite.texture,
            xScale: inputRender.sprite.xScale ?? 1,
            yScale: inputRender.sprite.yScale ?? 1,
          };
        } else {
          // Ensure sprite is not carried over if not in inputRender
          delete finalRender.sprite;
        }
      }
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
        render: getPartRenderOpts({ fillStyle: "#C0C0C0" }), // Silver - specific part default
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
        render: getPartRenderOpts({ fillStyle: "#D3D3D3" }), // Light grey - specific part default
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
        render: getPartRenderOpts({ fillStyle: "#A9A9A9" }), // Dark grey - specific part default
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
      const fallbackRenderOptions: Matter.IBodyRenderOptions = {};
      if (typeof options?.render === "boolean" && options.render === false) {
        fallbackRenderOptions.visible = false;
      } else {
        fallbackRenderOptions.visible = true;
        fallbackRenderOptions.fillStyle = DefaultRender.fillStyle; // undefined
      }
      const fallbackBox = this.createBox(x, y, 20, 80, {
        label: `${labelPrefix}_fallback`,
        collisionFilter: mainCollisionFilter,
        plugin: { creationParams: { type: "rocket" } }, // Still mark as rocket type
        render: fallbackRenderOptions,
      });
      this.localBodyCache.set(fallbackBox.label, fallbackBox);
      return fallbackBox;
    }

    const rocketBody = Matter.Body.create({
      parts: parts,
      label: labelPrefix,
      collisionFilter: mainCollisionFilter,
      plugin: { creationParams: { type: "rocket" } } as ICustomBodyPlugin,
      // Render options for the compound body itself
      render: (() => {
        if (typeof options?.render === "boolean" && options.render === false) {
          return { visible: false };
        }
        if (
          options?.render === undefined ||
          (typeof options?.render === "boolean" && options.render === true)
        ) {
          // Compound body itself is often not directly visible, or uses a default style if it were
          return { visible: false, fillStyle: DefaultRender.fillStyle }; // fillStyle will be undefined
        }
        // If options.render is an object, pass it through
        return options.render;
      })(),
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

        // ***** NEW toJSON DEBUG LOG *****
        if (this.internalLoggingEnabled && body.label === "fallingObject") {
          console.log(
            `[DEBUG toJSON] For 'fallingObject': body.plugin: %j`,
            body.plugin
          );
          console.log(
            `[DEBUG toJSON] For 'fallingObject': pluginData.creationParams: %j`,
            pluginData.creationParams
          );
        }
        // ***** END NEW toJSON DEBUG LOG *****

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
            },
          } as ISerializedBodyRenderOptions,
          plugin: {
            dragCoefficientArea: pluginData.dragCoefficientArea ?? null,
            effectiveNoseRadius: pluginData.effectiveNoseRadius ?? null,
            currentHeatFlux: pluginData.currentHeatFlux ?? null,
            creationParams: pluginData.creationParams,
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
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
    this.celestialBodies = [];
    this.localBodyCache.clear();
    this.bodyIdCounter = 0;
    this.currentTick =
      state.simulationTick !== undefined ? state.simulationTick : 0;

    console.log(
      `[DEBUG fromJSON] Start. this.world.id: ${this.world.id}, initial bodies: ${this.world.bodies.length}`
    ); // DEBUG

    this.fixedTimeStepMs = state.fixedTimeStepMs || this.fixedTimeStepMs;
    this.G = state.G || this.G;

    if (state.celestialBodies) {
      this.celestialBodies = state.celestialBodies.map((scb) => ({
        id: scb.id,
        mass: scb.mass,
        position: { x: scb.position.x, y: scb.position.y },
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
      console.log(
        `[DEBUG fromJSON] state.world.bodies.length: ${state.world.bodies.length}`
      ); // DEBUG
      state.world.bodies.forEach((sBody) =>
        serializedBodiesMap.set(sBody.id, sBody)
      );
    }

    if (state.world?.bodies) {
      for (const sBody of state.world.bodies) {
        try {
          // ***** NEW fromJSON DEBUG LOG *****
          if (this.internalLoggingEnabled && sBody.label === "fallingObject") {
            console.log(
              `[DEBUG fromJSON] For 'fallingObject' at loop start: sBody.plugin: %j`,
              sBody.plugin
            );
            console.log(
              `[DEBUG fromJSON] For 'fallingObject' at loop start: sBody.plugin.creationParams: %j`,
              sBody.plugin?.creationParams
            );
          }
          // ***** END NEW fromJSON DEBUG LOG *****

          if (this.internalLoggingEnabled) {
            console.log(
              `[DEBUG fromJSON] LOOP START for sBody.id: ${sBody?.id}, sBody.label: ${sBody?.label}. creationParams type: ${sBody?.plugin?.creationParams?.type}`
            );
          }

          // Existing log:
          if (this.internalLoggingEnabled) {
            console.log(
              `[DEBUG fromJSON] Processing sBody.label: ${sBody.label}, id: ${sBody.id}`
            );
          }

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

          // Prepare options for the factory, INCLUDING the ID.
          const bodyOptions: Matter.IBodyDefinition = {
            id: sBody.id, // <<< ENSURE THE ORIGINAL ID IS USED FOR CREATION
            label: sBody.label || `body_${sBody.id}`,
            // Position and angle are critical for factories
            position: { ...(sBody.position || { x: 0, y: 0 }) },
            angle: sBody.angle === null ? undefined : sBody.angle,
            isStatic: sBody.isStatic,
            isSensor: sBody.isSensor,
            collisionFilter: sBody.collisionFilter,
            render: sBody.render as Matter.IBodyRenderOptions, // Cast, assuming ISerializedBodyRenderOptions is compatible
            plugin: { ...sBody.plugin } as ICustomBodyPlugin, // Pass through plugin data (includes creationParams)
            mass: sBody.mass,
            inertia: sBody.inertia,
            density: sBody.density,
            restitution: sBody.restitution,
            friction: sBody.friction,
            frictionStatic: sBody.frictionStatic,
            frictionAir: sBody.frictionAir,
            slop: sBody.slop,
            // Other properties like velocity, angularVelocity, isSleeping are set later using Matter.Body.setX methods
            // Parts are handled specifically by createRocketBody or the generic composite creation logic
          };

          // ***** Log the options being passed to factories *****
          if (this.internalLoggingEnabled && sBody.label === "fallingObject") {
            console.log(
              `[DEBUG fromJSON] For 'fallingObject', bodyOptions being passed to factory: %j`,
              bodyOptions
            );
          }

          if (creationParams.type === "rocket") {
            newBody = this.createRocketBody(
              bodyOptions.position?.x || 0,
              bodyOptions.position?.y || 0,
              bodyOptions // Contains id: sBody.id
            );
            // createRocketBody adds to world & cache
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After createRocketBody for ${sBody.label}, world.id: ${this.world.id}, bodies: ${this.world.bodies.length}`
              );
            }
          } else if (creationParams.type === "box") {
            newBody = this.createBox(
              bodyOptions.position?.x || 0,
              bodyOptions.position?.y || 0,
              creationParams.width,
              creationParams.height,
              bodyOptions // Contains id: sBody.id
            );
            // createBox adds to world & cache
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After createBox for ${sBody.label}, world.id: ${this.world.id}, bodies: ${this.world.bodies.length}`
              );
            }
          } else if (creationParams.type === "circle") {
            newBody = this.createCircle(
              bodyOptions.position?.x || 0,
              bodyOptions.position?.y || 0,
              creationParams.radius,
              bodyOptions // Contains id: sBody.id
            );
            // createCircle adds to world & cache
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After createCircle (with UNIFIED options) for ${sBody.label}, world.id: ${this.world.id}, bodies: ${this.world.bodies.length}. newBody.id: ${newBody?.id}`
              );
            }
          } else if (creationParams.type === "polygon") {
            if (creationParams.vertices) {
              // Matter.Bodies.fromVertices does NOT add to world.
              newBody = Matter.Bodies.fromVertices(
                bodyOptions.position?.x || 0,
                bodyOptions.position?.y || 0,
                [creationParams.vertices],
                bodyOptions // Contains id: sBody.id
              );
              if (this.internalLoggingEnabled) {
                console.log(
                  `[DEBUG fromJSON] After fromVertices for ${sBody.label}, world.id: ${this.world.id}, bodies: ${this.world.bodies.length}`
                );
              }
            }
          } else if (
            sBody.parts &&
            sBody.parts.length > 0 &&
            sBody.type === "composite" &&
            !newBody
          ) {
            // Generic composite (not a rocket from our factory)
            const actualPartBodies: Matter.Body[] = [];
            sBody.parts.forEach((partId) => {
              const partMatterBody = createdBodies.get(partId);
              if (partMatterBody) actualPartBodies.push(partMatterBody);
            });

            if (actualPartBodies.length > 0) {
              const compositeSpecificOptions = { ...bodyOptions }; // Already has id: sBody.id
              delete compositeSpecificOptions.parts; // Parts are explicitly passed next
              newBody = Matter.Body.create({
                ...compositeSpecificOptions,
                parts: actualPartBodies,
              });
              // Matter.Body.create does not add to world.
              if (newBody && this.internalLoggingEnabled) {
                console.log(
                  `[DEBUG fromJSON] After generic composite creation for ${sBody.label}, world.id: ${this.world.id}, bodies: ${this.world.bodies.length}`
                );
              }
            }
          }

          if (this.internalLoggingEnabled) {
            console.log(
              `[DEBUG fromJSON] Just before 'if (newBody)' for ${
                sBody.label
              }. newBody is ${
                newBody ? "defined" : "UNDEFINED/NULL"
              }. newBody.label: ${newBody?.label}`
            );
          }

          if (newBody) {
            // Apply ALL sBody properties directly to the body that is already in the world
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before setVelocity for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (sBody.velocity)
              Matter.Body.setVelocity(newBody, { ...sBody.velocity });
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After setVelocity for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before setAngularVelocity for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (sBody.angularVelocity !== null)
              Matter.Body.setAngularVelocity(newBody, sBody.angularVelocity);
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After setAngularVelocity for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before setPosition for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (sBody.position)
              Matter.Body.setPosition(newBody, { ...sBody.position });
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After setPosition for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before setAngle for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (sBody.angle !== null)
              Matter.Body.setAngle(newBody, sBody.angle);
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After setAngle for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before Sleeping.set for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (sBody.isSleeping !== undefined)
              Matter.Sleeping.set(newBody, sBody.isSleeping);
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After Sleeping.set for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }

            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before mass/inertia sets for ${newBody.label} (already in world). world.id: ${this.world.id}, bodies: ${this.world.bodies.length}, sBody.mass: ${sBody.mass}, sBody.inertia: ${sBody.inertia}`
              );
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before setMass for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (sBody.mass !== undefined) {
              Matter.Body.setMass(newBody, sBody.mass);
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After setMass for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before setInertia for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (sBody.inertia !== undefined) {
              Matter.Body.setInertia(newBody, sBody.inertia);
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After setInertia for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Before plugin assignment for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }
            newBody.plugin = {
              ...newBody.plugin,
              ...sBody.plugin,
            } as ICustomBodyPlugin;
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] After plugin assignment for ${newBody.label}. world.bodies.length: ${this.world.bodies.length}`
              );
            }

            if (
              !this.localBodyCache.has(newBody.label) &&
              newBody.label &&
              this.internalLoggingEnabled
            ) {
              console.log(
                `[DEBUG fromJSON] Body ${newBody.label} (id: ${newBody.id}) was not in localCache. Adding.`
              );
              this.localBodyCache.set(newBody.label, newBody);
            }
            if (
              !this.world.bodies.includes(newBody) &&
              !Matter.Composite.get(this.world, newBody.id, newBody.type as any)
            ) {
              if (this.internalLoggingEnabled) {
                console.log(
                  `[DEBUG fromJSON] Body ${newBody.label} (id: ${newBody.id}) was NOT in world after property sets. Re-adding.`
                );
              }
              Matter.Composite.add(this.world, newBody);
            }

            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] Inside if(newBody) for ${newBody.label}, after all property sets. world.id: ${this.world.id}, bodies: ${this.world.bodies.length}`
              );
            }

            createdBodies.set(sBody.id, newBody);
          } else {
            if (this.internalLoggingEnabled) {
              console.log(
                `[DEBUG fromJSON] newBody was UNDEFINED for ${sBody.label}, skipping property setters.`
              );
            }
          }
        } catch (error) {
          // ***** NEW CATCH BLOCK *****
          console.error(
            `[DEBUG fromJSON] CAUGHT ERROR in loop for sBody.label: ${sBody?.label}, id: ${sBody?.id}:`,
            error
          );
        } // ***** END TRY-CATCH *****
      } // End of for loop

      // ***** NEW DEBUG BLOCK *****
      if (this.internalLoggingEnabled) {
        const finalWorldBodies = Matter.Composite.allBodies(this.world);
        const fallingObjectInFinalWorld = finalWorldBodies.find(
          (b) => b.label === "fallingObject"
        );
        console.log(
          `[DEBUG fromJSON] AFTER LOOP CHECK: world.id: ${this.world.id}, ` +
            `total bodies: ${finalWorldBodies.length}, ` +
            `fallingObject found: ${!!fallingObjectInFinalWorld} (label: ${
              fallingObjectInFinalWorld?.label
            }, id: ${fallingObjectInFinalWorld?.id})`
        );
      }
      // ***** END NEW DEBUG BLOCK *****

      if (this.internalLoggingEnabled) {
        console.log(
          `[DEBUG fromJSON] END of fromJSON. Final world.id: ${this.world.id}, bodies: ${this.world.bodies.length}`
        ); // DEBUG
        console.log("PhysicsEngine.fromJSON state loading completed.");
        console.log(
          `Engine has ${
            Matter.Composite.allBodies(this.world).length
          } bodies after fromJSON.`
        );
      }
    }
  }
}
