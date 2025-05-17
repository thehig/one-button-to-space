import Matter from "matter-js";
import { ICelestialBody, ICustomBodyPlugin } from "./PhysicsEngine";

export type ScenarioBodyType = "box" | "circle" | "rocket";

export interface ScenarioBodyInitialState {
  id: string; // Unique ID for this body within the scenario
  type: ScenarioBodyType;
  label?: string; // Corresponds to Matter.Body.label
  initialPosition: Matter.Vector;
  initialVelocity?: Matter.Vector;
  initialAngle?: number;
  initialAngularVelocity?: number;
  // Specific dimensions, required depending on type
  width?: number; // For box
  height?: number; // For box
  radius?: number; // For circle
  // General Matter.js body options, including plugin data
  options?: Partial<Matter.IBodyDefinition & { plugin: ICustomBodyPlugin }>;
}

export type ScenarioActionType = "applyForce"; // Future: "setVelocity", "setAngle", "createBody", etc.

export interface ScenarioAction {
  step: number; // The simulation step number at which this action occurs (e.g., 0 for before the first step)
  targetBodyId: string; // ID of the body this action applies to
  actionType: ScenarioActionType;
  // Parameters for specific actions - extend with a union type if more actions are added
  force?: Matter.Vector; // For applyForce
  applicationPoint?: Matter.Vector; // For applyForce (world coordinates)
}

export interface ScenarioEngineSettings {
  fixedTimeStepMs?: number;
  customG?: number;
  enableInternalLogging?: boolean;
}

export interface IScenario {
  id: string; // Unique identifier for the scenario
  description: string;
  engineSettings?: ScenarioEngineSettings;
  celestialBodies?: ICelestialBody[];
  initialBodies: ScenarioBodyInitialState[];
  actions?: ScenarioAction[];
  simulationSteps: number; // Total number of fixed steps to run for the main simulation phase
  // Expected outcomes could be defined here for programmatic validation,
  // or handled by the test runner consuming the scenario.
  // For now, assertions will remain in the .spec.ts files.
}

export const determinismBaseScenario: IScenario = {
  id: "determinism-base",
  description:
    "Base scenario for determinism and snapshot tests. Creates a box, applies a force, and runs for 10 steps.",
  engineSettings: {
    // Using default fixedTimeStepMs (1000/60) and default G (0.001)
    // No internal logging needed for this base scenario by default
  },
  celestialBodies: [], // No celestial bodies for this simple test
  initialBodies: [
    {
      id: "testBox1",
      type: "box",
      label: "testBox", // Matches label in original runStandardSimulation
      initialPosition: { x: 0, y: 0 },
      width: 10,
      height: 10,
      // No specific options needed beyond defaults for this body
    },
  ],
  actions: [
    {
      step: 0, // Apply before the first simulation step
      targetBodyId: "testBox1",
      actionType: "applyForce",
      force: { x: 10, y: 0 },
      applicationPoint: { x: 0, y: 0 }, // Applied at the body's initial center
    },
  ],
  simulationSteps: 10,
};

export const thrustScenario: IScenario = {
  id: "thrust-test",
  description: "Tests applying an upward thrust to a rocket body for one step.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [],
  initialBodies: [
    {
      id: "thrustRocket",
      type: "rocket", // This will use engine.createRocketBody()
      label: "testRocketThrust",
      initialPosition: { x: 0, y: 0 },
      // createRocketBody sets default density, frictionAir, etc.
      // If specific options were needed, they'd go into the options property here.
    },
  ],
  actions: [
    {
      step: 0, // Apply force at the beginning of the first step (before engine.fixedStep call)
      targetBodyId: "thrustRocket",
      actionType: "applyForce",
      force: { x: 0, y: -100 }, // Upward thrust
      // Assuming applicationPoint defaults to body's center if not specified, or we use current position.
      // For applyForceToBody, it's world position. Scenario runner can use body's current position for simplicity here.
      // For this scenario, the rocket is at (0,0) so {x:0, y:0} is fine for applicationPoint.
      applicationPoint: { x: 0, y: 0 },
    },
  ],
  simulationSteps: 1,
};

