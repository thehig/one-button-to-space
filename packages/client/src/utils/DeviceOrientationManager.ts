import Phaser from "phaser"; // Added to handle Phaser types if needed later
import { Logger } from "@one-button-to-space/shared"; // Corrected path
// Import shared constants
import { Constants } from "@one-button-to-space/shared"; // Import from shared package
const {
  ORIENTATION_CHANGE_THRESHOLD,
  MOUSE_INPUT_COOLDOWN_MS,
  DEFAULT_SIMULATED_BETA,
  DEFAULT_SIMULATED_GAMMA,
} = Constants;

// Define the source constant for logging
const LOGGER_SOURCE = "🧭📱"; // Chosen emojis for DeviceOrientationManager

// Type for tracking the last active input source
type InputSource = "real" | "simulated" | "none";

/**
 * Manages device orientation events and calculates the direction
 * of gravity relative to the device screen. Prioritizes the most recently changed input source.
 */
export class DeviceOrientationManager {
  // --- Current Orientation Data ---
  private alpha: number | null = null;
  private beta: number | null = null;
  private gamma: number | null = null;

  // --- Previous Orientation Data (for change detection) ---
  private prevBeta: number | null = null;
  private prevGamma: number | null = null;

  // --- Simulation State ---
  // private isUsingSimulation: boolean = false; // Replaced by lastInputSource
  private simulatedBeta: number = DEFAULT_SIMULATED_BETA; // Use constant
  private simulatedGamma: number = DEFAULT_SIMULATED_GAMMA; // Use constant
  private prevSimulatedBeta: number = DEFAULT_SIMULATED_BETA; // Use constant
  private prevSimulatedGamma: number = DEFAULT_SIMULATED_GAMMA; // Use constant

  // --- State Tracking ---
  private isListening: boolean = false;
  private lastInputSource: InputSource = "none"; // Track the most recent source
  private lastRealUpdateTime: number = 0; // Timestamp of last significant real update

  constructor() {
    // Initialization logic if needed
  }

