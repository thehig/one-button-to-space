import Matter from "matter-js";

// Define a type for our proxy engine to make it clearer
interface IWorkerProxyEngine
  extends Omit<
    Matter.Engine,
    "world" | "pairs" | "timing" | "metrics" | "broadphase"
  > {
  worker: Worker | null;
  world: Matter.World;
  pairs: Matter.Pairs; // Changed from PairsFactory
  timing: any; // Simplified type for now
  metrics: any; // Simplified type for now
  broadphase: Matter.Grid; // Changed
  // TODO: Add other engine properties and methods
}

const MatterWorkerPlugin = {
  name: "matterjs-worker-plugin",
  version: "0.1.0",
  for: "matter-js@^0.19.0",

  install: function () {
    const originalEngineCreate = Matter.Engine.create;

    Matter.Engine.create = (
      options?: Matter.IEngineDefinition | undefined
    ): Matter.Engine => {
      console.log(
        "[MatterWorkerPlugin] Patched Engine.create called. Options:",
        options
      );

      const useWorker = true;

      if (useWorker) {
        console.log("[MatterWorkerPlugin] Initializing engine in Web Worker.");

        const worker = new Worker(new URL("./worker.ts", import.meta.url), {
          type: "module",
        });

        let proxyEngineHolder: { current?: Matter.Engine } = {}; // Holder to allow onmessage to access proxyEngine

        const proxyEngine = {
          id: Matter.Common.nextId(),
          type: "engine",
          options: options || {},
          plugin: { ...options?.plugin },
          enabled: true,
          isFixed: false,
          // Use Matter.Grid.create for proper initialization, pass options if available
          broadphase: Matter.Grid.create(options?.grid),
          world: Matter.World.create({}), // Simplified placeholder world creation
          pairs: Matter.Pairs.create({}), // This typically returns Matter.Pairs
          metrics: {
            extended: false,
            fps: 0,
            delta: 0,
            correction: 0,
            narrowDetections: 0,
            narrowphaseClustering: 0,
            narrowReuse: 0,
            narrowReuseCount: 0,
          },
          timing: {
            timestamp: Date.now(),
            lastDelta: 1000 / 60,
            lastElapsed: 1000 / 60,
            timeScale: 1,
            history: [],
            deltas: [],
            deltaMin: 0,
            deltaMax: 0,
            fps: 0,
          },
          render: undefined,
          runner: undefined,
          worker: worker,

          update: (
            engineInstance: Matter.Engine,
            delta: number,
            correction?: number
          ): Matter.Engine => {
            const self = engineInstance as IWorkerProxyEngine;
            if (self.worker) {
              self.worker.postMessage({
                type: "update",
                payload: { delta, correction },
              });
            }
            self.timing.timestamp = Date.now();
            if (delta) self.timing.lastDelta = delta;
            return engineInstance;
          },
          clear: (engineInstance: Matter.Engine): void => {
            const self = engineInstance as IWorkerProxyEngine;
            if (self.worker) {
              // self.worker.postMessage({ type: 'clear', payload: { engineId: engineInstance.id } }); // Removed engineId
              self.worker.postMessage({ type: "clear" });
            }
            if (engineInstance.world)
              Matter.World.clear(engineInstance.world, false);
            if (engineInstance.pairs)
              Matter.Pairs.clear(engineInstance.pairs as Matter.Pairs);
          },
        } as any as Matter.Engine;

        proxyEngineHolder.current = proxyEngine; // Store reference for onmessage
        (proxyEngine as IWorkerProxyEngine).worker = worker;

        worker.onmessage = (event: MessageEvent) => {
          const currentProxyEngine = proxyEngineHolder.current;
          if (!currentProxyEngine) return; // Should not happen if proxyEngine is created

          const { type, payload } = event.data;
          if (type === "initComplete") {
            console.log(
              "[MatterWorkerPlugin] Worker signaled engine initialization complete."
            );
          } else if (type === "debugTempBodyCreated") {
            console.log(
              "[MatterWorkerPlugin] Debug: Worker created temp body",
              payload
            );
            if (currentProxyEngine.world && payload.id != null) {
              const placeholderBody = Matter.Bodies.rectangle(
                0,
                0, // Initial position will be synced
                payload.width || 80,
                payload.height || 80,
                // Ensure the ID from the worker is used here
                { id: payload.id, label: payload.label || "syncedPlaceholder" }
              );
              Matter.World.add(currentProxyEngine.world, placeholderBody);
              console.log(
                `[MatterWorkerPlugin] Debug: Added placeholder body ${payload.id} to proxy world.`
              );
            }
          } else if (type === "updateComplete") {
            const worldState = payload?.worldState as Array<{
              id: number;
              position: Matter.Vector;
              angle: number;
              velocity: Matter.Vector;
              angularVelocity: number;
            }>;

            if (worldState && currentProxyEngine.world) {
              const mainThreadBodies = new Map(
                currentProxyEngine.world.bodies.map((b) => [b.id, b])
              );

              worldState.forEach((bodyState) => {
                const bodyToUpdate = mainThreadBodies.get(bodyState.id);
                if (bodyToUpdate) {
                  Matter.Body.setPosition(bodyToUpdate, bodyState.position);
                  Matter.Body.setAngle(bodyToUpdate, bodyState.angle);
                  Matter.Body.setVelocity(bodyToUpdate, bodyState.velocity);
                  Matter.Body.setAngularVelocity(
                    bodyToUpdate,
                    bodyState.angularVelocity
                  );
                  // TODO: Sync other properties like isSleeping, static state, etc.
                } else {
                  // console.warn(`[MatterWorkerPlugin] Body with id ${bodyState.id} in worker state not in proxy world.`);
                }
              });
            }
          } else if (type === "clearComplete") {
            console.log(
              "[MatterWorkerPlugin] Worker signaled engine clear complete."
            );
          } else if (type === "error") {
            console.error(
              "[MatterWorkerPlugin] Error from worker:",
              payload.message
            );
          }
        };

        worker.onerror = (error: ErrorEvent) => {
          console.error(
            "[MatterWorkerPlugin] Error in Web Worker:",
            error.message,
            error
          );
        };

        console.log(
          "[MatterWorkerPlugin] Sending 'init' to worker with options:",
          options
        );
        worker.postMessage({ type: "init", payload: { options } });

        return proxyEngine;
      } else {
        console.log(
          "[MatterWorkerPlugin] Initializing engine in main thread (original)."
        );
        return originalEngineCreate(options);
      }
    };

    console.log(
      "[MatterWorkerPlugin] Plugin installed. Patched Engine.create."
    );
  },
};

Matter.Plugin.register(MatterWorkerPlugin);

export default MatterWorkerPlugin;
