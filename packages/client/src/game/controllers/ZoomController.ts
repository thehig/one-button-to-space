import { Logger, LogLevel } from "@one-button-to-space/shared"; // Updated path
import Phaser from "phaser";

// Define the source constant for logging
const LOGGER_SOURCE = "🔍🎮"; // Chosen emojis for ZoomController

export class ZoomController {
  private scene: Phaser.Scene;
  private currentZoom: number = 0.5; // Start at the new minimum
  private targetZoom: number = 0.5; // Target zoom level for interpolation, start at new minimum
  private readonly minZoom: number = 0.1; // Zoom less than 1 is zooming out
  private readonly maxZoom: number = 2.0; // Double the maximum zoom
  private readonly zoomStep: number = 0.4; // Increase step size (8x larger)
  private readonly smoothFactor: number = 0.1; // Interpolation speed factor
  private readonly epsilon: number = 0.001; // Threshold to stop interpolation
  private boundWheelHandler: (e: WheelEvent) => void; // For correct listener removal

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    // No longer need to initialize targetZoom here as it's set with currentZoom
    // this.targetZoom = this.currentZoom;
    this.boundWheelHandler = this.handleWheelEvent.bind(this); // Store bound handler
    this.init();
  }

  private init(): void {
    const canvas = this.scene.game.canvas;

    // --- ADDED: Make canvas focusable ---
    canvas.setAttribute("tabindex", "0"); // Or -1 if tabbing isn't desired
    // --- END ADDED ---

    // Use the stored bound handler
    canvas.addEventListener("wheel", this.boundWheelHandler, {
      passive: false, // Need passive: false to call preventDefault()
    });
  }

  private handleWheelEvent(event: WheelEvent): void {
    // --- REMOVED DEBUG LOG ---
    Logger.debug(LOGGER_SOURCE, "Wheel event received:", event);
    // --- END REMOVED DEBUG LOG ---

    // --- RE-ADD FOCUS DEBUG LOG ---
    Logger.debug(
      LOGGER_SOURCE,
      "[Focus Check] Active Element:",
      document.activeElement,
      "Canvas:",
      this.scene.game.canvas
    );
    // --- END RE-ADD FOCUS DEBUG LOG ---

    // Only process wheel events when canvas has focus
    /* --- REMOVED FOCUS CHECK ---
    if (document.activeElement !== this.scene.game.canvas) {
      // Add a log here for clarity if focus is still an issue
      Logger.debug(LOGGER_SOURCE, 'Canvas does not have focus, ignoring wheel event. Active:', document.activeElement);
      return;
    }
    --- END REMOVED FOCUS CHECK --- */

    // Prevent default browser scroll/zoom behavior
    event.preventDefault();

    // Calculate new zoom level based on wheel direction
    // Negative deltaY means scroll up (zoom in), positive means scroll down (zoom out)
    const zoomDirection = -Math.sign(event.deltaY);
    // Calculate the new target based on currentZoom at the time of the event
    const newTargetZoom = this.currentZoom + zoomDirection * this.zoomStep;

    // Set the target zoom, applying constraints
    this.targetZoom = Phaser.Math.Clamp(
      newTargetZoom,
      this.minZoom,
      this.maxZoom
    );

    // We no longer apply zoom directly here or log the level immediately
    /* --- REMOVED ---
    // Apply zoom constraints
    const previousZoom = this.currentZoom;
    this.currentZoom = Phaser.Math.Clamp(
      targetZoom,
      this.minZoom,
      this.maxZoom
    );

    if (this.currentZoom !== previousZoom) {
      console.log("Zoom level:", this.currentZoom.toFixed(2));
      // TODO: Apply zoom to camera in a later step
    }
    --- END REMOVED --- */
  }

  public update(delta: number): void {
    // Adjust smooth factor based on delta time for frame rate independence
    // Assuming 60 FPS (16.666ms per frame) as the baseline
    const adjustedSmoothFactor = this.smoothFactor * (delta / 16.666);

    // Check if current zoom is already close enough to the target
    if (Math.abs(this.currentZoom - this.targetZoom) < this.epsilon) {
      // Snap to target if very close to prevent floating point issues
      if (this.currentZoom !== this.targetZoom) {
        this.currentZoom = this.targetZoom;
        this.scene.cameras.main.setZoom(this.currentZoom);
        Logger.debug(
          LOGGER_SOURCE,
          `Zoom Level Applied: ${this.currentZoom.toFixed(3)}`
        ); // Replaced console.log with debug
      }
      return; // No need to interpolate further
    }

    // Interpolate current zoom towards the target zoom
    this.currentZoom = Phaser.Math.Linear(
      this.currentZoom,
      this.targetZoom,
      adjustedSmoothFactor
    );

    // Apply the interpolated zoom to the camera
    Logger.debug(
      LOGGER_SOURCE,
      `Zoom Level Applied: ${this.currentZoom.toFixed(3)}`
    ); // Replaced console.log with debug
    this.scene.cameras.main.setZoom(this.currentZoom);
    // console.log(`Zoom interpolating: Current=${this.currentZoom.toFixed(3)}, Target=${this.targetZoom.toFixed(3)}`); // Optional debug
  }

  public getZoomLevel(): number {
    return this.currentZoom;
  }

  public setZoomLevel(level: number): void {
    // Set the target zoom level for interpolation
    this.targetZoom = Phaser.Math.Clamp(level, this.minZoom, this.maxZoom);
    // Remove console log, zoom is applied in update()
    /* --- REMOVED ---
    const previousZoom = this.currentZoom;
    this.currentZoom = Phaser.Math.Clamp(level, this.minZoom, this.maxZoom);
    if (this.currentZoom !== previousZoom) {
      console.log("Zoom level set to:", this.currentZoom.toFixed(2));
    }
    --- END REMOVED --- */
  }

  public setZoomLevelImmediate(level: number): void {
    this.currentZoom = Phaser.Math.Clamp(level, this.minZoom, this.maxZoom);
    this.targetZoom = this.currentZoom; // Sync target
    this.scene.cameras.main.setZoom(this.currentZoom); // Apply immediately
    Logger.info(
      LOGGER_SOURCE,
      "Zoom set immediately to:",
      this.currentZoom.toFixed(2)
    ); // Replaced console.log with info
  }

  public destroy(): void {
    // Clean up event listener when the scene shuts down or controller is destroyed
    const canvas = this.scene.game.canvas;
    if (canvas && this.boundWheelHandler) {
      // Check if handler exists
      // Use the stored bound handler for removal
      canvas.removeEventListener("wheel", this.boundWheelHandler);
    }
    Logger.info(
      LOGGER_SOURCE,
      "ZoomController destroyed and listener removed."
    ); // Replaced console.log with info
  }
}
