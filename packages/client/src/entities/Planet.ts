import Phaser from "phaser";
import { GameObject } from "../core/GameObject";
import { PlanetData } from "../schema/State"; // Import server state definition
import { CollisionCategory } from "@one-button-to-space/shared"; // Assuming categories are shared
import { Logger } from "@one-button-to-space/shared"; // Import Logger
import { createNoise2D } from "simplex-noise"; // Import noise library

// Logger Source for this file
const LOGGER_SOURCE = "🪐🌍";

// Simple seeded PRNG (Mulberry32) - Moved from old client
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

/**
 * Represents a planet GameObject on the client-side.
 */
export class Planet extends GameObject {
  public planetId: string;
  private planetData: PlanetData; // Store planet data for texture gen
  private atmosphereVisual: Phaser.GameObjects.Graphics | null = null; // Added for atmosphere

  constructor(world: Phaser.Physics.Matter.World, planetData: PlanetData) {
    // --- Generate Texture Key FIRST (before super call) ---
    // Note: This assumes PlanetData includes 'seed' and 'noiseParams.scale'
    // We need to generate the key here, but the full texture generation
    // happens *after* super() when `this.world` is available.
    const textureKey = Planet.getTextureKey(planetData); // Use static method

    // --- Physics Body Configuration ---
    const bodyOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      label: `planet-${planetData.id}`,
      shape: { type: "circle", radius: planetData.radius },
      isStatic: true, // Planets don't move
      collisionFilter: {
        // Add default collision
        category: CollisionCategory.GROUND,
        mask: CollisionCategory.ROCKET,
      },
      // Assign data to body plugin for potential future use (e.g., atmosphere)
      plugin: {
        planetData: planetData,
      },
    };

    // --- Initialize GameObject ---
    super(
      world,
      planetData.x,
      planetData.y,
      textureKey, // Use the generated texture key (might be placeholder initially)
      undefined, // frame
      bodyOptions
    );

    // Store planetData AFTER super call
    this.planetData = planetData;
    this.planetId = planetData.id;

    // --- Generate Full Texture NOW (after super) ---
    this.ensureTextureGenerated();

    // --- Create Atmosphere Visual ---
    this.createAtmosphereVisual();

    // --- Visual Setup ---
    this.setDisplaySize(planetData.radius * 2, planetData.radius * 2);
    // Remove old setTint logic, texture is now procedural
    // try {
    //   const color = Phaser.Display.Color.ValueToColor(planetData.colors.base);
    //   this.setTint(color.color);
    // } catch (e) {
    //   Logger.warn(
    //     LOGGER_SOURCE,
    //     `Invalid base color for planet ${planetData.id}: ${planetData.colors.base}`,
    //     e
    //   );
    //   this.setTint(0xffffff);
    // }

