import * as Matter from "matter-js";
import {
  PhysicsCommand,
  CommandType,
  InitWorldCommandPayload,
  AddBodyCommandPayload,
  StepSimulationCommandPayload,
  RemoveBodyCommandPayload,
  // IBodyDefinition, // Removed as it's implicitly used via Matter.IBodyDefinition
} from "./commands";

// TODO: Define Command interfaces/classes
// Example:
// interface PhysicsCommand {
//   type: string;
//   payload?: any;
// }

console.log("Physics Worker: Script loaded");

// TODO: Add Matter.js engine, world, and other necessary variables
let engine: Matter.Engine | undefined;
let world: Matter.World | undefined;
// let runner: Matter.Runner | undefined; // For stepping the simulation

// Keep track of bodies by ID for easier removal/update
const bodies: Map<string | number, Matter.Body> = new Map();

self.onmessage = (event: MessageEvent<PhysicsCommand>) => {
  console.log("Physics Worker: Message received from main thread:", event.data);
  const command = event.data;

  if (!engine || !world) {
    // Allow INIT_WORLD even if engine/world is not yet defined
    if (command.type !== CommandType.INIT_WORLD) {
      console.error(
        "Physics Worker: Engine not initialized. Please send INIT_WORLD command first."
      );
      self.postMessage({
        type: CommandType.ERROR,
        payload: {
          message: "Engine not initialized.",
          originalCommandType: command.type,
        },
        commandId: command.commandId,
      });
      return;
    }
  }

  switch (command.type) {
    case CommandType.INIT_WORLD:
      try {
        const payload = command.payload as InitWorldCommandPayload;
        engine = Matter.Engine.create();
        world = engine.world;
        bodies.clear(); // Clear any existing bodies from a previous init

        // Configure world based on payload
        if (payload.gravity) {
          world.gravity.x = payload.gravity.x;
          world.gravity.y = payload.gravity.y;
          if (payload.gravity.scale !== undefined) {
            world.gravity.scale = payload.gravity.scale;
          }
        }
        // TODO: Set world bounds if width/height are provided (e.g., for static boundaries)

        // --- ADD STATIC BOUNDARIES ---
        const wallOptions: Matter.IBodyDefinition = { isStatic: true };
        const ground = Matter.Bodies.rectangle(
          payload.width / 2,
          payload.height + 25,
          payload.width,
          50,
          wallOptions
        );
        const leftWall = Matter.Bodies.rectangle(
          -25,
          payload.height / 2,
          50,
          payload.height,
          wallOptions
        );
        const rightWall = Matter.Bodies.rectangle(
          payload.width + 25,
          payload.height / 2,
          50,
          payload.height,
          wallOptions
        );
        const ceiling = Matter.Bodies.rectangle(
          payload.width / 2,
          -25,
          payload.width,
          50,
          wallOptions
        );

        Matter.World.add(world, [ground, leftWall, rightWall, ceiling]);
        // We don't need to track these static bodies in our `bodies` map typically
        // --- END STATIC BOUNDARIES ---

        // --- ADD COLLISION LISTENER ---
        Matter.Events.on(engine, "collisionStart", (event) => {
          const pairs = event.pairs;
          const collisionEvents: Array<{
            bodyAId: string | number;
            bodyBId: string | number;
          }> = [];
          for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            // Use the IDs we assigned to the bodies
            if (pair.bodyA.id && pair.bodyB.id) {
              collisionEvents.push({
                bodyAId: pair.bodyA.id,
                bodyBId: pair.bodyB.id,
              });
            }
          }
          if (collisionEvents.length > 0) {
            // Send collision events back to the main thread
            self.postMessage({
              type: CommandType.PHYSICS_EVENTS,
              payload: { collisions: collisionEvents },
              // Note: No commandId here as it's an event, not a response to a command
            });
          }
        });
        // --- END COLLISION LISTENER ---

        // Example: Create a simple runner for stepping the simulation
        // runner = Matter.Runner.create();
        // Matter.Runner.run(runner, engine); // This would run the simulation automatically

        console.log(
          "Physics Worker: World initialized with boundaries and collision listener",
          payload
        );
        self.postMessage({
          type: CommandType.WORLD_INITIALIZED,
          payload: { success: true },
          commandId: command.commandId,
        });
      } catch (e: any) {
        console.error("Physics Worker: Error initializing world", e);
        self.postMessage({
          type: CommandType.ERROR,
          payload: { message: e.message, originalCommand: command },
          commandId: command.commandId,
        });
      }
      break;

    case CommandType.ADD_BODY:
      if (!engine || !world) break; // Should be caught by the check above, but as a safeguard
      try {
        const payload = command.payload as AddBodyCommandPayload;
        let body: Matter.Body | undefined;

        const bodyOptions = { ...payload.options, id: payload.id as number }; // Ensure ID is set on options if not native

        switch (payload.type) {
          case "rectangle":
            if (payload.width && payload.height) {
              body = Matter.Bodies.rectangle(
                payload.x,
                payload.y,
                payload.width,
                payload.height,
                bodyOptions
              );
            }
            break;
          case "circle":
            if (payload.radius) {
              body = Matter.Bodies.circle(
                payload.x,
                payload.y,
                payload.radius,
                bodyOptions
              );
            }
            break;
          case "polygon":
            if (payload.sides && payload.radius) {
              // Matter.Bodies.polygon needs radius and sides
              body = Matter.Bodies.polygon(
                payload.x,
                payload.y,
                payload.sides,
                payload.radius,
                bodyOptions
              );
            } else if (payload.vertices) {
              // Or can be created from vertices directly
              body = Matter.Bodies.fromVertices(
                payload.x,
                payload.y,
                [payload.vertices],
                bodyOptions
              ); // fromVertices expects Vector[][]
            }
            break;
          case "fromVertices":
            if (payload.vertices) {
              body = Matter.Bodies.fromVertices(
                payload.x,
                payload.y,
                [payload.vertices],
                bodyOptions
              );
            }
            break;
        }

        if (body) {
          Matter.World.add(world, body);
          bodies.set(payload.id, body); // Track the body
          console.log("Physics Worker: Body added", payload.id, body);
          self.postMessage({
            type: CommandType.BODY_ADDED,
            payload: { id: payload.id, success: true },
            commandId: command.commandId,
          });
        } else {
          throw new Error(`Invalid parameters for body type: ${payload.type}`);
        }
      } catch (e: any) {
        console.error("Physics Worker: Error adding body", e);
        self.postMessage({
          type: CommandType.ERROR,
          payload: { message: e.message, originalCommand: command },
          commandId: command.commandId,
        });
      }
      break;

    case CommandType.REMOVE_BODY:
      if (!engine || !world) break;
      try {
        const payload = command.payload as RemoveBodyCommandPayload;
        const bodyToRemove = bodies.get(payload.id);

        if (bodyToRemove) {
          Matter.World.remove(world, bodyToRemove);
          bodies.delete(payload.id);
          console.log("Physics Worker: Body removed", payload.id);
          self.postMessage({
            type: CommandType.BODY_REMOVED,
            payload: { id: payload.id, success: true },
            commandId: command.commandId,
          });
        } else {
          throw new Error(`Body with ID ${payload.id} not found for removal.`);
        }
      } catch (e: any) {
        console.error("Physics Worker: Error removing body", e);
        self.postMessage({
          type: CommandType.ERROR,
          payload: { message: e.message, originalCommand: command },
          commandId: command.commandId,
        });
      }
      break;

    case CommandType.STEP_SIMULATION:
      if (!engine || !world) break;
      try {
        const payload = command.payload as StepSimulationCommandPayload;
        if (engine && world) {
          Matter.Engine.update(engine, payload.deltaTime); // Update the physics engine
        }

        const updatedBodiesInfo: Array<{
          id: string | number;
          x: number;
          y: number;
          angle: number;
        }> = [];
        bodies.forEach((body, id) => {
          updatedBodiesInfo.push({
            id,
            x: body.position.x,
            y: body.position.y,
            angle: body.angle,
          });
        });

        self.postMessage({
          type: CommandType.SIMULATION_STEPPED,
          payload: { success: true, bodies: updatedBodiesInfo },
          commandId: command.commandId,
        });
      } catch (e: any) {
        console.error("Physics Worker: Error stepping simulation", e);
        self.postMessage({
          type: CommandType.ERROR,
          payload: { message: e.message, originalCommand: command },
          commandId: command.commandId,
        });
      }
      break;

    // TODO: Implement UPDATE_BODY, APPLY_FORCE etc.

    default:
      console.warn(
        "Physics Worker: Unknown command type received:",
        command.type
      );
      self.postMessage({
        type: CommandType.ERROR,
        payload: { message: `Unknown command: ${command.type}` },
        commandId: command.commandId,
      });
      break;
  }
};

// Optional: Initial message to main thread to indicate worker is ready
self.postMessage({ type: CommandType._WORKER_READY });

// TODO: Add Matter.js engine, world, and other necessary variables
// let engine: Matter.Engine;
// let world: Matter.World;
