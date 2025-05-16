import Phaser from "phaser";
import { CommunicationManager } from "@one-button-to-space/logger-ui";
// import WebFontLoader from 'webfontloader'; // If needed

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const commManager = CommunicationManager.getInstance();
    commManager.logEvent("BootScene", "preloadStart");
    // Load assets needed for the loading screen (e.g., logo, progress bar background)
    // this.load.image('logo', 'assets/images/logo.png'); // Example

    // Optional: Load web fonts if needed early
    // this.load.script('webfont', 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js');

    commManager.logEvent("BootScene", "preloadComplete");
  }

  create() {
    const commManager = CommunicationManager.getInstance();
    commManager.logEvent("BootScene", "createStart");

    // Optional: Web Font Loading Logic
    /*
    WebFontLoader.load({
      google: {
        families: ['Press Start 2P'] // Replace with your desired font
      },
      active: () => {
        commManager.logEvent('BootScene', 'webFontsLoaded');
        this.scene.start('MainMenuScene'); // Start next scene AFTER fonts loaded
      },
      inactive: () => {
        commManager.logEvent('BootScene', 'webFontsFailed');
        this.scene.start('MainMenuScene'); // Start next scene even if fonts fail
      }
    });
    */

    // If not using web fonts, transition directly
    this.scene.start("MainMenuScene");
    commManager.logEvent("BootScene", "sceneStartMainMenu");

    commManager.logEvent("BootScene", "createComplete");
  }
}
