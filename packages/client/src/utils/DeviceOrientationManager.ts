import Phaser from "phaser"; // Added to handle Phaser types if needed later
import { Logger } from "@one-button-to-space/shared"; // Corrected path
// Import shared constants
import { Constants } from "@one-button-to-space/shared"; // Import from shared package
const {
  ORIENTATION_CHANGE_THRESHOLD,
  // MOUSE_INPUT_COOLDOWN_MS, // Removed - No longer needed
  // DEFAULT_SIMULATED_BETA, // Removed
  // DEFAULT_SIMULATED_GAMMA, // Removed
} = Constants;

// Define the source constant for logging
const LOGGER_SOURCE = "🧭📱"; // Chosen emojis for DeviceOrientationManager

// Type for tracking the last active input source - REMOVED, only 'real' exists now
// type InputSource = "real" | "simulated" | "none";

/**
 * Manages device orientation events and calculates the direction
 * of gravity relative to the device screen.
 */
export class DeviceOrientationManager {
  // --- Current Orientation Data ---
  public alpha: number | null = null;
  public beta: number | null = null;
  public gamma: number | null = null;

  // --- Previous Orientation Data (for change detection) ---
  private prevBeta: number | null = null;
  private prevGamma: number | null = null;

  // --- Simulation State - REMOVED ---
  // private simulatedBeta: number = DEFAULT_SIMULATED_BETA;
  // private simulatedGamma: number = DEFAULT_SIMULATED_GAMMA;
  // private prevSimulatedBeta: number = DEFAULT_SIMULATED_BETA;
  // private prevSimulatedGamma: number = DEFAULT_SIMULATED_GAMMA;

  // --- State Tracking ---
  private isListening: boolean = false;
  // private lastInputSource: InputSource = "none"; // Removed - Only 'real' source now
  // private lastRealUpdateTime: number = 0; // Removed - Cooldown logic removed

  constructor() {
    // Initialization logic if needed
  }

  /**
   * Starts listening for device orientation events.
   * Should be called only once. Requests permission if needed.
   */
  public startListening(): void {
    if (this.isListening) {
      Logger.warn(
        LOGGER_SOURCE,
        "startListening called when already listening."
      );
      return;
    }

    let permissionRequested = false; // Track if permission flow was initiated

    // Check for API support and permission requirement (iOS 13+)
    if (
      typeof window.DeviceOrientationEvent !== "undefined" &&
      typeof (window.DeviceOrientationEvent as any).requestPermission ===
        "function"
    ) {
      permissionRequested = true;
      (window.DeviceOrientationEvent as any)
        .requestPermission()
        .then((permissionState: string) => {
          if (permissionState === "granted") {
            this.addOrientationListener();
            // isListening is set within addOrientationListener
          } else {
            Logger.warn(
              LOGGER_SOURCE,
              "Device orientation permission denied. Orientation features will not work."
            );
            this.isListening = true; // Mark as "listening" conceptually, though no listener added
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
            "Assuming no device orientation support due to error. Orientation features will not work."
          );
          this.isListening = true; // Mark as "listening" conceptually
        });
      // No finally block needed here as isListening is handled in branches
    } else if (window.DeviceOrientationEvent) {
      // Standard browsers or browsers where permission isn't needed/available via this API
      this.addOrientationListener();
      // isListening is set within addOrientationListener
    } else {
      // API not supported at all
      Logger.warn(
        LOGGER_SOURCE,
        "DeviceOrientationEvent API not supported. Orientation features will not work."
      );
      this.isListening = true; // Mark as "listening" conceptually
    }

    // If permission wasn't requested (standard browser or no support),
    // ensure isListening is eventually set true conceptually if addOrientationListener wasn't called.
    // This prevents calling startListening multiple times unnecessarily.
    // Note: addOrientationListener sets this.isListening = true.
    // The permission flow also sets it true in its branches/catch.
    // The 'API not supported' branch sets it true.
  }

  /** Adds the actual event listener */
  private addOrientationListener(): void {
    if (this.isListening) return; // Prevent adding multiple listeners

    window.addEventListener(
      "deviceorientation",
      this.handleOrientation.bind(this),
      true
    );
    this.isListening = true; // Set listening state here
    Logger.info(LOGGER_SOURCE, "Added real deviceorientation listener.");
  }

