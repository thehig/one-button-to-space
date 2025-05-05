import Phaser from "phaser";
import { EventLogEntry } from "./types"; // Update import path
// Remove NetworkManager import if no longer needed for direct interaction
// import NetworkManager from "./NetworkManager";

// --- Define an interface for window properties used by console hijacking ---
interface WindowWithConsoleOriginals extends Window {
  __console_log_original?: (...args: unknown[]) => void;
  __console_warn_original?: (...args: unknown[]) => void;
  __console_error_original?: (...args: unknown[]) => void;
}

// --- End interface definition ---

// Define a simple interface for the expected room structure
interface RoomInfo {
  id?: string;
  sessionId?: string;
}

/**
 * Manages communication between different parts of the game (Phaser, Network, UI)
 * and provides an event log for React components via Context.
 */
export class CommunicationManager extends Phaser.Events.EventEmitter {
  private static instance: CommunicationManager;
  private eventLog: EventLogEntry[] = []; // Use the imported interface
  private _maxLogSize = 100; // Rename private property
  private _redirectEventsToConsole: boolean = false; // <-- Add flag for redirection

  // Keep track of emitters for potential cleanup
  private sceneEmitter: Phaser.Events.EventEmitter | null = null;
  // Remove networkManager instance property
  // private networkManager: NetworkManager | null = null;
  private phaserSceneEvents: Phaser.Events.EventEmitter | null = null;
  private phaserGameEvents: Phaser.Events.EventEmitter | null = null;

  // Public getter for maxLogSize
  public get maxLogSize(): number {
    return this._maxLogSize;
  }

  // New setter method for maxLogSize
  public setMaxLogSize(newSize: number): void {
    const validatedSize = Math.max(1, Math.floor(newSize)); // Ensure positive integer >= 1
    const oldSize = this._maxLogSize;
    this._maxLogSize = validatedSize;

    // Trim the log if the new size is smaller than the current log length
    if (this.eventLog.length > this._maxLogSize) {
      this.eventLog = this.eventLog.slice(
        this.eventLog.length - this._maxLogSize
      );
    }

    // Optionally log this change
    this.logEvent("CommunicationManager", "maxLogSizeSet", {
      newSize: this._maxLogSize,
      oldSize: oldSize,
      trimmedLog: this.eventLog.length > this._maxLogSize, // Indicate if trimming occurred due to this call
    });

    // We might need to emit an event if the UI needs to react immediately
    // to a potentially smaller log, but the current setup updates on "new-event"
    // or "log-cleared", which should suffice. If the log was trimmed here,
    // the next call to getEventLog() will return the shorter log.
  }

  // <-- Add setter for the redirection flag -->
  public setRedirectEventsToConsole(redirect: boolean): void {
    const changed = this._redirectEventsToConsole !== redirect;
    this._redirectEventsToConsole = redirect;
    if (changed) {
      this.logEvent("CommunicationManager", "setRedirectEventsToConsole", {
        enabled: redirect,
      });
    }
  }