export const rotationScenario: IScenario = {
  id: "rotation-test",
  description:
    "Tests applying an off-center force to a box to induce rotation.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [],
  initialBodies: [
    {
      id: "rotationBox",
      type: "box",
      label: "testRotationBox",
      initialPosition: { x: 0, y: 0 },
      width: 20,
      height: 20,
    },
  ],
  actions: [
    {
      step: 0, // Apply force at the beginning of the first step
      targetBodyId: "rotationBox",
      actionType: "applyForce",
      force: { x: 50, y: 0 }, // Force to the right
      // Original test applies at world {x: body.x, y: body.y - 5}.
      // Since body is at (0,0), this is world {0, -5}.
      applicationPoint: { x: 0, y: -5 },
    },
  ],
  simulationSteps: 1,
};

export const atmosphericDragScenario: IScenario = {
  id: "atmospheric-drag-test",
  description: "Tests atmospheric drag on a body moving through an atmosphere.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [
    {
      id: "earth-like-drag-test",
      mass: 0, // Mass set to 0 to isolate drag effect
      position: { x: 0, y: 0 },
      gravityRadius: 6371000 * 10, // Matches original test
      radius: 6371000,
      hasAtmosphere: true,
      atmosphereLimitAltitude: 100000,
      surfaceAirDensity: 1.225,
      scaleHeight: 8500,
    },
  ],
  initialBodies: [
    {
      id: "dragTestBody",
      type: "box",
      label: "testDragBody",
      // Positioned relative to the celestial body's radius and initial altitude
      initialPosition: { x: 6371000 + 50000, y: 0 }, // earthLikeCelestialBody.radius + bodyInitialAltitude
      initialVelocity: { x: -1000, y: 0 }, // -bodyInitialSpeed
      width: 1,
      height: 1,
      options: {
        density: 8, // Increased mass to make drag effect a deceleration
        plugin: {
          dragCoefficientArea: 0.5, // dragArea
          effectiveNoseRadius: 0.1, // Required by ICustomBodyPlugin
        } as ICustomBodyPlugin,
      },
    },
  ],
  actions: [], // No explicit actions beyond initial setup and physics
  simulationSteps: 1,
};

export const atmosphericHeatingScenario: IScenario = {
  id: "atmospheric-heating-test",
  description: "Tests atmospheric heating on a body re-entering an atmosphere.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [
    {
      id: "earth-like-heating-test",
      mass: 5.972e24, // kg
      position: { x: 0, y: 0 },
      gravityRadius: 6371000 * 10, // meters
      radius: 6371000, // meters
      hasAtmosphere: true,
      atmosphereLimitAltitude: 100000, // 100 km
      surfaceAirDensity: 1.225, // kg/m^3
      scaleHeight: 8500, // meters
    },
  ],
  initialBodies: [
    {
      id: "heatingTestBody",
      type: "box", // Original test used a box
      label: "testEntryBodyHeating",
      // Positioned high along X-axis, relative to celestial body's radius + altitude
      initialPosition: { x: 6371000 + 90000, y: 0 }, // earthLikeCelestialBody.radius + bodyInitialAltitude (90km)
      initialVelocity: { x: -7000, y: 0 }, // -bodyInitialSpeed (7 km/s towards planet)
      width: 1, // Matches original test
      height: 1, // Matches original test
      options: {
        plugin: {
          effectiveNoseRadius: 0.5, // noseRadius from original test
          dragCoefficientArea: 0.1, // Example value, matches original test
        } as ICustomBodyPlugin,
      },
    },
  ],
  actions: [], // Heating is an environmental effect, no direct actions needed
  simulationSteps: 1, // Original test checks after one small step
};

