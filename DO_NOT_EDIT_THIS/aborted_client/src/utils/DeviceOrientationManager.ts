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
    const isSignificantRealChange =
      (currentBeta !== null && this.prevBeta === null) || // First valid reading
      (currentGamma !== null && this.prevGamma === null) || // First valid reading
      betaDiff > ORIENTATION_CHANGE_THRESHOLD ||
      gammaDiff > ORIENTATION_CHANGE_THRESHOLD;

    let logMessage = `handleOrientation - `;
    const bStr = this.beta?.toFixed(1) ?? "null";
    const gStr = this.gamma?.toFixed(1) ?? "null";
    const diffBStr = betaDiff.toFixed(1);
    const diffGStr = gammaDiff.toFixed(1);

    if (isSignificantRealChange) {
      this.lastInputSource = "real";
      this.prevBeta = currentBeta;
      this.prevGamma = currentGamma;
      this.lastRealUpdateTime = Date.now();
      logMessage += `SIGNIFICANT Real Update -> Source='real'. B=${bStr}, G=${gStr} (DiffB: ${diffBStr}, DiffG: ${diffGStr})`;
    } else {
      logMessage += `Minor Real Update. B=${bStr}, G=${gStr} (DiffB: ${diffBStr}, DiffG: ${diffGStr})`;
    }

    // Check for cooldown period
    const now = Date.now();
    if (now - this.lastRealUpdateTime < MOUSE_INPUT_COOLDOWN_MS) {
      logMessage += ` | Cooldown Active.`;
      // Do not change lastInputSource during cooldown
    } else if (this.lastInputSource !== "real") {
      // Only switch back to simulated if not already real AND cooldown ended
      // Check if we *were* in cooldown and it just ended
      if (this.lastInputSource !== "simulated") {
        // Avoid redundant log/assignment if already simulated
        this.lastInputSource = "simulated";
        // Only update prevSimulated if we are switching *to* simulated
        this.prevSimulatedBeta = this.simulatedBeta;
        this.prevSimulatedGamma = this.simulatedGamma;
        logMessage += ` | Cooldown Ended -> Source='simulated'. SimB=${this.simulatedBeta.toFixed(
          1
        )}, SimG=${this.simulatedGamma.toFixed(1)}`;
      }
    }

    Logger.trace(LOGGER_SOURCE, logMessage);
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
    const isSignificantSimChange =
      betaDiff > ORIENTATION_CHANGE_THRESHOLD ||
      gammaDiff > ORIENTATION_CHANGE_THRESHOLD;

    // Update current simulated values *before* checking for change source update
    this.simulatedBeta = targetBeta;
    this.simulatedGamma = targetGamma;

    let logMessage = `setSimulatedOrientation - `;
    const bStr = this.simulatedBeta.toFixed(1);
    const gStr = this.simulatedGamma.toFixed(1);
    const diffBStr = betaDiff.toFixed(1);
    const diffGStr = gammaDiff.toFixed(1);

    if (isSignificantSimChange) {
      // Check for cooldown period
      const now = Date.now();
      if (now - this.lastRealUpdateTime < MOUSE_INPUT_COOLDOWN_MS) {
        logMessage += `SIGNIFICANT Sim Update IGNORED (Cooldown Active).`;
        // Do not change lastInputSource during cooldown
      } else {
        // End cooldown check
        this.lastInputSource = "simulated";
        this.prevSimulatedBeta = this.simulatedBeta;
        this.prevSimulatedGamma = this.simulatedGamma;
        logMessage += `SIGNIFICANT Sim Update -> Source='simulated'.`;
      }
    } else {
      logMessage += `Minor Sim Update.`;
    }

    logMessage += ` B=${bStr}, G=${gStr} (DiffB: ${diffBStr}, DiffG: ${diffGStr})`;
    Logger.trace(LOGGER_SOURCE, logMessage);

    // Removed redundant SimSet log
    // Logger.trace(
    //   LOGGER_SOURCE,
    //   `SimSet: B=${this.simulatedBeta.toFixed(
    //     1
    //   )}, G=${this.simulatedGamma.toFixed(1)}`
    // );
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
    let logMessage = `getTargetAngle - `;

    // Determine which values to use based on the last active source
    if (this.lastInputSource === "simulated") {
      currentBeta = this.simulatedBeta;
      currentGamma = this.simulatedGamma;
      logMessage += `Using 'simulated'. `;
    } else if (this.lastInputSource === "real") {
      currentBeta = this.beta;
      currentGamma = this.gamma;
      // Fallback if real data is null but was the last source
      if (currentBeta === null || currentGamma === null) {
        logMessage += `Real source active but data null, fallback to simulated. `;
        currentBeta = this.simulatedBeta; // Still get beta for consistency
        currentGamma = this.simulatedGamma;
        sourceUsed = "simulated"; // Log that we fell back
      } else {
        logMessage += `Using 'real'. `;
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
      logMessage += `Initial source ('none'), defaulting to '${sourceUsed}'. `;
    }

    const betaStr = currentBeta?.toFixed(1) ?? "null";
    const gammaStr = currentGamma?.toFixed(1) ?? "null";
    logMessage += `Input: Beta=${betaStr}, Gamma=${gammaStr}. `;

    // Use only gamma for calculation now
    if (currentGamma === null) {
      logMessage += `Result: null (Insufficient Gamma from '${sourceUsed}' source).`;
      Logger.trace(LOGGER_SOURCE, logMessage);
      return null;
    }

    let finalAngle: number;
    let calculationType: string;

    // --- Calculation depends on the source ---
    if (sourceUsed === "real") {
      calculationType = "Real";
      // --- Calculation for Real Device ---
      if (currentBeta === null) {
        // Should have been caught by fallback, but check again
        logMessage += `Result: null (Real source active but Beta null post-fallback check).`;
        Logger.trace(LOGGER_SOURCE, logMessage);
        return null;
      }
      const betaRad = Phaser.Math.DegToRad(currentBeta);
      const gammaRad = Phaser.Math.DegToRad(currentGamma);
      const physicalTiltAngle = Math.atan2(betaRad, gammaRad);
      finalAngle = Phaser.Math.Angle.Wrap(
        physicalTiltAngle + (3 * Math.PI) / 2
      );
      logMessage += `Calc (Real): physTilt=${physicalTiltAngle.toFixed(3)}, `;
    } else {
      // sourceUsed === 'simulated' or fallback
      calculationType = "Sim";
      // --- Calculation for Simulated Device (Direct Target Angle) ---
      finalAngle = Phaser.Math.Angle.Wrap(Phaser.Math.DegToRad(currentGamma)); // Corrected calculation
      logMessage += `Calc (Sim): Direct from Gamma. `;
    }

    logMessage += `Result: finalAngle=${finalAngle.toFixed(3)} rad.`;
    Logger.trace(LOGGER_SOURCE, logMessage);

    return finalAngle;
  }

  // --- Potential Future Additions ---
  // getOrientationQuaternion(): [number, number, number, number] | null { ... }
  // getGravityVector(): { x: number; y: number; z: number } | null { ... }
}
