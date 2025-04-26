import { Logger } from "@one-button-to-space/shared";

// Add a source constant for logging specific to this file
const LOGGER_SOURCE = "🎲🔢"; // Example emojis for DeterministicRNG

export class DeterministicRNG {
  private seed: number;
  // Remove the logger instance property
  // private readonly logger = new Logger("DeterministicRNG");

  constructor(seed: number) {
    this.seed = seed;
    // Use static logger method
    Logger.debug(LOGGER_SOURCE, `Initialized with seed: ${seed}`);
  }

  /**
   * Sets a new seed for the generator.
   * @param seed The seed value (integer).
   */
  public setSeed(seed: number): void {
    this.seed = seed;
    // Use static logger method
    Logger.debug(LOGGER_SOURCE, `Seed set to: ${seed}`);
  }

  /**
   * Generates the next pseudorandom number using the Mulberry32 algorithm.
   * @returns A pseudorandom float between 0 (inclusive) and 1 (exclusive).
   */
  public next(): number {
    let t = (this.seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    // Use static logger method
    // Logger.trace(LOGGER_SOURCE, `Next random number: ${result.toFixed(4)}`); // Keep trace logs minimal for now
    return result;
  }

  /**
   * Generates a pseudorandom float within a specified range.
   * @param min The minimum value (inclusive).
   * @param max The maximum value (exclusive).
   * @returns A pseudorandom float between min and max.
   */
  public randomRange(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Generates a pseudorandom integer within a specified range.
   * Includes both min and max.
   * @param min The minimum value (inclusive).
   * @param max The maximum value (inclusive).
   * @returns A pseudorandom integer between min and max.
   */
  public randomInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}