    this.setIgnoreGravity(true);
    // Assign the GameObject instance to the Matter body for back-reference
    // Use `any` for now if the exact Matter plugin structure isn't defined/typed
    (this.body as any).gameObject = this;
    Logger.info(
      LOGGER_SOURCE,
      `Planet ${this.planetId} created at (${planetData.x.toFixed(
        0
      )}, ${planetData.y.toFixed(0)}) with texture ${textureKey}`
    );
  }

  // Static method to calculate texture key without needing `this`
  private static getTextureKey(planetData: PlanetData): string {
    const { id, seed, radius, colors, noiseParams } = planetData;
    const safeSeed = seed ?? `planet_${id}`;
    const safeNoiseScale = noiseParams?.scale ?? 0.05;
    const safeRadius = radius > 0 ? radius : 10;
    // Simplified key for initial load, full generation checks later
    return `planet-tex-${id}-${safeSeed}-${safeRadius}-${safeNoiseScale}-${
      colors.base
    }-${colors.accent1 ?? ""}`;
  }

  // Ensures the texture is generated if it doesn't exist
  private ensureTextureGenerated(): void {
    const textureKey = Planet.getTextureKey(this.planetData);
    if (!this.world.scene.textures.exists(textureKey)) {
      this.generateTexture(textureKey); // Pass the key
    }
    // Set the texture on the sprite, in case the initial key was a placeholder
    // or if texture generation failed initially and we fell back.
    if (
      this.texture.key !== textureKey &&
      this.world.scene.textures.exists(textureKey)
    ) {
      this.setTexture(textureKey);
    }
  }

  /**
   * Generates a procedural texture for the planet based on its config.
   * Adds the texture to the scene's texture manager.
   * @param textureKey The unique key for the texture.
   */
  private generateTexture(textureKey: string): void {
    // Now uses this.planetData directly
    const { id, seed, radius, colors, noiseParams } = this.planetData;
    const safeSeed = seed ?? `planet_${id}`;
    const safeNoiseScale = noiseParams?.scale ?? 0.05;
    const safeRadius = radius > 0 ? radius : 10;

    // Texture existence check moved to ensureTextureGenerated

    Logger.debug(
      LOGGER_SOURCE,
      `Generating texture ${textureKey} for planet ${id}...`
    );

    const diameter = Math.ceil(safeRadius * 2);
    // Create a canvas texture using the scene from the world object
    const canvasTexture = this.world.scene.textures.createCanvas(
      textureKey,
      diameter,
      diameter
    );
    if (!canvasTexture) {
      Logger.error(
        LOGGER_SOURCE,
        `Failed to create canvas texture ${textureKey} for planet ${id}`
      );
      return; // Return void now
    }
    const context = canvasTexture.getContext();
    const imageData = context.createImageData(diameter, diameter);
    const data = imageData.data;

    // Initialize noise generator with seed
    const seededRandom = mulberry32(safeSeed);
    const noise2D = createNoise2D(seededRandom);

    // Safely parse colors with fallbacks
    let baseColor: Phaser.Display.Color;
    try {
      baseColor = Phaser.Display.Color.ValueToColor(colors.base);
    } catch {
      Logger.warn(
        LOGGER_SOURCE,
        `Invalid base color: ${colors.base}, using white`
      );
      baseColor = Phaser.Display.Color.ValueToColor("#FFFFFF");
    }

    let accentColor1: Phaser.Display.Color;
    if (colors.accent1) {
      try {
        accentColor1 = Phaser.Display.Color.ValueToColor(colors.accent1);
      } catch {
        Logger.warn(
          LOGGER_SOURCE,
          `Invalid accent1 color: ${colors.accent1}, using base color`
        );
        accentColor1 = baseColor;
      }
    } else {
      accentColor1 = baseColor; // Use base if accent1 is missing
    }

    const scale = safeNoiseScale <= 0 ? 0.01 : safeNoiseScale;

    // Generate pixel data
    for (let y = 0; y < diameter; y++) {
      for (let x = 0; x < diameter; x++) {
        const index = (y * diameter + x) * 4;

        // Map canvas coords to circle coords relative to center
        const dx = x - safeRadius;
        const dy = y - safeRadius;
        const distSq = dx * dx + dy * dy;

        // Check if the pixel is inside the planet's circle
        if (distSq <= safeRadius * safeRadius) {
          // Calculate noise value
          const nx = (x / diameter) * scale;
          const ny = (y / diameter) * scale;
          const noiseValue = (noise2D(nx, ny) + 1) / 2; // Normalize noise to 0-1

          // Interpolate between base and accent color
          const lerpedColor = Phaser.Display.Color.Interpolate.ColorWithColor(
            baseColor,
            accentColor1,
            100,
            Math.floor(noiseValue * 100)
          );

          data[index] = lerpedColor.r;
          data[index + 1] = lerpedColor.g;
          data[index + 2] = lerpedColor.b;
          data[index + 3] = 255; // Fully opaque
        } else {
          // Outside the circle - transparent
          data[index + 3] = 0; // Alpha
        }
      }
    }

    // Put the generated data onto the canvas
    context.putImageData(imageData, 0, 0);

    // Refresh the canvas texture
    canvasTexture.refresh();

    Logger.info(
      LOGGER_SOURCE,
      `Texture ${textureKey} generated successfully for planet ${id}.`
    );
  }

  // Method to create/update atmosphere visual - adapted from old client
  private createAtmosphereVisual(): void {
    // Clear previous visual if it exists
    this.atmosphereVisual?.destroy();
    this.atmosphereVisual = null;

    // Get necessary data, providing defaults if missing
    const radius = this.planetData.radius > 0 ? this.planetData.radius : 10;
    const atmosphereHeight = this.planetData.atmosphereHeight ?? 0; // Default to 0 if missing
    const surfaceDensity = this.planetData.surfaceDensity ?? 0; // Default to 0 if missing

    // Only draw if atmosphere exists and has positive height/density
    if (atmosphereHeight > 0 && surfaceDensity > 0) {
      // Use this.scene directly as it's inherited from GameObject
      this.atmosphereVisual = this.scene.add.graphics();

      const numSteps = 10; // Number of concentric circles
      const maxAlpha = 0.2; // Max visual alpha accumulation
      const alphaPerStep = maxAlpha / numSteps;

      // Draw circles from outermost to innermost
      for (let i = numSteps; i >= 1; i--) {
        const stepRadius = radius + (atmosphereHeight * i) / numSteps;
        this.atmosphereVisual.fillStyle(0x0000ff, alphaPerStep); // Blue tint for atmosphere
        this.atmosphereVisual.fillCircle(0, 0, stepRadius);
      }

      // Position the graphics object at the planet's center
      // GameObject position is already at the center
      this.atmosphereVisual.setPosition(this.x, this.y);
      // Draw behind the main planet visual (Sprite)
      this.atmosphereVisual.setDepth(this.depth - 1);

      Logger.debug(
        LOGGER_SOURCE,
        `Atmosphere visual created for planet ${this.planetId}`
      );
    } else {
      this.atmosphereVisual = null; // Ensure it's null if no atmosphere
    }
  }

  /**
   * Updates the planet based on server state (usually static, but could update visuals).
   * @param state The PlanetData from the server.
   */
  public override updateFromServer(state: PlanetData): void {
    super.updateFromServer(state);
    // Store latest data
    this.planetData = state;

    // Check if atmosphere properties changed significantly
    const needsAtmosUpdate = this.didAtmosphereChange(state);
    if (needsAtmosUpdate) {
      this.createAtmosphereVisual();
    }

    // Visuals are handled by texture generation on creation.
    // If planet properties that affect the texture (radius, seed, colors, noise)
    // can change dynamically, we might need to regenerate the texture here.
    // For now, assume they are static after creation.
    // Remove the old tint update logic:
    // if (
    //   this.tintTopLeft !==
    //   Phaser.Display.Color.ValueToColor(state.colors.base).color
    // ) {
    //   try {
    //     const color = Phaser.Display.Color.ValueToColor(state.colors.base);
    //     this.setTint(color.color);
    //   } catch (e) {
    //     // ignore invalid color updates
    //   }
    // }
  }

  // Helper to check if relevant atmosphere properties changed
  private didAtmosphereChange(newState: PlanetData): boolean {
    // Compare key properties that define the atmosphere visual
    const oldHeight = this.planetData.atmosphereHeight ?? 0;
    const newHeight = newState.atmosphereHeight ?? 0;
    const oldDensity = this.planetData.surfaceDensity ?? 0;
    const newDensity = newState.surfaceDensity ?? 0;
    const oldRadius = this.planetData.radius;
    const newRadius = newState.radius;

    return (
      oldHeight !== newHeight ||
      oldDensity !== newDensity ||
      oldRadius !== newRadius
    );
  }

  // Override destroy to clean up atmosphere visual
  public override destroy(fromScene?: boolean): void {
    if (this.atmosphereVisual) {
      this.atmosphereVisual.destroy();
      this.atmosphereVisual = null;
      Logger.trace(
        LOGGER_SOURCE,
        `Destroyed atmosphere visual for planet ${this.planetId}.`
      );
    }
    super.destroy(fromScene);
  }
}
