import Matter from "matter-js";
import {
  CollisionCategories,
  CollisionMasks,
  createCollisionFilter,
} from "../constants/collisionCategories";

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
  // other custom flags or data can be added here
}

export class PhysicsEngine {
  private engine: Matter.Engine;
  private world: Matter.World;
  private fixedTimeStepMs: number = 1000 / 60; // e.g., 60 FPS
  private accumulatedTime: number = 0;
  private celestialBodies: ICelestialBody[] = []; // For variable gravity
  private G: number = 0.001; // Gravitational constant, adjust as needed
  // Potentially a renderer if we want to debug draw on server or share debug logic
  // private renderer: Matter.Render;

  constructor(fixedTimeStepMs: number = 1000 / 60) {
    this.fixedTimeStepMs = fixedTimeStepMs;
    // Initialize the Matter.js engine
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;

    // Disable global engine gravity; we will apply it manually or variably
    this.engine.gravity.scale = 0;
    // this.engine.gravity.y = 1; // Old simple gravity

    console.log("PhysicsEngine initialized");
  }

  public init(celestialBodies?: ICelestialBody[]): void {
    if (celestialBodies) {
      this.celestialBodies = celestialBodies;
    }
    // Example: Add a default central celestial body if none provided
    // if (this.celestialBodies.length === 0) {
    //   this.celestialBodies.push({ id: 'earth', mass: 5.972e10, position: { x: 400, y: 3000 }, gravityRadius: 5000 });
    // }
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
          const distanceSq = Matter.Vector.magnitudeSquared(dVector);
          if (
            distanceSq === 0 ||
            distanceSq > celestial.gravityRadius * celestial.gravityRadius
          )
            continue;

          const forceMagnitude =
            (this.G * celestial.mass * body.mass) / distanceSq;
          const force = Matter.Vector.mult(
            Matter.Vector.normalise(dVector),
            forceMagnitude
          );
          totalForce = Matter.Vector.add(totalForce, force);
        }
        Matter.Body.applyForce(body, body.position, totalForce);
      } else {
        // Fallback to simple downward gravity if no celestial bodies are defined
        // This mimics the old global gravity but applied per body
        const downwardGravityForce = { x: 0, y: body.mass * 0.001 * 9.81 }; // 0.001 is an arbitrary world scale factor
        Matter.Body.applyForce(body, body.position, downwardGravityForce);
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
      Matter.Body.applyForce(body, body.position, dragForce);
    }
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
    this.accumulatedTime += deltaMs;
    while (this.accumulatedTime >= this.fixedTimeStepMs) {
      // Apply custom forces like gravity before stepping the engine
      this.applyGravitationalForces();
      this.applyAtmosphericDragForces(); // Apply drag

      Matter.Engine.update(this.engine, this.fixedTimeStepMs);
      this.accumulatedTime -= this.fixedTimeStepMs;
    }
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
    force: Matter.Vector
  ): void {
    Matter.Body.applyForce(body, position, force);
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

  // Add more methods as needed for interacting with the physics world
  // e.g., creating bodies, applying forces, handling collisions
}
