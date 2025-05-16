import Matter from "matter-js";
import { FIXED_TIMESTEP, GRAVITY, CollisionCategories } from "./constants";

export class PhysicsEngine {
  private engine: Matter.Engine;
  private world: Matter.World;
  private runner: Matter.Runner; // Optional: Use Matter.Runner or manual stepping

  constructor() {
    console.log("Initializing PhysicsEngine...");
    this.engine = Matter.Engine.create();
    this.world = this.engine.world;
    this.world.gravity.x = GRAVITY.x;
    this.world.gravity.y = GRAVITY.y;

    // Optional: Use Matter.Runner for automatic stepping
    this.runner = Matter.Runner.create({
      delta: FIXED_TIMESTEP,
      isFixed: true,
    });

    this.setupCollisionEvents(); // Call setup method

    // Example: Basic setup complete
    console.log("PhysicsEngine initialized with gravity:", this.world.gravity);

    // Example: Add ground (optional, for testing)
    // const ground = Matter.Bodies.rectangle(400, 610, 810, 60, { isStatic: true });
    // this.addBody(ground);
  }

  private setupCollisionEvents(): void {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      const pairs = event.pairs;
      // Process collision starts
      // console.log('Collision Start:', pairs.length, 'pairs');
      for (const pair of pairs) {
        const { bodyA, bodyB } = pair;
        // Example: Check collision between specific categories
        // if ((bodyA.collisionFilter.category === CollisionCategories.ROCKET && bodyB.collisionFilter.category === CollisionCategories.PLANET) ||
        //     (bodyB.collisionFilter.category === CollisionCategories.ROCKET && bodyA.collisionFilter.category === CollisionCategories.PLANET)) {
        //     console.log('Rocket collided with Planet!');
        // }
      }
    });

    Matter.Events.on(this.engine, "collisionActive", (event) => {
      const pairs = event.pairs;
      // Process ongoing collisions
      // console.log('Collision Active:', pairs.length, 'pairs');
    });

    Matter.Events.on(this.engine, "collisionEnd", (event) => {
      const pairs = event.pairs;
      // Process collision ends
      // console.log('Collision End:', pairs.length, 'pairs');
    });
    console.log("Collision events setup.");
  }

  // --- Core Simulation Loop ---

  /**
   * Steps the physics simulation forward manually by one fixed step.
   * Should be called in a fixed timestep loop controlled by the consumer (e.g., PhysicsManager).
   * @param delta The fixed time step duration (e.g., FIXED_TIMESTEP)
   */
  public manualStep(delta: number): void {
    // Directly update the engine with the provided fixed delta
    Matter.Engine.update(this.engine, delta);
  }

  /**
   * Starts the automatic simulation stepping using Matter.Runner.
   * Alternative to manualStep.
   */
  public startRunner(): void {
    console.log("Starting Matter.Runner");
    Matter.Runner.run(this.runner, this.engine);
  }

  /**
   * Stops the automatic simulation stepping using Matter.Runner.
   */
  public stopRunner(): void {
    console.log("Stopping Matter.Runner");
    Matter.Runner.stop(this.runner);
  }

  // --- World/Engine Manipulation ---

  public setGravity(x: number, y: number): void {
    this.world.gravity.x = x;
    this.world.gravity.y = y;
    // console.log(`Gravity updated to (${x}, ${y})`);
  }

  public setTimeScale(scale: number): void {
    this.engine.timing.timeScale = scale;
    // console.log(`Timescale set to ${scale}`);
  }

  public getTimeScale(): number {
    return this.engine.timing.timeScale;
  }

  // --- Body Manipulation ---

  public addBody(body: Matter.Body): void {
    Matter.World.add(this.world, body);
    // console.log(`Body added: ${body.label || body.id}`);
  }

  public removeBody(body: Matter.Body): void {
    Matter.World.remove(this.world, body);
    // console.log(`Body removed: ${body.label || body.id}`);
  }

  public addComposite(composite: Matter.Composite): void {
    Matter.World.add(this.world, composite);
  }

  public removeComposite(composite: Matter.Composite): void {
    Matter.World.remove(this.world, composite);
  }

  public getAllBodies(): Matter.Body[] {
    return Matter.Composite.allBodies(this.world);
  }

  public getBodyById(id: number): Matter.Body | null {
    return Matter.Composite.get(this.world, id, "body") as Matter.Body | null;
  }

  // --- Applying Forces & Motion ---

  public applyForce(
    body: Matter.Body,
    position: Matter.Vector,
    force: Matter.Vector
  ): void {
    Matter.Body.applyForce(body, position, force);
  }

  public setVelocity(body: Matter.Body, velocity: Matter.Vector): void {
    Matter.Body.setVelocity(body, velocity);
  }

  public getVelocity(body: Matter.Body): Matter.Vector {
    return body.velocity;
  }

  public setPosition(body: Matter.Body, position: Matter.Vector): void {
    Matter.Body.setPosition(body, position);
  }

  public getPosition(body: Matter.Body): Matter.Vector {
    return body.position;
  }

  public setAngle(body: Matter.Body, angle: number): void {
    Matter.Body.setAngle(body, angle);
  }

  public getAngle(body: Matter.Body): number {
    return body.angle;
  }

  public setAngularVelocity(body: Matter.Body, velocity: number): void {
    Matter.Body.setAngularVelocity(body, velocity);
  }

  public getAngularVelocity(body: Matter.Body): number {
    return body.angularVelocity;
  }

  public setStatic(body: Matter.Body, isStatic: boolean): void {
    Matter.Body.setStatic(body, isStatic);
  }

  // --- World Querying ---

  /**
   * Finds all bodies whose bounding boxes overlap with the given bounds.
   */
  public queryRegion(bounds: Matter.Bounds): Matter.Body[] {
    return Matter.Query.region(this.getAllBodies(), bounds);
  }

  /**
   * Finds all bodies containing the given point.
   */
  public queryPoint(point: Matter.Vector): Matter.Body[] {
    return Matter.Query.point(this.getAllBodies(), point);
  }

  /**
   * Performs a raycast query and returns all collisions.
   */
  public queryRay(
    startPoint: Matter.Vector,
    endPoint: Matter.Vector,
    rayWidth?: number
  ): Matter.ICollision[] {
    return Matter.Query.ray(
      this.getAllBodies(),
      startPoint,
      endPoint,
      rayWidth
    );
  }

  // --- Body Creation ---

  public createRocket(
    x: number,
    y: number,
    options?: Matter.IBodyDefinition
  ): Matter.Body {
    const defaultOptions: Matter.IBodyDefinition = {
      label: "rocket",
      // TODO: Define actual rocket shape/vertices/radius
      collisionFilter: {
        category: CollisionCategories.ROCKET,
        mask:
          CollisionCategories.DEFAULT |
          CollisionCategories.PLANET |
          CollisionCategories.DEBRIS |
          CollisionCategories.ROCKET, // Collides with default, planets, debris, other rockets
      },
      // TODO: Set appropriate mass, friction, restitution, etc.
      density: 0.05, // Example density
      restitution: 0.1, // Low bounce
      frictionAir: 0.05, // Example air friction
    };

    const rocketOptions = { ...defaultOptions, ...options }; // Merge custom options

    // Example: Creating a simple rectangle rocket for now
    const width = 20;
    const height = 50;
    const body = Matter.Bodies.rectangle(x, y, width, height, rocketOptions);

    console.log(`Created rocket body at (${x}, ${y}) with ID ${body.id}`);
    this.addBody(body);
    return body;
  }

  public createPlanet(
    x: number,
    y: number,
    radius: number,
    options?: Matter.IBodyDefinition
  ): Matter.Body {
    const defaultOptions: Matter.IBodyDefinition = {
      isStatic: true,
      label: "planet",
      collisionFilter: {
        category: CollisionCategories.PLANET,
        mask:
          CollisionCategories.DEFAULT |
          CollisionCategories.ROCKET |
          CollisionCategories.DEBRIS, // Planets collide with default, rockets, debris
      },
      // Add other planet-specific properties (friction, restitution)
    };
    const planetOptions = { ...defaultOptions, ...options };
    const body = Matter.Bodies.circle(x, y, radius, planetOptions);
    this.addBody(body);
    return body;
  }

  public createDebris(
    x: number,
    y: number,
    size: number,
    options?: Matter.IBodyDefinition
  ): Matter.Body {
    const defaultOptions: Matter.IBodyDefinition = {
      label: "debris",
      collisionFilter: {
        category: CollisionCategories.DEBRIS,
        mask:
          CollisionCategories.DEFAULT |
          CollisionCategories.ROCKET |
          CollisionCategories.PLANET |
          CollisionCategories.DEBRIS, // Debris collides with everything
      },
      density: 0.01, // Lighter than rockets?
      frictionAir: 0.02, // Less drag?
      restitution: 0.4, // Bouncier?
    };
    const debrisOptions = { ...defaultOptions, ...options };
    // Example: create small rectangular debris
    const body = Matter.Bodies.rectangle(x, y, size, size, debrisOptions);
    this.addBody(body);
    return body;
  }

  // --- Getters ---

  public getEngine(): Matter.Engine {
    return this.engine;
  }

  public getWorld(): Matter.World {
    return this.world;
  }

  // --- Cleanup ---

  public destroy(): void {
    console.log("Destroying PhysicsEngine...");
    // Conditionally stop runner only if it exists
    if (this.runner) {
      try {
        Matter.Runner.stop(this.runner);
      } catch (e) {
        // Ignore errors if stop fails in non-browser env
        console.warn("Matter.Runner.stop failed (expected in Node env):", e);
      }
    }
    // Remove all engine events before clearing
    try {
      Matter.Events.off(this.engine);
    } catch (e) {
      console.warn("Matter.Events.off failed:", e);
    }
    // Clear world and engine
    try {
      Matter.World.clear(this.world, false);
      Matter.Engine.clear(this.engine);
    } catch (e) {
      console.warn("Matter world/engine clear failed:", e);
    }
    console.log("PhysicsEngine destroyed attempt finished.");
  }
}

console.log("PhysicsEngine class defined");
