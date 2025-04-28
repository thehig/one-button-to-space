import Phaser from "phaser";
// Use direct import for Body
import { Body as MatterBody } from "matter-js";
// Remove unused Matter default import if Vector isn't needed elsewhere here
// import Matter from "matter-js";
import { CollisionCategory } from "@one-button-to-space/shared";
import { createNoise2D } from "simplex-noise"; // Import noise library
import { Logger } from "@one-button-to-space/shared"; // Updated path

// Define the source constant for logging
const LOGGER_SOURCE = "🪐✨"; // Chosen emojis for Planet

// Simple seeded PRNG (Mulberry32)
function mulberry32(seedStr: string): () => number {
  // Simple string hash to number
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0; // Use the hash as the seed

  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Interface for planet configuration
export interface PlanetConfig {
  id: string | number; // Unique ID for texture key generation
  seed: string; // Seed for deterministic noise
  radius: number;
  mass: number;
  atmosphereHeight?: number;
  surfaceDensity?: number;
  colors: {
    base: string; // e.g., '#008800'
    accent1?: string; // e.g., '#00FF00'
    accent2?: string; // e.g., '#FFFF00'
    // Add more colors as needed
  };
  noiseParams: {
    scale: number; // How zoomed in the noise is
    octaves?: number; // Layers of noise (more detail) - simple for now
    // Add more noise parameters (persistence, lacunarity) if needed
  };
}

// Define collision categories if needed within Planet or import from a shared location
// const CollisionCategory = { ... };

export class Planet {
  public scene: Phaser.Scene;
  // Use the imported MatterBody type
  public body: MatterBody;
  public visual: Phaser.GameObjects.Sprite; // Changed from Arc to Sprite
  public atmosphereVisual: Phaser.GameObjects.Graphics | null = null;
  public config: PlanetConfig; // Store the config

  // Keep original properties if they are still needed outside config
  public mass: number;
  public radius: number;
  public atmosphereHeight: number;
  public surfaceDensity: number;
  // Add property for debug text
  public debugText: Phaser.GameObjects.Text | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: PlanetConfig // Accept config object
  ) {
    this.scene = scene;
    this.config = config; // Store config
    this.radius = config.radius;
    this.mass = config.mass;
    // Use defaults from config or provide fallbacks
    this.atmosphereHeight = config.atmosphereHeight ?? 50;
    this.surfaceDensity = config.surfaceDensity ?? 1.0;

    // Generate texture and get its key
    const textureKey = this.generateTexture();

    // Create visual representation using the generated texture
    this.visual = scene.add.sprite(x, y, textureKey);
    // Ensure the sprite visual matches the physical radius
    this.visual.setDisplaySize(this.radius * 2, this.radius * 2);

    Logger.info(
      LOGGER_SOURCE,
      `Visual created with texture: ${textureKey}` // Removed visual object itself
    );

    // Create physics body and cast to the imported MatterBody type
    this.body = scene.matter.add.circle(x, y, this.radius, {
      isStatic: true,
      label: "planet",
      mass: this.mass, // Use mass from config
      collisionFilter: {
        category: CollisionCategory.GROUND,
        mask: CollisionCategory.ROCKET,
      },
      // Assign config to body userData for potential future use (e.g., identifying planet type)
      plugin: {
        planetConfig: config,
      },
    }) as MatterBody; // Cast to imported type
    Logger.info(LOGGER_SOURCE, "Physics body created", this.body.id);

    this.createAtmosphereVisual();
    // Create debug text AFTER visual and body
    this.createDebugText();
  }

  /**
   * Generates a procedural texture for the planet based on its config.
   * Adds the texture to the scene's texture manager if it doesn't exist.
   * @returns The unique key of the generated or existing texture.
   */
  private generateTexture(): string {
    const textureKey = `planet-tex-${this.config.id}-${this.config.seed}-${this.radius}`; // More robust key

    // Check if texture already exists
    if (this.scene.textures.exists(textureKey)) {
      Logger.debug(LOGGER_SOURCE, `Texture ${textureKey} already exists.`);
      return textureKey;
    }

    Logger.info(LOGGER_SOURCE, `Generating texture ${textureKey}...`);

    const diameter = Math.ceil(this.radius * 2);
    // Create a canvas texture
    const canvasTexture = this.scene.textures.createCanvas(
      textureKey,
      diameter,
      diameter
    );
    if (!canvasTexture) {
      Logger.error(
        LOGGER_SOURCE,
        `Failed to create canvas texture ${textureKey}`
      );
      // Fallback or error handling needed - perhaps return a default texture key?
      return "default_planet"; // Provide a fallback texture key name
    }
    const context = canvasTexture.getContext();
    const imageData = context.createImageData(diameter, diameter);
    const data = imageData.data;

    // Initialize noise generator with seed
    const seededRandom = mulberry32(this.config.seed); // Create seeded random function
    const noise2D = createNoise2D(seededRandom); // Initialize noise with the PRNG

    const baseColor = Phaser.Display.Color.ValueToColor(
      this.config.colors.base
    );
    const accentColor1 = this.config.colors.accent1
      ? Phaser.Display.Color.ValueToColor(this.config.colors.accent1)
      : baseColor;
    // Add accentColor2 handling if needed

    const scale =
      this.config.noiseParams.scale <= 0 ? 0.01 : this.config.noiseParams.scale; // Prevent division by zero or invalid scale

    // Generate pixel data
    for (let y = 0; y < diameter; y++) {
      for (let x = 0; x < diameter; x++) {
        const index = (y * diameter + x) * 4;

        // Map canvas coords to circle coords relative to center (radius, radius)
        const dx = x - this.radius;
        const dy = y - this.radius;
        const distSq = dx * dx + dy * dy;

        // Check if the pixel is inside the planet's circle
        if (distSq <= this.radius * this.radius) {
          // Calculate noise value - normalize coordinates for noise input
          const nx = (x / diameter) * scale;
          const ny = (y / diameter) * scale;
          const noiseValue = (noise2D(nx, ny) + 1) / 2; // Normalize noise to 0-1 range

          // Interpolate between base and accent color based on noise
          const lerpedColor = Phaser.Display.Color.Interpolate.ColorWithColor(
            baseColor,
            accentColor1,
            100, // Range for interpolation (0-100)
            Math.floor(noiseValue * 100) // Value for interpolation
          );

          data[index] = lerpedColor.r; // R
          data[index + 1] = lerpedColor.g; // G
          data[index + 2] = lerpedColor.b; // B
          data[index + 3] = 255; // A (fully opaque)
        } else {
          // Pixel is outside the circle - make it transparent
          data[index] = 0; // R
          data[index + 1] = 0; // G
          data[index + 2] = 0; // B
          data[index + 3] = 0; // A (fully transparent)
        }
      }
    }

    // Put the generated data onto the canvas
    context.putImageData(imageData, 0, 0);

    // Refresh the canvas texture
    canvasTexture.refresh();

    Logger.info(LOGGER_SOURCE, `Texture ${textureKey} generated successfully.`);

    return textureKey;
  }

  /**
   * Calculates the atmospheric density at a given world position relative to this planet.
   * @param position The world position {x, y} to check (using direct Matter import Vector type).
   * @returns The calculated atmospheric density (0 if outside this planet's atmosphere).
   */
  // Assuming Matter.Vector is okay here, otherwise import Vector type directly
  getDensityAt(position: { x: number; y: number }): number {
    // Use simple object type if Vector isn't imported
    if (this.atmosphereHeight <= 0 || this.surfaceDensity <= 0) {
      return 0;
    }

    const distance = Phaser.Math.Distance.BetweenPoints(
      position,
      this.body.position
    );
    const altitude = distance - this.radius;

    if (altitude >= 0 && altitude <= this.atmosphereHeight) {
      const density =
        this.surfaceDensity * (1 - altitude / this.atmosphereHeight);
      return Math.max(0, density);
    }

    return 0;
  }

  /**
   * Creates a visual representation of the planet's atmosphere.
   */
  private createAtmosphereVisual(): void {
    // Clear previous visual if it exists
    this.atmosphereVisual?.destroy();
    this.atmosphereVisual = null;

    // Only draw if atmosphere exists and has positive height/density
    if (this.atmosphereHeight > 0 && this.surfaceDensity > 0) {
      this.atmosphereVisual = this.scene.add.graphics();

      const numSteps = 10; // Number of concentric circles
      const maxAlpha = 0.2; // Max visual alpha accumulation (adjust as needed)
      const alphaPerStep = maxAlpha / numSteps;

      // Draw circles from outermost (most transparent) to innermost
      for (let i = numSteps; i >= 1; i--) {
        const stepRadius = this.radius + (this.atmosphereHeight * i) / numSteps;

        this.atmosphereVisual.fillStyle(0x0000ff, alphaPerStep);
        this.atmosphereVisual.fillCircle(
          0, // Center X relative to graphics origin
          0, // Center Y relative to graphics origin
          stepRadius // Radius for this step
        );
      }

      // Position the graphics object itself at the planet's body center
      this.atmosphereVisual.setPosition(
        this.body.position.x,
        this.body.position.y
      );
      // Draw behind the main planet visual
      this.atmosphereVisual.setDepth(-1);

      Logger.info(
        LOGGER_SOURCE,
        "Atmosphere visual created for planet:",
        this.body.id
      );
    } else {
      this.atmosphereVisual = null; // Ensure it's null if no atmosphere
    }
  }

  // Method to create/update debug text
  private createDebugText(): void {
    // Destroy existing text if recreating
    this.debugText?.destroy();

    const textContent = [
      `Name: ${this.config.seed}`, // Seed holds the original name
      `ID: ${this.config.id}`,
      `Pos: (${this.body.position.x.toFixed(0)}, ${this.body.position.y.toFixed(
        0
      )})`,
      `Radius: ${this.radius.toFixed(0)}`,
      `Mass: ${this.mass.toFixed(0)}`,
      `Atmos H: ${this.atmosphereHeight.toFixed(0)}`,
      `Surf D: ${this.surfaceDensity.toFixed(2)}`,
      `Noise Sc: ${this.config.noiseParams.scale.toFixed(1)}`,
      `Base Clr: ${this.config.colors.base}`,
    ];

    this.debugText = this.scene.add
      .text(
        this.body.position.x, // Position at body center
        this.body.position.y,
        textContent,
        {
          fontSize: "64px",
          color: "#FFFF00", // Yellow for visibility
          align: "center",
          stroke: "#000000", // Black stroke
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5, 0.5) // Center the text origin
      .setDepth(this.visual.depth + 10); // Ensure text is on top

    Logger.trace(
      LOGGER_SOURCE,
      `Debug text created for planet ${this.config.id}`
    );
  }

  // Updates planet visuals and body based on new data
  // This might involve more complex updates depending on what can change
  update(data: PlanetConfig): void {
    let updated = false;
    if (this.body && data.mass !== undefined && this.mass !== data.mass) {
      this.mass = data.mass;
      // Use direct import static method
      MatterBody.setMass(this.body, data.mass);
      Logger.info(
        LOGGER_SOURCE,
        `Planet ${this.config.id} mass updated to ${data.mass}`
      );
      updated = true;
    }
    // Update other properties as needed (radius, colors, etc.)
    // If radius changes, texture might need regeneration + visual/body resizing
    // If colors change, texture might need regeneration

    // If any relevant property changed, update the config and debug text
    if (updated) {
      // Update stored config if necessary (careful with direct assignment vs merging)
      // this.config = { ...this.config, ...data }; // Example merge
      this.createDebugText(); // Recreate text to show new values
    }
  }

  // Destroy the planet's Matter body and Phaser visual
  destroy(): void {
    if (this.body) {
      this.scene.matter.world.remove(this.body);
      Logger.info(LOGGER_SOURCE, `Planet ${this.config.id} body removed.`);
    }
    if (this.visual) {
      this.visual.destroy();
      Logger.info(LOGGER_SOURCE, `Planet ${this.config.id} visual destroyed.`);
    }
    if (this.atmosphereVisual) {
      this.atmosphereVisual.destroy();
      Logger.debug(LOGGER_SOURCE, "Destroyed atmosphere visual.");
    }
    // Destroy debug text
    if (this.debugText) {
      this.debugText.destroy();
      Logger.debug(LOGGER_SOURCE, "Destroyed debug text.");
    }
    // Optional: Remove generated texture if no longer needed by any other object
    // const textureKey = `planet-tex-${this.config.id}-${this.config.seed}-${this.radius}`;
    // if (this.scene.textures.exists(textureKey)) {
    //   this.scene.textures.remove(textureKey);
    // }
    Logger.info(LOGGER_SOURCE, "Planet destroyed.");
  }
}
