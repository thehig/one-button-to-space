import Phaser from "phaser";
import { EventLogEntry } from "../../types/events"; // Import the interface
// Remove NetworkManager import if no longer needed for direct interaction
// import NetworkManager from "./NetworkManager";

/**
 * Manages communication between different parts of the game (Phaser, Network, UI)
 * and provides an event log for React components via Context.
 */
export class CommunicationManager extends Phaser.Events.EventEmitter {
  private static instance: CommunicationManager;
  private eventLog: EventLogEntry[] = []; // Use the imported interface
  private maxLogSize = 100; // Example size, adjust as needed

  // Keep track of emitters for potential cleanup
  private sceneEmitter: Phaser.Events.EventEmitter | null = null;
  // Remove networkManager instance property
  // private networkManager: NetworkManager | null = null;
  private phaserSceneEvents: Phaser.Events.EventEmitter | null = null;
  private phaserGameEvents: Phaser.Events.EventEmitter | null = null;

  private constructor() {
    super();
    // TODO: Initialize subscriptions to other emitters (Game, Scenes, NetworkManager, etc.)
    console.log("CommunicationManager initialized");
  }

  public static getInstance(): CommunicationManager {
    if (!CommunicationManager.instance) {
      CommunicationManager.instance = new CommunicationManager();
    }
    return CommunicationManager.instance;
  }

  // Method to receive emitters after instantiation
  public initialize(emitters: {
    sceneEmitter: Phaser.Events.EventEmitter;
    phaserSceneEvents: Phaser.Events.EventEmitter;
    phaserGameEvents: Phaser.Events.EventEmitter;
    // Add others as needed
  }): void {
    console.log("CommunicationManager initializing subscriptions...");
    this.sceneEmitter = emitters.sceneEmitter;
    this.phaserSceneEvents = emitters.phaserSceneEvents;
    this.phaserGameEvents = emitters.phaserGameEvents;

    // --- Subscribe to Scene Emitter Events (Inter-Manager) ---
    // Example: Listen to a generic scene event
    this.sceneEmitter.on("someSceneEvent", (data: unknown) => {
      this.logEvent("Scene", "someSceneEvent", data);
    });

    // Listen to events already used in LifecycleManager test triggers
    this.sceneEmitter.on("scoreUpdated", (score: number) => {
      this.logEvent("Scene", "scoreUpdated", { score });
    });
    this.sceneEmitter.on("serverEntitySpawn", (data: unknown) => {
      this.logEvent("Scene", "serverEntitySpawn", data);
    });
    this.sceneEmitter.on("playerEntityCreated", (playerId: string) => {
      this.logEvent("Scene", "playerEntityCreated", { playerId });
    });
    // Listen for events from other managers via the shared emitter
    this.sceneEmitter.on("inputUpdate", (payload: unknown) => {
      // Only log periodically or on change to avoid spam?
      this.logEvent("Input", "inputUpdate", payload);
    });
    this.sceneEmitter.on("pointerDown", (payload: { x: number; y: number }) => {
      this.logEvent("Input", "pointerDown", payload);
    });
    this.sceneEmitter.on(
      "physicsBodyCreated",
      (payload: { entityId: string; bodyId: number }) => {
        this.logEvent("Entity", "physicsBodyCreated", payload);
      }
    );
    // Add listeners for other custom scene events as needed...

    // --- Subscribe to Network-related Events (via Scene Emitter) ---
    this.sceneEmitter.on("networkConnected", (room: unknown) => {
      this.logEvent("Network", "networkConnected", {
        roomId: (room as any)?.id,
        sessionId: (room as any)?.sessionId,
      });
    });
    this.sceneEmitter.on("networkDisconnected", (code: number) => {
      this.logEvent("Network", "networkDisconnected", { code });
    });
    this.sceneEmitter.on("networkError", (error: unknown) => {
      this.logEvent("Network", "networkError", { error });
    });
    this.sceneEmitter.on("serverStateUpdate", (state: unknown) => {
      this.logEvent("Network", "serverStateUpdate", {
        state /* Consider logging only diff or key parts */,
      });
    });
    this.sceneEmitter.on("serverEntitySpawn", (data: unknown) => {
      // Already logged above as Scene event, decide if duplication is needed or if source tag should change based on origin
      // If LifecycleManager test event is removed, uncomment this:
      // this.logEvent('Network', 'serverEntitySpawn', data);
    });
    this.sceneEmitter.on("serverEntityRemove", (message: unknown) => {
      this.logEvent("Network", "serverEntityRemove", message);
    });
    // Remove direct subscription attempt
    /*
    this.networkManager.on('networkMessage', (message: unknown) => {
      this.logEvent('Network', 'networkMessage', message);
    });
    */
    // Add listeners for other network events as needed...

    // --- Remove Phaser Scene Lifecycle Listeners ---
    this.phaserSceneEvents?.off("create");
    this.phaserSceneEvents?.off("shutdown");
    this.phaserSceneEvents?.off("pause");
    this.phaserSceneEvents?.off("resume");

    // --- Remove Phaser Game Lifecycle Listeners ---
    this.phaserGameEvents?.off("pause");
    this.phaserGameEvents?.off("resume");

    console.log("CommunicationManager subscriptions initialized.");
  }

