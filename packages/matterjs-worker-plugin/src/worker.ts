/// <reference lib="webworker" />

import Matter from "matter-js";

let engine: Matter.Engine | null = null;

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  // console.log('[Worker] Received message:', type, payload);

  switch (type) {
    case "init":
      if (engine) {
        console.warn("[Worker] Engine already initialized.");
        // Potentially clear old engine or send error
        Matter.Engine.clear(engine);
      }
      console.log(
        "[Worker] Initializing Matter.js Engine with options:",
        payload.options
      );
      engine = Matter.Engine.create(payload.options);

      // TEMPORARY: Add a test body directly in the worker
      if (engine && engine.world) {
        console.log("[Worker] TEMPORARY: Adding a test body.");
        const bodyOptions = { label: "testBoxFromWorker" }; // Store options for message
        const testBox = Matter.Bodies.rectangle(100, 50, 80, 80, bodyOptions);
        Matter.World.add(engine.world, testBox);
        console.log(
          "[Worker] TEMPORARY: Test body added to worker world. ID:",
          testBox.id
        );

        // Send message about the temporarily created body
        self.postMessage({
          type: "debugTempBodyCreated",
          payload: {
            id: testBox.id,
            label: testBox.label,
            width: 80, // Assuming these are known for the testBox
            height: 80,
          },
        });
      }
      // END TEMPORARY

      self.postMessage({ type: "initComplete" });
      break;

    case "update":
      if (!engine) {
        console.error("[Worker] Engine not initialized. Cannot update.");
        self.postMessage({ type: "error", message: "Engine not initialized" });
        return;
      }
      // console.log('[Worker] Updating engine. Delta:', payload.delta, 'Correction:', payload.correction);
      Matter.Engine.update(
        engine,
        payload.delta || 1000 / 60,
        payload.correction
      );

      if (engine.world && engine.world.bodies) {
        const serializedBodies = engine.world.bodies.map((body) => ({
          id: body.id,
          position: { x: body.position.x, y: body.position.y },
          angle: body.angle,
          velocity: { x: body.velocity.x, y: body.velocity.y },
          angularVelocity: body.angularVelocity,
          // Consider adding isStatic, isSleeping, label, parts IDs if needed for client-side logic/rendering
        }));
        self.postMessage({
          type: "updateComplete",
          payload: { worldState: serializedBodies },
        });
      } else {
        self.postMessage({
          type: "updateComplete",
          payload: { worldState: [] },
        });
      }
      break;

    case "addBody":
      if (!engine) {
        console.error("[Worker] Engine not initialized. Cannot add body.");
        self.postMessage({ type: "error", message: "Engine not initialized" });
        return;
      }
      // TODO: Deserialize payload.bodyDefinition into a Matter.Body
      // For now, assuming payload.body is already a valid Body (which is unlikely across worker boundary without proper serialization)
      // Matter.World.add(engine.world, payload.body);
      console.log(
        "[Worker] Add body command received (implementation pending deserialization):",
        payload.bodyDefinition
      );
      self.postMessage({ type: "addBodyComplete" });
      break;

    case "clear":
      if (!engine) {
        console.error("[Worker] Engine not initialized. Cannot clear.");
        self.postMessage({ type: "error", message: "Engine not initialized" });
        return;
      }
      console.log("[Worker] Clearing engine.");
      Matter.Engine.clear(engine);
      self.postMessage({ type: "clearComplete" });
      break;

    // TODO: Add cases for other engine/world operations (removeBody, setGravity, etc.)

    default:
      console.warn("[Worker] Unknown message type:", type);
      break;
  }
};

console.log("[Worker] Worker script loaded and ready for messages.");

// TODO: Add serialization/deserialization functions for Matter.js objects
// function serializeWorld(world: Matter.World): any { ... }
// function deserializeBody(bodyData: any): Matter.Body { ... }