  /**
   * Starts listening for device orientation events.
   * Should be called only once.
   */
  public startListening(): void {
    if (this.isListening) {
      Logger.warn(
        LOGGER_SOURCE,
        "startListening called when already listening."
      );
      return;
    }

    let foundSupport = false;
    // Check for API support
    if (
      typeof window.DeviceOrientationEvent !== "undefined" &&
      typeof (window.DeviceOrientationEvent as any).requestPermission ===
        "function"
    ) {
      // iOS 13+ requires permission
      (window.DeviceOrientationEvent as any)
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
            this.addOrientationListener();
            foundSupport = true; // Mark support found
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "Device orientation permission denied. Mouse/Simulated input will be used."
            );
            // Don't call enableSimulationMode here, let lastInputSource handle it
          }
        })
        .catch((error: any) => {
          Logger.error(
            LOGGER_SOURCE,
            "Error requesting device orientation permission:",
            error
          );
          Logger.warn(
            LOGGER_SOURCE,
            "Assuming no device orientation support. Mouse/Simulated input will be used."
          );
        })
        .finally(() => {
          this.isListening = true; // Mark as listening regardless of outcome
          if (!foundSupport) {
            // If permission denied or error, default to simulated
            this.lastInputSource = "simulated";

            Logger.info(
              LOGGER_SOURCE,
              "Defaulting to 'simulated' input source due to lack of permission/support."
            );
          } else {
            // If permission granted, default to 'real' but allow override
            this.lastInputSource = "real";
            Logger.info(
              LOGGER_SOURCE,
              "Defaulting to 'real' input source (support detected)."
            );
          }
        });
    } else if (window.DeviceOrientationEvent) {
      // Standard browsers
      this.addOrientationListener();
      foundSupport = true;
      this.isListening = true;
      this.lastInputSource = "real"; // Default to real if API exists
      Logger.info(
        LOGGER_SOURCE,
        "Defaulting to 'real' input source (standard API detected)."
      );
    } else {
      // API not supported
      Logger.warn(
        LOGGER_SOURCE,
        "DeviceOrientationEvent API not supported. Mouse/Simulated input will be used."
      );
      this.isListening = true;
      this.lastInputSource = "simulated"; // Default to simulated if no API
      Logger.info(
        LOGGER_SOURCE,
        "Defaulting to 'simulated' input source (API not supported)."
      );
    }
  }

  /** Adds the actual event listener */
  private addOrientationListener(): void {
    window.addEventListener(
      "deviceorientation",
      this.handleOrientation.bind(this),
      true
    );
    // isListening and lastInputSource are set in startListening now
    Logger.info(LOGGER_SOURCE, "Added real deviceorientation listener.");
  }

  /**
   * Stops listening for device orientation events.
   */
  public stopListening(): void {
    if (!this.isListening) {
      return;
    }
    window.removeEventListener(
      "deviceorientation",
      this.handleOrientation.bind(this),
      true
    );
    this.isListening = false;
    Logger.info(LOGGER_SOURCE, "Stopped listening.");
  }

  /**
   * Clean up resources, primarily by stopping the listener.
   */
  public destroy(): void {
    this.stopListening();
  }

  /**
   * Handles the raw device orientation event. Updates internal values
   * and sets 'real' as the last input source if the change is significant.
   * @param event The DeviceOrientationEvent.
   */
  private handleOrientation(event: DeviceOrientationEvent): void {
    // Store current values before updating
    const currentBeta = event.beta;
    const currentGamma = event.gamma;

    // Update internal state
    this.alpha = event.alpha;
    this.beta = currentBeta;
    this.gamma = currentGamma;

    // Check for significant change compared to PREVIOUS real values
    const betaDiff = Math.abs((currentBeta ?? 0) - (this.prevBeta ?? 0));
    const gammaDiff = Math.abs((currentGamma ?? 0) - (this.prevGamma ?? 0));

    if (
      (currentBeta !== null && this.prevBeta === null) || // First valid reading
      (currentGamma !== null && this.prevGamma === null) || // First valid reading
      betaDiff > ORIENTATION_CHANGE_THRESHOLD ||
      gammaDiff > ORIENTATION_CHANGE_THRESHOLD
    ) {
      this.lastInputSource = "real";
      // Update previous values *after* comparison
      this.prevBeta = currentBeta;
      this.prevGamma = currentGamma;
      this.lastRealUpdateTime = Date.now();

      Logger.trace(
        LOGGER_SOURCE,
        `handleOrientation - SIGNIFICANT Real Update -> Source set to 'real'. B=${this.beta?.toFixed(
          1
        )}, G=${this.gamma?.toFixed(1)} (DiffB: ${betaDiff.toFixed(
          1
        )}, DiffG: ${gammaDiff.toFixed(1)})`
      );
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        `handleOrientation - Minor Real Update. B=${this.beta?.toFixed(
          1
        )}, G=${this.gamma?.toFixed(1)} (DiffB: ${betaDiff.toFixed(
          1
        )}, DiffG: ${gammaDiff.toFixed(1)})`
      );
    }

    // Check for cooldown period
    const now = Date.now();
    if (now - this.lastRealUpdateTime < MOUSE_INPUT_COOLDOWN_MS) {
      Logger.trace(
        LOGGER_SOURCE,
        `handleOrientation - Cooldown Active. B=${this.beta?.toFixed(
          1
        )}, G=${this.gamma?.toFixed(1)}`
      );
      // Do not change lastInputSource during cooldown
    } else {
      // End cooldown check
      this.lastInputSource = "simulated";
      // Update previous simulated values *after* comparison
      this.prevSimulatedBeta = this.simulatedBeta;
      this.prevSimulatedGamma = this.simulatedGamma;

      Logger.trace(
        LOGGER_SOURCE,
        `handleOrientation - Cooldown Ended. B=${this.simulatedBeta.toFixed(
          1
        )}, G=${this.simulatedGamma.toFixed(1)}`
      );
    }
  }

  /**
   * Sets target simulated orientation values. Updates internal values
   * and sets 'simulated' as the last input source if the change is significant.
   * Pass null to keep the current simulated value for that axis.
   * @param beta Simulated front-to-back tilt (degrees).
   * @param gamma Simulated left-to-right tilt (degrees).
   */
  public setSimulatedOrientation(
    beta: number | null,
    gamma: number | null
  ): void {
    // Allow setting simulated values regardless of the current source
    const targetBeta = beta ?? this.simulatedBeta;
    const targetGamma = gamma ?? this.simulatedGamma;

    // Check for significant change compared to PREVIOUS simulated values
    const betaDiff = Math.abs(targetBeta - this.prevSimulatedBeta);
    const gammaDiff = Math.abs(targetGamma - this.prevSimulatedGamma);

    // Update current simulated values *before* checking for change source update
    this.simulatedBeta = targetBeta;
    this.simulatedGamma = targetGamma;

    if (
      betaDiff > ORIENTATION_CHANGE_THRESHOLD ||
      gammaDiff > ORIENTATION_CHANGE_THRESHOLD
    ) {
      // Check for cooldown period
      const now = Date.now();
      if (now - this.lastRealUpdateTime < MOUSE_INPUT_COOLDOWN_MS) {
        Logger.trace(
          LOGGER_SOURCE,
          `setSimulatedOrientation - SIGNIFICANT Sim Update IGNORED (Cooldown Active). B=${this.simulatedBeta.toFixed(
            1
          )}, G=${this.simulatedGamma.toFixed(1)}`
        );
        // Do not change lastInputSource during cooldown
      } else {
        // End cooldown check
        this.lastInputSource = "simulated";
        // Update previous simulated values *after* comparison
        this.prevSimulatedBeta = this.simulatedBeta;
        this.prevSimulatedGamma = this.simulatedGamma;

        Logger.trace(
          LOGGER_SOURCE,
          `setSimulatedOrientation - SIGNIFICANT Sim Update -> Source set to 'simulated'. B=${this.simulatedBeta.toFixed(
            1
          )}, G=${this.simulatedGamma.toFixed(1)} (DiffB: ${betaDiff.toFixed(
            1
          )}, DiffG: ${gammaDiff.toFixed(1)})`
        );
      }
    } else {
      Logger.trace(
        LOGGER_SOURCE,
        `setSimulatedOrientation - Minor Sim Update. B=${this.simulatedBeta.toFixed(
          1
        )}, G=${this.simulatedGamma.toFixed(1)} (DiffB: ${betaDiff.toFixed(
          1
        )}, DiffG: ${gammaDiff.toFixed(1)})`
      );
    }

    Logger.trace(
      LOGGER_SOURCE,
      `SimSet: B=${this.simulatedBeta.toFixed(
        1
      )}, G=${this.simulatedGamma.toFixed(1)}`
    );
  }

  /**
   * Calculates the final target angle (in radians) for the rocket based on the
   * last active input source. The manager handles adjustments for landscape and source type.
   * Angle 0 is to the right, -PI/2 is towards the top of the screen.
   * Returns null if orientation data is not available from the active source.
   */
  public getTargetRocketAngleRadians(): number | null {
    let sourceUsed: InputSource = this.lastInputSource;
    let currentBeta: number | null;
    let currentGamma: number | null;

    // Determine which values to use based on the last active source
    if (this.lastInputSource === "simulated") {
      currentBeta = this.simulatedBeta;
      currentGamma = this.simulatedGamma;
    } else if (this.lastInputSource === "real") {
      currentBeta = this.beta;
      currentGamma = this.gamma;
      // Fallback if real data is null but was the last source
      if (currentBeta === null || currentGamma === null) {
        Logger.trace(
          LOGGER_SOURCE,
          "getTargetAngle - Real source active but data null, attempting fallback to simulated."
        );
        currentBeta = this.simulatedBeta; // Still get beta for consistency
        currentGamma = this.simulatedGamma;
        sourceUsed = "simulated"; // Log that we fell back
      }
    } else {
      // 'none' initially
      // Default to real if available, else simulated
      if (this.beta !== null && this.gamma !== null) {
        currentBeta = this.beta;
        currentGamma = this.gamma;
        sourceUsed = "real";
      } else {
        currentBeta = this.simulatedBeta;
        currentGamma = this.simulatedGamma;
        sourceUsed = "simulated";
      }
      Logger.trace(
        LOGGER_SOURCE,
        `getTargetAngle - Initial source ('none'), defaulting to '${sourceUsed}'.`
      );
    }

    // Add verbose log for which source is used
    Logger.trace(
      LOGGER_SOURCE,
      // Keep logging beta even if unused in calc, for debug context
      `getTargetAngle - Using '${sourceUsed}': Beta=${currentBeta?.toFixed(
        1
      )}, Gamma=${currentGamma?.toFixed(1)}`
    );

    // Use only gamma for calculation now
    if (currentGamma === null) {
      // Add verbose log for null data
      Logger.trace(
        LOGGER_SOURCE,
        `getTargetAngle - Returning null (Insufficient Gamma from '${sourceUsed}' source)`
      );
      return null;
    }

    let finalAngle: number;

    // --- Calculation depends on the source ---
    if (sourceUsed === "real") {
      // --- Calculation for Real Device ---
      // Assumes physics body angle 0 = visual UP
      if (currentBeta === null) {
        Logger.trace(
          LOGGER_SOURCE,
          `getTargetAngle - Real source active but data null, returning null.`
        );
        return null;
      }
      const betaRad = Phaser.Math.DegToRad(currentBeta);
      const gammaRad = Phaser.Math.DegToRad(currentGamma);
      // Target angle is the physical direction the device is tilted
      const physicalTiltAngle = Math.atan2(betaRad, gammaRad);
      // Adjust for landscape screen coordinates AND point opposite to tilt
      finalAngle = Phaser.Math.Angle.Wrap(
        physicalTiltAngle + (3 * Math.PI) / 2
      );

      Logger.trace(
        LOGGER_SOURCE,
        `getTargetAngle (Real) - physTilt=${physicalTiltAngle.toFixed(
          3
        )}, finalTarget=${finalAngle.toFixed(
          3
        )} (Using Beta: ${currentBeta.toFixed(
          1
        )}, Gamma: ${currentGamma.toFixed(1)})` // Updated log
      );
    } else {
      // sourceUsed === 'simulated' or fallback
      // --- Calculation for Simulated Device (Direct Target Angle) ---
      // Assumes physics body angle 0 = visual UP
      // Map gamma (-180 to 180) directly to target angle (-PI to PI)
      finalAngle = Phaser.Math.Angle.Wrap(Phaser.Math.DegToRad(currentGamma)); // Corrected calculation
      Logger.trace(
        LOGGER_SOURCE,
        `getTargetAngle (Sim) - Direct Target Calc: finalTarget=${finalAngle.toFixed(
          3
        )} (using Gamma: ${currentGamma.toFixed(1)})`
      );
    }

    // Final log shows the unified finalAngle variable
    Logger.trace(
      LOGGER_SOURCE,
      `getTargetAngle - Final Angle Returned (rad): ${finalAngle.toFixed(3)}`
    );

    return finalAngle;
  }

  // --- Potential Future Additions ---
  // getOrientationQuaternion(): [number, number, number, number] | null { ... }
  // getGravityVector(): { x: number; y: number; z: number } | null { ... }
}
