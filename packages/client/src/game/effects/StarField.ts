import { Logger } from "@one-button-to-space/shared";
import { DeterministicRNG } from "../../utils/DeterministicRNG";

// Add a source constant for logging specific to this file
const LOGGER_SOURCE = "✨"; // Example emoji for StarField

// Define the fixed bounds for static star generation - REDUCED SIZE
const STARFIELD_FIXED_WIDTH = 5000;
const STARFIELD_FIXED_HEIGHT = 5000;

interface Star {
  x: number;
  y: number;
  size: number;
  color: string; // e.g., 'rgba(255, 255, 255, alpha)'
  brightness: number; // 0-1, affects alpha
  // Optional properties for twinkling/pulsing
  baseBrightness?: number;
  pulseSpeed?: number;
  pulseOffset?: number;
}

interface StarFieldConfig {
  seed: number;
  density: number; // Stars per 1000x1000 pixels
  minSize: number;
  maxSize: number;
  minBrightness: number;
  maxBrightness: number;
  colorVariations: boolean;
  enableTwinkling: boolean;
  twinkleSpeed: number;
}

const DEFAULT_CONFIG: StarFieldConfig = {
  seed: Date.now(),
  density: 100, // Keep reduced density
  minSize: 0.5,
  maxSize: 2,
  minBrightness: 0.2,
  maxBrightness: 1.0,
  colorVariations: true,
  enableTwinkling: false, // Disabled twinkling by default for performance
  twinkleSpeed: 0.1,
};

export class StarField {
  private config: StarFieldConfig;
  private rng: DeterministicRNG;
  private stars: Star[] = [];

  constructor(config: Partial<StarFieldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new DeterministicRNG(this.config.seed);
    Logger.info(
      LOGGER_SOURCE,
      `Initialized with config: ${JSON.stringify(this.config)}`
    );
    // Generate stars immediately on construction for the fixed area
    this.generateStars();
  }

  /**
   * Generates stars across a fixed large area.
   * No parameters needed.
   */
  public generateStars(): void {
    this.stars = [];
    this.rng.setSeed(this.config.seed); // Reset seed for deterministic generation

    // Calculate number of stars based on fixed area and density
    const fixedArea = STARFIELD_FIXED_WIDTH * STARFIELD_FIXED_HEIGHT;
    const numStars = Math.floor(
      (fixedArea / (1000 * 1000)) * this.config.density
    );

    // Calculate half-dimensions for centering
    const halfWidth = STARFIELD_FIXED_WIDTH / 2;
    const halfHeight = STARFIELD_FIXED_HEIGHT / 2;

    Logger.debug(
      LOGGER_SOURCE,
      `Generating ${numStars} static stars for fixed area ${STARFIELD_FIXED_WIDTH}x${STARFIELD_FIXED_HEIGHT}`
    );

    for (let i = 0; i < numStars; i++) {
      const size = this.rng.randomRange(
        this.config.minSize,
        this.config.maxSize
      );
      const brightness = this.rng.randomRange(
        this.config.minBrightness,
        this.config.maxBrightness
      );
      let colorValue = 255; // Default white
      if (this.config.colorVariations) {
        colorValue = this.rng.randomInt(230, 255);
      }
      const alpha = brightness;

      const star: Star = {
        // Generate coordinates within the fixed bounds centered at 0,0
        x: this.rng.randomRange(-halfWidth, halfWidth),
        y: this.rng.randomRange(-halfHeight, halfHeight),
        size: size,
        brightness: brightness,
        color: `rgba(${colorValue}, ${colorValue}, ${
          colorValue === 255 ? 255 : this.rng.randomInt(230, 255)
        }, ${alpha})`,
      };

      // Keep twinkling logic
      if (this.config.enableTwinkling) {
        star.baseBrightness = brightness;
        star.pulseSpeed =
          this.rng.randomRange(0.5, 1.5) * this.config.twinkleSpeed;
        star.pulseOffset = this.rng.randomRange(0, Math.PI * 2);
      }

      this.stars.push(star);
    }
    Logger.debug(LOGGER_SOURCE, `Generated ${this.stars.length} static stars.`);
  }

  public updateConfig(newConfig: Partial<StarFieldConfig>): void {
    const needsRegeneration =
      (newConfig.density !== undefined &&
        newConfig.density !== this.config.density) ||
      (newConfig.seed !== undefined && newConfig.seed !== this.config.seed);

    this.config = { ...this.config, ...newConfig };
    this.rng.setSeed(this.config.seed);
    Logger.info(
      LOGGER_SOURCE,
      `Updated config: ${JSON.stringify(this.config)}`
    );

    // Regenerate only if density or seed changed
    if (needsRegeneration) {
      Logger.info(
        LOGGER_SOURCE,
        "Density or seed changed, regenerating static stars."
      );
      this.generateStars();
    } else {
      // Update existing stars if only visual properties changed (like twinkling)
      this.stars.forEach((star) => {
        // Update twinkling properties if they changed
        if (
          newConfig.enableTwinkling !== undefined ||
          newConfig.twinkleSpeed !== undefined
        ) {
          star.baseBrightness = star.brightness;
          star.pulseSpeed =
            this.rng.randomRange(0.5, 1.5) * this.config.twinkleSpeed;
          star.pulseOffset = this.rng.randomRange(0, Math.PI * 2);
        }
        // Add updates for other changeable visual props if necessary
      });
    }
  }

  public getStars(): ReadonlyArray<Star> {
    return this.stars;
  }

  public update(time: number): void {
    if (!this.config.enableTwinkling) return;

    this.stars.forEach((star) => {
      if (
        star.baseBrightness !== undefined &&
        star.pulseSpeed !== undefined &&
        star.pulseOffset !== undefined
      ) {
        const pulse =
          Math.sin(time * star.pulseSpeed + star.pulseOffset) * 0.5 + 0.5; // Varies 0 to 1
        star.brightness = star.baseBrightness * (0.5 + pulse * 0.5); // Modulate base brightness
        const alpha = star.brightness;
        // Update color alpha - assumes RGBA format
        star.color = star.color.replace(/,[^,]+?\)$/, `, ${alpha.toFixed(3)})`);
      }
    });
  }
}
