/**
 * ---------------------------
 * Phaser + Colyseus - Part 2.
 * ---------------------------
 * - Connecting with the room
 * - Sending inputs at the user's framerate
 * - Update each player's positions WITH interpolation
 */

import { BaseNetworkScene } from "./BaseNetworkScene";
import { getStateCallbacks } from "colyseus.js";

export class Part2Scene extends BaseNetworkScene {
  constructor() {
    super({ key: "part2" });
  }

  async create() {
    // Initialize common elements
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.debugFPS = this.add.text(4, 4, "", { color: "#ff0000" });

    // Connect with the room
    await this.connect("part2_room");

    // Set up player handlers
    this.setupPlayerHandlers((player, sessionId, entity) => {
      // Add Part2-specific behavior for players
      const $ = getStateCallbacks(this.room);

      // Listening for server updates - Part2 uses data for interpolation
      $(player).onChange(() => {
        // Don't update local position immediately
        // Store for interpolation in update loop
        entity.setData({
          serverX: player.x,
          serverY: player.y,
        });
      });
    });

    // Set camera bounds
    this.cameras.main.setBounds(0, 0, 800, 600);
  }

  update(time: number, delta: number): void {
    // Skip loop if not connected yet
    if (!this.room) {
      return;
    }

    // Send input to the server
    this.sendInput();

    // Interpolate all player entities
    this.interpolateOtherPlayers(false); // Include all players in interpolation

    // Update FPS display
    this.updateFPSText();
  }
}