export const denseAtmosphereDragScenario: IScenario = {
  id: "dense-atmospheric-drag-test",
  description: "Tests atmospheric drag in a very dense atmosphere.",
  engineSettings: {
    // Default engine settings
  },
  celestialBodies: [
    {
      id: "dense-planet-drag-test",
      mass: 0, // Mass not relevant for this drag-only test
      position: { x: 0, y: 0 },
      gravityRadius: 6371000 * 10,
      radius: 6371000,
      hasAtmosphere: true,
      atmosphereLimitAltitude: 100000,
      surfaceAirDensity: 122.5, // 100x standard Earth density
      scaleHeight: 8500,
    },
  ],
  initialBodies: [
    {
      id: "denseDragTestBody",
      type: "box",
      label: "testDenseDragBody",
      initialPosition: { x: 6371000 + 50000, y: 0 }, // planet.radius + bodyInitialAltitude
      initialVelocity: { x: -1000, y: 0 }, // -bodyInitialSpeed
      width: 1,
      height: 1,
      options: {
        density: 8, // Matches original test
        plugin: {
          dragCoefficientArea: 0.5, // dragArea from original test
          effectiveNoseRadius: 0.1, // Required by ICustomBodyPlugin
        } as ICustomBodyPlugin,
      },
    },
  ],
  actions: [],
  simulationSteps: 1, // Original test runs for 1 step
};

export const gravityPullLargeBodyScenario: IScenario = {
  id: "gravity-pull-large-body",
  description:
    "Tests gravitational pull from a large celestial body on a satellite.",
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: [
    {
      id: "earth-gravity-pull-large",
      mass: 5.972e8, // Matches original test's reduced mass
      position: { x: 0, y: 0 },
      gravityRadius: 10000,
      radius: 6371, // Physical radius for context
    },
  ],
  initialBodies: [
    {
      id: "satelliteGP",
      type: "circle",
      label: "satellite",
      initialPosition: { x: 1000, y: 0 }, // Matches original test
      radius: 5,
      options: {
        density: 0.01, // Matches original test
      },
    },
  ],
  actions: [], // No explicit actions, just gravity
  simulationSteps: 5, // Original test ran for 5 steps
};

export const gravityPullVeryLargeBodyScenario: IScenario = {
  id: "gravity-pull-very-large-body",
  description:
    "Tests gravitational pull from a VERY large celestial body on a satellite.",
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: [
    {
      id: "super-earth-gravity-pull",
      mass: 5.972e11, // Matches original test
      position: { x: 0, y: 0 },
      gravityRadius: 50000, // Matches original test
      radius: 12000, // Matches original test
    },
  ],
  initialBodies: [
    {
      id: "satelliteGPVeryLarge",
      type: "circle",
      label: "satellite-far", // Matches original test
      initialPosition: { x: 20000, y: 0 }, // Matches original test
      radius: 5,
      options: {
        density: 0.01, // Matches original test
      },
    },
  ],
  actions: [],
  simulationSteps: 5, // Original test ran for 5 steps
};

export const gravityPullSmallBodyScenario: IScenario = {
  id: "gravity-pull-small-body",
  description:
    "Tests gravitational pull from a SMALL celestial body on a satellite.",
  engineSettings: {
    // Default G, default timestep
  },
  celestialBodies: [
    {
      id: "small-planet-gravity-pull",
      mass: 5.972e5, // Matches original test
      position: { x: 0, y: 0 },
      gravityRadius: 1000, // Matches original test
      radius: 100, // Matches original test
    },
  ],
  initialBodies: [
    {
      id: "satelliteGPSmall",
      type: "circle",
      label: "satellite-close", // Matches original test
      initialPosition: { x: 200, y: 0 }, // Matches original test
      radius: 2, // Matches original test
      options: {
        density: 0.01, // Matches original test
      },
    },
  ],
  actions: [],
  simulationSteps: 5, // Original test ran for 5 steps
};

