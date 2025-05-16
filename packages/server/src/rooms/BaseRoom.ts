import { Room, Client } from "colyseus";
import { BaseRoomState } from "../schema";
import { setupFixedTimeStep } from "../commands";
// Base room class with common functionality
export abstract class BaseRoom<T extends BaseRoomState> extends Room<T> {
  // Default fixed time step (60 FPS)
  protected fixedTimeStep = 1000 / 60;

  // Setup common room functionality in onCreate
  onCreate(options?: any): void {
    // Override in derived classes, but call super.onCreate() first

    // Set default map dimensions if not already set
    if (!this.state.mapWidth) this.state.mapWidth = 800;
    if (!this.state.mapHeight) this.state.mapHeight = 600;
  }

  // Default implementation for onJoin
  onJoin(client: Client, options?: any): void {
    console.log(client.sessionId, "joined!");

    // Override this method in derived classes to create and add player
  }

  // Default implementation for onLeave
  onLeave(client: Client, consented: boolean): void {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);
  }

  // Default implementation for onDispose
  onDispose(): void {
    console.log("room", this.roomId, "disposing...");
  }

  // Utility method to setup a fixed-timestep game loop
  protected setupFixedGameLoop(tickCallback: (timeStep: number) => void): void {
    setupFixedTimeStep(this, this.fixedTimeStep, tickCallback);
  }
}
