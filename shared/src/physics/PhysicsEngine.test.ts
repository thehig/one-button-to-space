import { describe, it, expect, beforeEach, vi } from "vitest";
import Matter from "matter-js";
import { PhysicsEngine } from "./PhysicsEngine";
import { FIXED_TIMESTEP, CollisionCategories } from "./constants";

// Mock console methods to prevent output during tests
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});

describe("PhysicsEngine", () => {
  let physicsEngine: PhysicsEngine;

  beforeEach(() => {
    // Create a new engine instance for each test
    physicsEngine = new PhysicsEngine();
  });

  afterEach(() => {
    // Clean up the engine after each test
    physicsEngine.destroy();
  });

  it("should initialize with an engine and world", () => {
    expect(physicsEngine.getEngine()).toBeDefined();
    expect(physicsEngine.getWorld()).toBeDefined();
  });

  it("should add and retrieve a body", () => {
    const body = Matter.Bodies.rectangle(100, 100, 10, 10);
    physicsEngine.addBody(body);
    const bodies = physicsEngine.getAllBodies();
    expect(bodies).toContain(body);
    expect(physicsEngine.getBodyById(body.id)).toBe(body);
  });

  it("should remove a body", () => {
    const body = Matter.Bodies.rectangle(100, 100, 10, 10);
    physicsEngine.addBody(body);
    expect(physicsEngine.getAllBodies()).toContain(body);
    physicsEngine.removeBody(body);
    expect(physicsEngine.getAllBodies()).not.toContain(body);
    expect(physicsEngine.getBodyById(body.id)).toBeNull();
  });

  it("should apply gravity over time (manual step)", () => {
    const startY = 100;
    const body = Matter.Bodies.circle(100, startY, 10, { label: "testball" });
    physicsEngine.addBody(body);

    // Simulate roughly 1 second (60 steps)
    let currentTime = 0;
    for (let i = 0; i < 60; i++) {
      currentTime += FIXED_TIMESTEP;
      physicsEngine.manualStep(currentTime);
    }

    const finalPosition = physicsEngine.getPosition(body);
    // Expect the body to have moved down due to gravity
    expect(finalPosition.y).toBeGreaterThan(startY);
    // Expect x position to remain (approx) the same as gravity is only on y
    expect(finalPosition.x).toBeCloseTo(100);
  });

  it("should produce deterministic results with manual stepping", () => {
    // --- Run 1 ---
    const engine1 = new PhysicsEngine();
    const body1 = Matter.Bodies.rectangle(50, 50, 20, 20, { label: "box1" });
    engine1.addBody(body1);
    Matter.Body.setVelocity(body1, { x: 1, y: -1 }); // Initial velocity
    let time1 = 0;
    for (let i = 0; i < 100; i++) {
      time1 += FIXED_TIMESTEP;
      engine1.manualStep(time1);
    }
    const finalPos1 = engine1.getPosition(body1);
    const finalVel1 = engine1.getVelocity(body1);
    const finalAngle1 = engine1.getAngle(body1);
    engine1.destroy();

    // --- Run 2 ---
    const engine2 = new PhysicsEngine();
    const body2 = Matter.Bodies.rectangle(50, 50, 20, 20, { label: "box2" });
    engine2.addBody(body2);
    Matter.Body.setVelocity(body2, { x: 1, y: -1 }); // Identical initial velocity
    let time2 = 0;
    for (let i = 0; i < 100; i++) {
      time2 += FIXED_TIMESTEP;
      engine2.manualStep(time2);
    }
    const finalPos2 = engine2.getPosition(body2);
    const finalVel2 = engine2.getVelocity(body2);
    const finalAngle2 = engine2.getAngle(body2);
    engine2.destroy();

    // --- Compare Results ---
    // Use toBeCloseTo for floating point comparisons
    expect(finalPos2.x).toBeCloseTo(finalPos1.x);
    expect(finalPos2.y).toBeCloseTo(finalPos1.y);
    expect(finalVel2.x).toBeCloseTo(finalVel1.x);
    expect(finalVel2.y).toBeCloseTo(finalVel1.y);
    expect(finalAngle2).toBeCloseTo(finalAngle1);
  });

  it("should create a rocket with correct properties", () => {
    const rocket = physicsEngine.createRocket(200, 300);
    expect(rocket).toBeDefined();
    expect(rocket.label).toBe("rocket");
    expect(rocket.collisionFilter.category).toBe(CollisionCategories.ROCKET);
    expect(physicsEngine.getBodyById(rocket.id)).toBe(rocket);
  });

  // TODO: Add more tests for:
  // - Runner determinism (if using runner)
  // - Applying forces, torques
  // - Collision event triggering (might need mocks or specific scenarios)
  // - Query methods (queryPoint, queryRegion, queryRay)
  // - createPlanet, createDebris methods
  // - setGravity, setTimeScale
});