  private constructor() {
    super();
    // TODO: Initialize subscriptions to other emitters (Game, Scenes, NetworkManager, etc.)
    this.logEvent("CommunicationManager", "initialized");
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
    this.logEvent("CommunicationManager", "initializingSubscriptions");
    this.sceneEmitter = emitters.sceneEmitter;
    this.phaserSceneEvents = emitters.phaserSceneEvents;
    this.phaserGameEvents = emitters.phaserGameEvents;

    // --- Subscribe to Scene Emitter Events (Inter-Manager) ---
    // Example: Listen to a generic scene event
    this.sceneEmitter.on("someSceneEvent", (data: unknown) => {
      // Wrap unknown data in an object to match logEvent signature
      this.logEvent("Scene", "someSceneEvent", { payload: data });
    });

    // Listen to events already used in LifecycleManager test triggers
    this.sceneEmitter.on("scoreUpdated", (score: number) => {
      this.logEvent("Scene", "scoreUpdated", { score });
    });
    this.sceneEmitter.on("serverEntitySpawn", (data: unknown) => {
      // Wrap unknown data in an object
      this.logEvent("Scene", "serverEntitySpawn", { payload: data });
    });
    this.sceneEmitter.on("playerEntityCreated", (playerId: string) => {
      this.logEvent("Scene", "playerEntityCreated", { playerId });
    });
    // Listen for events from other managers via the shared emitter
    /* Comment out the noisy inputUpdate listener
    this.sceneEmitter.on("inputUpdate", (payload: unknown) => {
      // Only log periodically or on change to avoid spam?
      this.logEvent("Input", "inputUpdate", payload);
    });
    */
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
      // Type guard to safely access properties
      const roomInfo = room as RoomInfo;
      this.logEvent("Network", "networkConnected", {
        roomId: roomInfo?.id,
        sessionId: roomInfo?.sessionId,
      });
    });
    this.sceneEmitter.on("networkDisconnected", (code: number) => {
      this.logEvent("Network", "networkDisconnected", { code });
    });
    this.sceneEmitter.on("networkError", (error: unknown) => {
      this.logEvent("Network", "networkError", { error });
    });
    this.sceneEmitter.on("serverStateUpdate", (state: unknown) => {
      // data remains unknown, logEvent should handle it
      this.logEvent("Network", "serverStateUpdate", {
        state /* Consider logging only diff or key parts */,
      });
    });
    /* // Comment out unused listener
    this.sceneEmitter.on("serverEntitySpawn", (_data: unknown) => {
      // Prefix data with _ as it's unused due to the commented logEvent below
      // Already logged above as Scene event, decide if duplication is needed or if source tag should change based on origin
      // If LifecycleManager test event is removed, uncomment this:
      // this.logEvent('Network', 'serverEntitySpawn', { payload: _data }); // Ensure payload key if uncommented
    });
    */
    this.sceneEmitter.on("serverEntityRemove", (message: unknown) => {
      // Wrap unknown data in an object
      this.logEvent("Network", "serverEntityRemove", { payload: message });
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

    this.logEvent("CommunicationManager", "subscriptionsInitialized");
  }

  public logEvent(
    source: string,
    eventName: string,
    data?:
      | Record<string, unknown>
      | unknown[]
      | string
      | number
      | boolean
      | null
  ): void {
    // Allow structured data, arrays, or primitives. Avoid 'any'.
    // if (!this.config.enabled) return; // REMOVED: this.config does not exist

    const timestampNumber = Date.now();
    const timestamp = new Date(timestampNumber).toISOString(); // Convert number to ISO string
    const logEntry: EventLogEntry = { timestamp, source, eventName, data }; // Use the interface

    this.eventLog.push(logEntry);
    // Ensure log does not exceed the maximum size
    if (this.eventLog.length > this._maxLogSize) {
      // Keep only the most recent entries by slicing from the end
      this.eventLog = this.eventLog.slice(-this._maxLogSize);
      // Note: The previous shift() implementation was correct for FIFO trimming,
      // but slice() is slightly more direct for "keep last N".
      // Let's stick to slice() for clarity. If performance becomes an issue
      // with very large logs and frequent additions, shift() might be revisited.
    }

    // Emit an event specifically for the React context provider
    this.emit("new-event", logEntry);

    // <-- Add redirection logic here -->
    if (this._redirectEventsToConsole) {
      // Attempt to get the *original* console.log method saved by the hijacker
      // Use the specific Window interface
      const originalConsoleLog = (window as WindowWithConsoleOriginals)
        .__console_log_original;

      if (typeof originalConsoleLog === "function") {
        // Format args for console: Prefix with source/event, include data if present
        const consoleArgs = [
          `[${source}] ${eventName}:`,
          ...(data !== undefined ? [data] : []),
        ];
        try {
          // Use apply to call the original function with the correct context and args
          originalConsoleLog.apply(window.console, consoleArgs);
        } catch (error: unknown) {
          // Type guard for Error object
          let errorMessage = "Unknown error";
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === "string") {
            errorMessage = error;
          } else if (
            typeof error === "object" &&
            error !== null &&
            "toString" in error
          ) {
            errorMessage = String(error); // Fallback to string representation
          }
          // Use the derived errorMessage instead of casting the original error
          this.logEvent("CommunicationManager", "error", {
            message: "Error calling original console.log",
            error: errorMessage, // Use the safe message
            // Safely stringify potentially complex data, handle circular refs
            eventData: JSON.stringify(data, (key, value) => {
              if (typeof value === "object" && value !== null) {
                if (key === "_parent" || key === "scene") {
                  // Avoid circular Phaser refs
                  return "[Phaser Reference]";
                }
              }
              return value;
            })?.substring(0, 100), // Log truncated data
          });
        }
      } else {
        // Log a warning if the original wasn't found (hijack might not be active?)
        // Avoid using console.log directly here to prevent potential loops if something is wrong
        console.warn(
          "[CommunicationManager] Could not find original console.log for redirection."
        );
      }
    }
    // <-- End redirection logic -->

    // Optionally emit the original event if needed for other Phaser systems
    // this.emit(eventName, data);

    /* REMOVED: import.meta.env does not exist in this context
    if (import.meta.env.DEV) {
      // console.debug(`[${source}] Event: ${eventName}`, data);
    }
    */
  }

  public getEventLog(): EventLogEntry[] {
    // Use the interface
    return [...this.eventLog]; // Return a copy
  }

  public clearLog(): void {
    this.eventLog = [];
    this.emit("log-cleared");
    this.logEvent("CommunicationManager", "logCleared");
  }

  // TODO: Add methods to subscribe/unsubscribe specific emitters if needed dynamically
  // TODO: Add filtering methods for the log

  public destroy(): void {
    this.logEvent("CommunicationManager", "destroyingSubscriptions");
    // Unsubscribe from all emitters we subscribed to
    if (this.sceneEmitter) {
      this.sceneEmitter.off("someSceneEvent");
      this.sceneEmitter.off("scoreUpdated");
      this.sceneEmitter.off("serverEntitySpawn");
      this.sceneEmitter.off("playerEntityCreated");
      // Remove listeners for manager events
      // this.sceneEmitter.off("inputUpdate"); // Ensure corresponding off call is also commented/removed
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
    this.logEvent("CommunicationManager", "destroyed");
  }

  // Example of processing a custom event before logging
  private processEvent(source: string, eventName: string, _data: unknown) {
    // if (this.isProcessing) return; // REMOVED: isProcessing does not exist
    // this.isProcessing = true; // REMOVED: isProcessing does not exist
    // console.log(`Processing custom event: ${eventName}`, data);
    // Perform any specific logic based on the event...
    // Wrap unknown data in an object
    this.logEvent(source, `processed:${eventName}`, { payload: _data }); // Log a transformed version
    // this.isProcessing = false; // REMOVED: isProcessing does not exist
  }

  /* // Comment out unused function
  // Example of direct logging without processing
  // Prefix unused parameters with _
  private logToConsole(_source: string, _eventName: string, __data: unknown) {
    // if (this.isProcessing) return; // REMOVED: isProcessing does not exist
    // console.log(`[${_source}] Direct Log: ${_eventName}`, __data);
    // Maybe skip adding to the main log here if it's just for console
  }
  */

  // Example handler for messages from another source (e.g., Web Worker, iframe)
  private handleMessage = (event: MessageEvent) => {
    // Basic validation
    if (!event.data || typeof event.data.type !== "string") {
      console.warn("Received malformed message:", event);
      return;
    }

    // if (this.isProcessing) return; // REMOVED: isProcessing does not exist

    // Remove unused destructured variables
    // const { type, payload } = event.data;

    // ... existing code ...
  };
}
