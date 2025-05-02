import { Logger } from "@one-button-to-space/shared";
import { DeterministicRNG } from "../../utils/DeterministicRNG";

const LOGGER_SOURCE = "✨ StarGen";

export interface Star {
  x: number;
  y: number;
  size: number;
  color: string; // rgba(r, g, b, alpha)
  alpha: number; // Store alpha separately for easier use
}

export interface StarfieldConfig {
  seed: number;
  density: number; // Stars per 1000x1000 pixels
  minSize: number;
  maxSize: number;
  minBrightness: number;
  maxBrightness: number;
  textureWidth: number;
  textureHeight: number;
  colorVariations: boolean;
}

const DEFAULT_CONFIG: StarfieldConfig = {
  seed: Date.now(),
  density: 50, // Reduced density for tiling
  minSize: 1,
  maxSize: 3, // Smaller max size
  minBrightness: 0.3,
  maxBrightness: 0.8, // Slightly dimmer max brightness
  textureWidth: 2048,
  textureHeight: 2048,
  colorVariations: true,
};

export class Starfield {
  public readonly config: StarfieldConfig;
  private rng: DeterministicRNG;
  private stars: Star[] = [];

  constructor(config: Partial<StarfieldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rng = new DeterministicRNG(this.config.seed);
    Logger.info(
      LOGGER_SOURCE,
      `Initialized with config: ${JSON.stringify(this.config)}`
    );
    this.generateStars();
  }

  private generateStars(): void {
    this.stars = [];
    this.rng.setSeed(this.config.seed); // Ensure deterministic generation

    const areaFactor =
      (this.config.textureWidth * this.config.textureHeight) / (1000 * 1000);
    const numStars = Math.floor(areaFactor * this.config.density);

    Logger.debug(
      LOGGER_SOURCE,
      `Generating ${numStars} stars for texture ${this.config.textureWidth}x${this.config.textureHeight}`
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
      let r = 255,
        g = 255,
        b = 255; // Default white

      if (this.config.colorVariations) {
        // Add subtle color variations (slightly blueish/yellowish)
        r = this.rng.randomInt(240, 255);
        g = this.rng.randomInt(240, 255);
        b = 255; // Keep blue high for a spacey feel
      }

      this.stars.push({
        x: this.rng.next() * this.config.textureWidth, // Use .next() which returns [0, 1)
        y: this.rng.next() * this.config.textureHeight, // Use .next()
        size: size,
        alpha: brightness,
        color: `rgba(${r}, ${g}, ${b}, ${brightness})`, // Pre-calculate rgba string
      });
    }
    Logger.debug(LOGGER_SOURCE, `Generated ${this.stars.length} stars.`);
  }

  public getStars(): ReadonlyArray<Star> {
    return this.stars;
  }
}
