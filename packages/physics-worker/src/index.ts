import {
  PhysicsCommand,
  CommandType,
  InitWorldCommandPayload,
} from "./commands";

// Define a type for the callback function when messages are received from the worker
export type WorkerMessageHandler = (message: PhysicsCommand) => void;

export class PhysicsWorkerClient {
  private worker: Worker | null = null;
  private onMessageCallback: WorkerMessageHandler | null = null;
  private static nextCommandId = 1; // For tracking commands if needed

  constructor(workerPath: string = "./physicsWorker.js") {
    // Assuming worker JS is co-located after build
    if (typeof Worker !== "undefined") {
      try {
        // Vite specific: new URL(url, import.meta.url) for worker instantiation
        // For a library, the path might need to be resolved differently by the consumer.
        // For now, let's assume a simple path that the consumer would ensure is correct.
        // A more robust solution might involve configuration or a specific bundler setup for library workers.
        this.worker = new Worker(new URL(workerPath, import.meta.url), {
          type: "module",
        });

        this.worker.onmessage = (event: MessageEvent<PhysicsCommand>) => {
          console.log(
            "PhysicsWorkerClient: Message received from worker:",
            event.data
          );
          if (this.onMessageCallback) {
            this.onMessageCallback(event.data);
          }
          // TODO: Implement more sophisticated message handling, e.g., based on commandId or event types
        };

        this.worker.onerror = (error) => {
          console.error("PhysicsWorkerClient: Error in worker:", error);
          // TODO: Handle worker errors, perhaps notify a different callback
        };

        console.log("PhysicsWorkerClient: Worker initialized.");
      } catch (e) {
        console.error("PhysicsWorkerClient: Failed to initialize worker.", e);
        this.worker = null;
      }
    } else {
      console.warn(
        "PhysicsWorkerClient: Web Workers are not supported in this environment."
      );
    }
  }

  public sendMessage(
    command: Omit<PhysicsCommand, "commandId" | "type"> & { type: CommandType }
  ): string | undefined {
    if (!this.worker) {
      console.error("PhysicsWorkerClient: Worker is not initialized.");
      return undefined;
    }

    const commandId = `cmd-${PhysicsWorkerClient.nextCommandId++}`;
    const fullCommand: PhysicsCommand = { ...command, commandId };

    console.log("PhysicsWorkerClient: Sending message to worker:", fullCommand);
    this.worker.postMessage(fullCommand);
    return commandId;
  }

  // Method to subscribe to all messages from the worker
  public onMessage(callback: WorkerMessageHandler): void {
    this.onMessageCallback = callback;
  }

  public terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      console.log("PhysicsWorkerClient: Worker terminated.");
    }
  }

  // Convenience methods for specific commands could be added here
  public initWorld(payload: InitWorldCommandPayload): string | undefined {
    return this.sendMessage({ type: CommandType.INIT_WORLD, payload });
  }
}

// Example Usage (primarily for testing within this package, or for consumer)
// const physicsClient = new PhysicsWorkerClient();
//
// physicsClient.onMessage(message => {
//   if (message.type === CommandType.WORKER_READY) {
//     console.log('Worker is ready! Initializing world...');
//     physicsClient.initWorld(
//       { width: 800, height: 600, gravity: { x: 0, y: 1 } }
//     );
//   }
//   if (message.type === CommandType.WORLD_INITIALIZED) {
//     console.log('World initialized by worker:', message.payload);
//   }
// });