export const orbitLargeBodyScenario: IScenario = {
  id: "orbit-large-body",
  description: "Tests an object orbiting a large celestial body.",
  engineSettings: {
    customG: 0.001, // Matches G used in original test
    // Default timestep
  },
  celestialBodies: [
    {
      id: "earth-orbit-test-large", // Ensure unique ID
      mass: 5.972e5, // Matches original test
      position: { x: 0, y: 0 },
      gravityRadius: 100000, // Matches original test
      radius: 6371, // Matches original test (for context, not direct orbit calc)
    },
  ],
  initialBodies: [
    {
      id: "orbitingSatelliteLarge",
      type: "circle",
      label: "orbitingSatellite", // Matches original test
      // Initial position will be orbitalRadius along X, set in test
      initialPosition: { x: 10000, y: 0 }, // orbitalRadius from original test
      radius: 5, // Matches original test
      options: {
        density: 0.01, // Matches original test
        frictionAir: 0, // Crucial: NO AIR FRICTION, matches original
      },
      // initialVelocity will be calculated and set in the test based on orbital mechanics
    },
  ],
  actions: [],
  simulationSteps: 75, // Matches original test
};

export const orbitSmallBodyScenario: IScenario = {
  id: "orbit-small-body",
  description: "Tests an object orbiting a SMALL celestial body.",
  engineSettings: {
    customG: 0.001, // Matches G used in original test
    // Default timestep
  },
  celestialBodies: [
    {
      id: "small-planet-orbit-test", // Ensure unique ID
      mass: 5.972e5, // Matches original test
      position: { x: 0, y: 0 },
      gravityRadius: 5000, // Matches original test
      radius: 100, // Matches original test
    },
  ],
  initialBodies: [
    {
      id: "orbitingSatelliteSmall",
      type: "circle",
      label: "smallOrbitingSatellite", // Matches original test
      initialPosition: { x: 400, y: 0 }, // orbitalRadius from original test
      radius: 2, // Matches original test
      options: {
        density: 0.01, // Matches original test
        frictionAir: 0, // Crucial: NO AIR FRICTION, matches original
      },
      // initialVelocity calculated in test
    },
  ],
  actions: [],
  simulationSteps: 30, // Matches original test
};

export const eccentricOrbitScenario: IScenario = {
  id: "eccentric-orbit-large-body",
  description: "Tests an eccentric orbit around a large celestial body.",
  engineSettings: {
    customG: 0.001, // Matches G used in original test
    enableInternalLogging: false, // Default from original test (can be overridden by test runner if needed)
    // Default timestep
  },
  celestialBodies: [
    {
      id: "large-planet-eccentric-orbit-scenario", // Ensure unique ID
      mass: 5.972e3, // Matches original test (planetMass)
      position: { x: 0, y: 0 },
      gravityRadius: 1000 * 10, // perigeeRadius * 10 from original test
      radius: 1000 / 2, // perigeeRadius / 2 from original test
    },
  ],
  initialBodies: [
    {
      id: "eccentricSatelliteScenario",
      type: "circle",
      label: "eccentricSatellite", // Matches original test
      initialPosition: { x: 1000, y: 0 }, // perigeeRadius from original test
      radius: 5, // Matches original test
      options: {
        density: 0.01, // Matches original test
        frictionAir: 0, // Crucial: NO AIR FRICTION, matches original
      },
      // initialVelocity (specifically initialSpeed = v_circ * 1.5) calculated in test
    },
  ],
  actions: [],
  simulationSteps: 5000, // Matches original test
};

// Example of how a scenario might look (conceptual)
/*
const exampleScenario: IScenario = {
  id: "example-thrust",
  description: "A simple rocket thrust test",
  engineSettings: {
    fixedTimeStepMs: 1000 / 60,
  },
  celestialBodies: [],
  initialBodies: [
    {
      id: "myRocket",
      type: "rocket",
      label: "testRocket",
      initialPosition: { x: 0, y: 0 },
      options: { density: 0.001 }
    },
  ],
  actions: [
    {
      step: 0, // Apply before the first simulation step (or during setup)
      targetBodyId: "myRocket",
      actionType: "applyForce",
      force: { x: 0, y: -100 },
      applicationPoint: { x: 0, y: 0 }, // Assuming application at body's current CoM for simplicity
    },
  ],
  simulationSteps: 1,
};
*/