  public logEvent(source: string, eventName: string, data?: unknown): void {
    // console.log(
    //   `CommunicationManager: logEvent called - Source: ${source}, Event: ${eventName}`
    // );
    const timestamp = new Date().toISOString();
    const logEntry: EventLogEntry = { timestamp, source, eventName, data }; // Use the interface

    this.eventLog.push(logEntry);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift(); // Keep the log size manageable (FIFO)
    }

    // Emit an event specifically for the React context provider
    this.emit("new-event", logEntry);
    // Optionally emit the original event if needed for other Phaser systems
    // this.emit(eventName, data);

    if (import.meta.env.DEV) {
      // console.debug(`[${source}] Event: ${eventName}`, data);
    }
  }

  public getEventLog(): EventLogEntry[] {
    // Use the interface
    return [...this.eventLog]; // Return a copy
  }

  public clearLog(): void {
    this.eventLog = [];
    this.emit("log-cleared");
    console.log("Event log cleared");
  }

  // TODO: Add methods to subscribe/unsubscribe specific emitters if needed dynamically
  // TODO: Add filtering methods for the log

  public destroy(): void {
    console.log("CommunicationManager destroying subscriptions...");
    // Unsubscribe from all emitters we subscribed to
    if (this.sceneEmitter) {
      this.sceneEmitter.off("someSceneEvent");
      this.sceneEmitter.off("scoreUpdated");
      this.sceneEmitter.off("serverEntitySpawn");
      this.sceneEmitter.off("playerEntityCreated");
      // Remove listeners for manager events
      // this.sceneEmitter.off("inputUpdate"); // Keep commented out
      this.sceneEmitter.off("pointerDown");
      this.sceneEmitter.off("physicsBodyCreated");
      // Remove other scene listeners...
      // Remove listeners for network events
      this.sceneEmitter.off("networkConnected");
      this.sceneEmitter.off("networkDisconnected");
      this.sceneEmitter.off("networkError");
      this.sceneEmitter.off("serverStateUpdate");
      this.sceneEmitter.off("serverEntityRemove");
    }

    // --- Remove Phaser Scene Lifecycle Listeners ---
    this.phaserSceneEvents?.off("create");
    this.phaserSceneEvents?.off("shutdown");
    this.phaserSceneEvents?.off("pause");
    this.phaserSceneEvents?.off("resume");

    // --- Remove Phaser Game Lifecycle Listeners ---
    this.phaserGameEvents?.off("pause");
    this.phaserGameEvents?.off("resume");

    this.removeAllListeners(); // Clear own listeners (like new-event, log-cleared)
    console.log("CommunicationManager destroyed");
  }
}
