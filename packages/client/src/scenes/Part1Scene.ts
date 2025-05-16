/**
 * ---------------------------
 * Phaser + Colyseus - Part 1.
 * ---------------------------
 * - Connecting with the room
 * - Sending inputs at the user's framerate
 * - Update each player's positions WITHOUT interpolation
 */

import { BaseNetworkScene } from "./BaseNetworkScene";
import { getStateCallbacks } from "colyseus.js";

export class Part1Scene extends BaseNetworkScene {
  constructor() {
    super({ key: "part1" });
  }

  async create() {
    // Initialize common elements
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.debugFPS = this.add.text(4, 4, "", { color: "#ff0000" });

    // Connect with the room
    await this.connect("part1_room");

    // Set up player handlers
    this.setupPlayerHandlers((player, sessionId, entity) => {
      // Add Part1-specific behavior for players
      const $ = getStateCallbacks(this.room);

      // Listening for server updates - Part1 uses immediate position updates
      $(player).onChange(() => {
        // Update local position immediately
        entity.x = player.x;
        entity.y = player.y;
      });
    });

    // Set camera bounds
    this.cameras.main.setBounds(0, 0, 800, 600);
  }

  update(time: number, delta: number): void {
    // Skip loop if not connected with room yet
    if (!this.room) {
      return;
    }

    // Send input to the server
    this.sendInput();

    // Update FPS display
    this.updateFPSText();
  }
}
