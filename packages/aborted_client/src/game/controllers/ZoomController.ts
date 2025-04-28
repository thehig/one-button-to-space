import { Logger, LogLevel } from "@one-button-to-space/shared"; // Updated path
import Phaser from "phaser";

// Define the source constant for logging
const LOGGER_SOURCE = "🔍🎮"; // Chosen emojis for ZoomController

// Define the fixed zoom levels
const DEFAULT_ZOOM_LEVELS: number[] = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0];
const INITIAL_ZOOM_INDEX = 2; // Index corresponding to 0.5 in the array

export class ZoomController {
  private scene: Phaser.Scene;
  private readonly zoomLevels: number[];
  private currentZoom: number;
  private targetLevelIndex: number; // Index in zoomLevels array
  private boundWheelHandler: (e: WheelEvent) => void;

  constructor(scene: Phaser.Scene, zoomLevels: number[] = DEFAULT_ZOOM_LEVELS) {
    this.scene = scene;
    this.zoomLevels = zoomLevels;

    if (
      INITIAL_ZOOM_INDEX < 0 ||
      INITIAL_ZOOM_INDEX >= this.zoomLevels.length
    ) {
      Logger.warn(
        LOGGER_SOURCE,
        `Initial zoom index ${INITIAL_ZOOM_INDEX} is out of bounds for zoom levels array. Resetting to 0.`
      );
      this.targetLevelIndex = 0;
    } else {
      this.targetLevelIndex = INITIAL_ZOOM_INDEX;
    }

    this.currentZoom =
      this.zoomLevels[this.targetLevelIndex] ?? this.zoomLevels[0]!;

    this.boundWheelHandler = this.handleWheelEvent.bind(this);
    this.init();
  }

  private init(): void {
    const canvas = this.scene.game.canvas;
    canvas.setAttribute("tabindex", "0");
    canvas.addEventListener("wheel", this.boundWheelHandler, {
      passive: false,
    });
  }

  private handleWheelEvent(event: WheelEvent): void {
    Logger.debug(LOGGER_SOURCE, "Wheel event received:", event);
    Logger.debug(
      LOGGER_SOURCE,
      "[Focus Check] Active Element:",
      document.activeElement,
      "Canvas:",
      this.scene.game.canvas
    );

    // Prevent default browser scroll/zoom behavior
    event.preventDefault();

    // Determine zoom direction
    const zoomDirection = -Math.sign(event.deltaY);

    // Calculate the new target level index
    const newIndex = this.targetLevelIndex + zoomDirection;

    // Clamp the index within the bounds of the zoomLevels array
    const clampedIndex = Phaser.Math.Clamp(
      newIndex,
      0,
      this.zoomLevels.length - 1
    );

    // If the target index has changed, update the target zoom value
    if (clampedIndex !== this.targetLevelIndex) {
      this.targetLevelIndex = clampedIndex;
      this.currentZoom = this.zoomLevels[this.targetLevelIndex]!;
      this.scene.cameras.main.setZoom(this.currentZoom); // Apply zoom immediately
      Logger.debug(
        LOGGER_SOURCE,
        `New target zoom level set: Index=${
          this.targetLevelIndex
        }, Value=${this.currentZoom.toFixed(3)}` // Log applied zoom
      );
    }
  }

  public getZoomLevel(): number {
    return this.currentZoom;
  }

  // Helper to find the closest zoom level index to a given value
  private findNearestZoomIndex(level: number): number {
    return this.zoomLevels.reduce(
      (prevIndex, currLevel, currIndex) => {
        const prevDiff = Math.abs(this.zoomLevels[prevIndex]! - level);
        const currDiff = Math.abs(currLevel - level);
        return currDiff < prevDiff ? currIndex : prevIndex;
      },
      0 // Start with index 0 as the initial best guess
    );
  }

  public setZoomLevel(level: number): void {
    // Snap to the nearest fixed zoom level
    const nearestIndex = this.findNearestZoomIndex(level);
    // Immediately apply the snapped zoom level
    this.setZoomLevelImmediate(this.zoomLevels[nearestIndex]!); // Reuse immediate logic
  }

  public setZoomLevelImmediate(level: number): void {
    const nearestIndex = this.findNearestZoomIndex(level);
    this.targetLevelIndex = nearestIndex;
    this.currentZoom = this.zoomLevels[nearestIndex]!;
    this.scene.cameras.main.setZoom(this.currentZoom); // Apply immediately
    Logger.info(
      LOGGER_SOURCE,
      `setZoomLevelImmediate: Snapped ${level.toFixed(
        3
      )} to nearest level ${this.currentZoom.toFixed(
        3
      )} (Index: ${nearestIndex})`
    );
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
