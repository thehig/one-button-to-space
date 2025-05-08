import * as Matter from "matter-js";
// Removed: import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { BodyState, CollisionPair, PhysicsSyncState } from "./schemas";
import {
  PhysicsCommand,
  CommandType,
  InitWorldCommandPayload,
  AddBodyCommandPayload,
  StepSimulationCommandPayload,
  RemoveBodyCommandPayload,
  // IBodyDefinition, // Removed as it's implicitly used via Matter.IBodyDefinition
} from "./commands";

console.log("Physics Worker: Script loaded");

let engine: Matter.Engine | undefined;
let world: Matter.World | undefined;

// Keep track of bodies by external ID for easier removal/update
const bodies: Map<string, Matter.Body> = new Map();
// Map Matter's internal numeric ID to our external string ID
const matterIdToExternalIdMap: Map<number, string> = new Map();

let syncState = new PhysicsSyncState();

self.onmessage = (event: MessageEvent<PhysicsCommand>) => {
  console.log("Physics Worker: Message received from main thread:", event.data);
  const command = event.data;

  if (!engine || !world) {
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
        bodies.clear();
        matterIdToExternalIdMap.clear();
        syncState = new PhysicsSyncState(); // Reset state

        if (payload.gravity) {
          world.gravity.x = payload.gravity.x;
          world.gravity.y = payload.gravity.y;
          if (payload.gravity.scale !== undefined) {
            world.gravity.scale = payload.gravity.scale;
          }
        }

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

        Matter.Events.on(engine, "collisionStart", (event) => {
          const pairs = event.pairs;
          syncState.collisionEvents.clear(); // Clear previous step's collisions

          for (let i = 0; i < pairs.length; i++) {
            const pair = pairs[i];
            const externalAId = matterIdToExternalIdMap.get(pair.bodyA.id);
            const externalBId = matterIdToExternalIdMap.get(pair.bodyB.id);

            if (externalAId && externalBId) {
              syncState.collisionEvents.push(
                new CollisionPair(externalAId, externalBId)
              );
            }
          }
          // Collision events will be sent with the next state update (e.g., after STEP_SIMULATION)
        });

        console.log(
          "Physics Worker: World initialized with boundaries and collision listener",
          payload
        );
        // Send WORLD_INITIALIZED as a direct ack; state will be synced separately
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
      if (!engine || !world) break;
      try {
        const payload = command.payload as AddBodyCommandPayload;
        const externalId = String(payload.id);
        let body: Matter.Body | undefined;

        // Ensure options don't try to set Matter's internal 'id' with a string
        // Matter will assign its own numeric ID.
        const { id, ...restOptions } = payload.options || {};
        const bodyOptions: Matter.IBodyDefinition = restOptions;

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
              body = Matter.Bodies.polygon(
                payload.x,
                payload.y,
                payload.sides,
                payload.radius,
                bodyOptions
              );
            } else if (payload.vertices) {
              body = Matter.Bodies.fromVertices(
                payload.x,
                payload.y,
                [payload.vertices],
                bodyOptions
              );
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
          bodies.set(externalId, body);
          matterIdToExternalIdMap.set(body.id, externalId); // Map Matter's internal ID

          // Update syncState
          const newBodyState = new BodyState(
            externalId,
            body.position.x,
            body.position.y,
            body.angle
          );
          syncState.bodies.set(externalId, newBodyState);

          console.log("Physics Worker: Body added", externalId, body);
          self.postMessage({
            type: CommandType.PHYSICS_STATE_UPDATE, // Use the new type
            payload: syncState.encode(), // Send full encoded state
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
        const externalId = String(payload.id);
        const bodyToRemove = bodies.get(externalId);

        if (bodyToRemove) {
          Matter.World.remove(world, bodyToRemove);
          bodies.delete(externalId);
          matterIdToExternalIdMap.delete(bodyToRemove.id); // Clean up mapping

          // Update syncState
          syncState.bodies.delete(externalId);

          console.log("Physics Worker: Body removed", externalId);
          self.postMessage({
            type: CommandType.PHYSICS_STATE_UPDATE, // Use the new type
            payload: syncState.encode(), // Send full encoded state
            commandId: command.commandId,
          });
        } else {
          throw new Error(`Body with ID ${externalId} not found for removal.`);
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
        Matter.Engine.update(engine, payload.deltaTime); // Update the physics engine

        // The collision listener (Matter.Events.on("collisionStart",...))
        // will have updated syncState.collisionEvents during the Matter.Engine.update call.

        // Update all body states in syncState
        bodies.forEach((body, externalId) => {
          let bodyState = syncState.bodies.get(externalId);
          if (bodyState) {
            bodyState.x = body.position.x;
            bodyState.y = body.position.y;
            bodyState.angle = body.angle;
          } else {
            // This case should ideally not happen if bodies map and syncState.bodies are in sync
            const newBodyState = new BodyState(
              externalId,
              body.position.x,
              body.position.y,
              body.angle
            );
            syncState.bodies.set(externalId, newBodyState);
          }
        });

        self.postMessage({
          type: CommandType.PHYSICS_STATE_UPDATE, // Use the new type
          payload: syncState.encode(), // Send full encoded state (with updated bodies and collisions)
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

self.postMessage({ type: CommandType.WORKER_READY });