  /**
   * Stops listening for device orientation events.
   */
  public stopListening(): void {
    // Check if we actually added the listener before trying to remove it
    if (!this.isListening || !window.DeviceOrientationEvent) {
      // Check if we ever started properly
      return;
    }
    // Check if the listener function itself exists (might not if permission denied early)
    try {
      window.removeEventListener(
        "deviceorientation",
        this.handleOrientation.bind(this), // Ensure the bound function is the one removed
        true
      );
      Logger.info(LOGGER_SOURCE, "Removed deviceorientation listener.");
    } catch (error) {
      // This catch might be overly cautious, but handles potential edge cases
      // during removal if the listener wasn't added correctly.
      Logger.warn(
        LOGGER_SOURCE,
        "Could not remove listener, might not have been added properly.",
        error
      );
    } finally {
      this.isListening = false; // Always mark as not listening after attempt
    }
  }

  /**
   * Clean up resources, primarily by stopping the listener.
   */
  public destroy(): void {
    this.stopListening();
  }

  /**
   * Handles the raw device orientation event. Updates internal values.
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
      // this.lastInputSource = "real"; // Removed
      this.prevBeta = currentBeta; // Update previous values on significant change
      this.prevGamma = currentGamma;
      // this.lastRealUpdateTime = Date.now(); // Removed - Cooldown logic removed
      logMessage += `SIGNIFICANT Real Update. B=${bStr}, G=${gStr} (DiffB: ${diffBStr}, DiffG: ${diffGStr})`;
    } else {
      logMessage += `Minor Real Update. B=${bStr}, G=${gStr} (DiffB: ${diffBStr}, DiffG: ${diffGStr})`;
    }

    // Cooldown and source switching logic removed

    Logger.trace(LOGGER_SOURCE, logMessage);
  }

  // --- REMOVED setSimulatedOrientation method ---
  // public setSimulatedOrientation(...) { ... }

  /**
   * Calculates the final target angle (in radians) for the rocket based on the
   * real device orientation. The manager handles adjustments for landscape.
   * Angle 0 is to the right, -PI/2 is towards the top of the screen.
   * Returns null if orientation data is not available.
   */
  public getTargetRocketAngleRadians(): number | null {
    // let sourceUsed: InputSource = this.lastInputSource; // Removed
    const currentBeta = this.beta; // Directly use real values
    const currentGamma = this.gamma;
    let logMessage = `getTargetAngle - `;

    // Source checking/fallback logic removed

    const betaStr = currentBeta?.toFixed(1) ?? "null";
    const gammaStr = currentGamma?.toFixed(1) ?? "null";
    logMessage += `Input: Beta=${betaStr}, Gamma=${gammaStr}. `;

    // Check if necessary data is available
    if (currentGamma === null || currentBeta === null) {
      // Need both Beta and Gamma for the atan2 calculation
      logMessage += `Result: null (Insufficient Beta or Gamma).`;
      Logger.trace(LOGGER_SOURCE, logMessage);
      return null;
    }

    let finalAngle: number;
    // let calculationType: string; // Removed

    // --- Calculation depends on the source - REMOVED --- Only 'real' calculation remains
    // calculationType = "Real"; // Removed
    // --- Calculation for Real Device ---
    const betaRad = Phaser.Math.DegToRad(currentBeta);
    const gammaRad = Phaser.Math.DegToRad(currentGamma);
    // Calculate the angle of the (beta, gamma) vector in the plane defined by the screen's axes.
    // atan2(y, x) -> atan2(beta, gamma) gives the angle relative to the positive gamma axis.
    const physicalTiltAngle = Math.atan2(betaRad, gammaRad);

    // Adjust the angle:
    // - Device held upright (portrait): beta=90, gamma=0 -> physicalTiltAngle=PI/2
    // - Device tilted right (landscape): beta=0, gamma=90 -> physicalTiltAngle=0
    // - Device tilted left (landscape): beta=0, gamma=-90 -> physicalTiltAngle=PI or -PI
    // - Device upside down: beta=-90, gamma=0 -> physicalTiltAngle=-PI/2
    // We want the rocket angle where 0 is right, -PI/2 is up (top of screen).
    // When upright (tilt=PI/2), rocket should point up (-PI/2). Adjustment = -PI.
    // When tilted right (tilt=0), rocket should point right (0). Adjustment = 0. No, wait. Gravity points down.
    // Let's rethink: We want the angle representing the *downward* direction relative to the screen.
    // Beta positive = top tilted back. Gamma positive = right side tilted down.
    // atan2(beta, gamma) gives the angle of the vector pointing *away* from gravity in the screen plane.
    // If beta=0, gamma=90 (right side down), angle is 0. Down is to the right (angle 0).
    // If beta=90, gamma=0 (top tilted back/screen flat pointing up), angle is PI/2. Down is towards bottom (angle PI/2). NO, down is towards user (+beta axis) which is PI/2 in atan2.
    // If beta=0, gamma=-90 (left side down), angle is PI/-PI. Down is to the left (angle PI/-PI).
    // If beta=-90, gamma=0 (top tilted forward/screen flat pointing down), angle is -PI/2. Down is towards top (-PI/2). NO, down is away from user (-beta axis) which is -PI/2 in atan2.

    // So, Math.atan2(beta, gamma) seems to directly represent the angle of "down"
    // relative to the screen, where 0 is +Gamma (right) and PI/2 is +Beta (bottom).
    // Phaser angles: 0 is right, -PI/2 (or 3PI/2) is up, PI/2 is down, PI is left.
    // We need to map atan2 result to Phaser angle for the *rocket*.
    // Rocket angle = desired direction. If gravity is right (atan2=0), rocket should point left (PI).
    // If gravity is down (atan2=PI/2), rocket should point up (-PI/2 or 3PI/2).
    // If gravity is left (atan2=PI), rocket should point right (0).
    // If gravity is up (atan2=-PI/2), rocket should point down (PI/2).
    // It looks like Rocket Angle = atan2_angle + PI. Let's test.
    // atan2=0   -> PI (Correct: G=Right -> R=Left)
    // atan2=PI/2 -> 3PI/2 or -PI/2 (Correct: G=Down -> R=Up)
    // atan2=PI  -> 2PI or 0 (Correct: G=Left -> R=Right)
    // atan2=-PI/2 -> PI/2 (Correct: G=Up -> R=Down)

    // finalAngle = Phaser.Math.Angle.Wrap(physicalTiltAngle + Math.PI); // Old calculation based on pointing opposite gravity
    // New interpretation: Game wants angle gravity points TO.
    // Phaser angle convention: 0 = right, PI/2 = down, PI = left, -PI/2 = up.
    // atan2(beta, gamma) gives angle where 0 = +gamma (right), PI/2 = +beta (bottom... wait, top tilt back is +beta).
    // Let's re-verify beta/gamma meaning:
    // beta: front-back tilt. 90 = vertical, 0 = flat, -90 = upside down vertical
    // gamma: left-right tilt. + is right down, - is left down.
    // Goal: Angle (Phaser convention) pointing towards perceived "down".
    // Test case: Right side down (Landscape). beta=0, gamma=90. atan2(0, PI/2) = 0. Phaser angle should be 0 (Right). Matches.
    // Test case: Left side down (Landscape). beta=0, gamma=-90. atan2(0, -PI/2) = PI. Phaser angle should be PI (Left). Matches.
    // Test case: Top down (Portrait upside down). beta=-90, gamma=0. atan2(-PI/2, 0) = -PI/2. Phaser angle should be PI/2 (Down). Doesn't match.
    // Test case: Bottom down (Portrait upright). beta=90, gamma=0. atan2(PI/2, 0) = PI/2. Phaser angle should be PI/2 (Down). Matches.

    // It seems atan2(beta, gamma) directly gives the Phaser angle for "down".

    finalAngle = Phaser.Math.Angle.Wrap(physicalTiltAngle);
    // logMessage += `Calc (Real): physTilt=${physicalTiltAngle.toFixed(3)}, Adjustment=+PI `; // Old log
    logMessage += `Calc (Real): physTilt=${physicalTiltAngle.toFixed(
      3
    )} maps directly to Phaser angle. `;

    // Simulation calculation removed

    logMessage += `Result: finalAngle=${finalAngle.toFixed(3)} rad.`;
    Logger.trace(LOGGER_SOURCE, logMessage);

    return finalAngle;
  }

  // --- Potential Future Additions ---
  // getOrientationQuaternion(): [number, number, number, number] | null { ... }
  // getGravityVector(): { x: number; y: number; z: number } | null { ... }
}
