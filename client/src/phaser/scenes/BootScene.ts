import Phaser from "phaser";
import { CommunicationManager } from "../managers/CommunicationManager";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    CommunicationManager.getInstance().logEvent("BootScene", "preload");
    // Load minimal assets needed for the next scene (e.g., loading bar)
    // Often used to load assets for the MainMenuScene
  }

  create() {
    CommunicationManager.getInstance().logEvent("BootScene", "create");
    // Start the next scene (e.g., Main Menu)
    this.scene.start("MainMenuScene");
  }
}
