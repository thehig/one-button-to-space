import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    console.log("BootScene: preload");
    // Load minimal assets needed for the next scene (e.g., loading bar)
    // Often used to load assets for the MainMenuScene
  }

  create() {
    console.log("BootScene: create");
    // Start the next scene (e.g., Main Menu)
    this.scene.start("MainMenuScene");
  }
}
