/**
 * ---------------------------
 * Phaser + Colyseus - Part 4.
 * ---------------------------
 * - Connecting with the room
 * - Sending inputs at the user's framerate
 * - Update other player's positions WITH interpolation (for other players)
 * - Client-predicted input for local (current) player
 * - Fixed tickrate on both client and server
 */

import { BaseNetworkScene } from "./BaseNetworkScene";
import { getStateCallbacks } from "colyseus.js";
import Phaser from "phaser";

export class Part4Scene extends BaseNetworkScene {
  localRef: Phaser.GameObjects.Rectangle;
  remoteRef: Phaser.GameObjects.Rectangle;

  elapsedTime = 0;
  fixedTimeStep = 1000 / 60;
  currentTick = 0;

  constructor() {
    super({ key: "part4" });
  }

  async create() {
    // Initialize common elements
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.debugFPS = this.add.text(4, 4, "", { color: "#ff0000" });

    // Connect with the room
    await this.connect("part4_room");

    // Set up player handlers with Part4-specific behavior
    this.setupPlayerHandlers((player, sessionId, entity) => {
      const $ = getStateCallbacks(this.room);

      // Is current player
      if (sessionId === this.room.sessionId) {
        this.currentPlayer = entity;

        // Visual indicators for local and remote positions
        this.localRef = this.add.rectangle(0, 0, entity.width, entity.height);
        this.localRef.setStrokeStyle(1, 0x00ff00);

        this.remoteRef = this.add.rectangle(0, 0, entity.width, entity.height);
        this.remoteRef.setStrokeStyle(1, 0xff0000);

        $(player).onChange(() => {
          this.remoteRef.x = player.x;
          this.remoteRef.y = player.y;
        });
      } else {
        // For other players, use interpolation
        $(player).onChange(() => {
          entity.setData({
            serverX: player.x,
            serverY: player.y,
          });
        });
      }
    });

    // Set camera bounds
    this.cameras.main.setBounds(0, 0, 800, 600);
  }

  update(time: number, delta: number): void {
    // Skip loop if not connected yet
    if (!this.currentPlayer) {
      return;
    }

    // Implement fixed timestep for consistent updates
    this.elapsedTime += delta;
    while (this.elapsedTime >= this.fixedTimeStep) {
      this.elapsedTime -= this.fixedTimeStep;
      this.fixedTick(time, this.fixedTimeStep);
    }

    // Update FPS display
    this.updateFPSText();
  }

  fixedTick(time: number, delta: number): void {
    this.currentTick++;

    // Set up tick-based input
    const velocity = 2;
    this.inputPayload.left = this.cursorKeys.left.isDown;
    this.inputPayload.right = this.cursorKeys.right.isDown;
    this.inputPayload.up = this.cursorKeys.up.isDown;
    this.inputPayload.down = this.cursorKeys.down.isDown;

    // Add tick to input payload
    this.inputPayload.tick = this.currentTick;
    this.room.send(0, this.inputPayload);

    // Apply local movement prediction
    if (this.inputPayload.left) {
      this.currentPlayer.x -= velocity;
    } else if (this.inputPayload.right) {
      this.currentPlayer.x += velocity;
    }

    if (this.inputPayload.up) {
      this.currentPlayer.y -= velocity;
    } else if (this.inputPayload.down) {
      this.currentPlayer.y += velocity;
    }

    // Update reference visualization
    this.localRef.x = this.currentPlayer.x;
    this.localRef.y = this.currentPlayer.y;

    // Interpolate other players
    this.interpolateOtherPlayers(true);
  }
}
