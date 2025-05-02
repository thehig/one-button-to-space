import Phaser from "phaser";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  preload() {
    console.log("GameScene: preload");
    // Load game assets (sprites, maps, etc.)
  }

  create() {
    console.log("GameScene: create");
    // Set up game objects, physics, player controls, etc.

    // Example: Add some text
    this.add
      .text(400, 300, "Game Scene", {
        fontSize: "32px",
        color: "#ffffff",
      })
      .setOrigin(0.5);
  }

  update(time: number, delta: number) {
    // Game loop logic (movement, collisions, etc.)
  }
}
