import Phaser from "phaser";
import { GameObject } from "../core/GameObject";
import { PlanetData } from "../schema/State"; // Import server state definition
import { CollisionCategory } from "@one-button-to-space/shared"; // Assuming categories are shared

/**
 * Represents a planet GameObject on the client-side.
 */
export class Planet extends GameObject {
  public planetId: string;

  constructor(world: Phaser.Physics.Matter.World, planetData: PlanetData) {
    // --- Physics Body Configuration ---
    const bodyOptions: Phaser.Types.Physics.Matter.MatterBodyConfig = {
      label: `planet-${planetData.id}`,
      shape: { type: "circle", radius: planetData.radius },
      isStatic: true, // Planets don't move
      // collisionFilter: { // Example collision filter
      //   category: CollisionCategory.GROUND,
      //   mask: CollisionCategory.ROCKET
      // },
    };

    // --- Texture and Initial Position ---
    const textureKey = "planet_texture"; // TODO: Load this texture

    super(
      world,
      planetData.x,
      planetData.y,
      textureKey,
      undefined, // frame
      bodyOptions
    );

    this.planetId = planetData.id;

    // --- Visual Setup ---
    this.setDisplaySize(planetData.radius * 2, planetData.radius * 2);
    // TODO: Apply procedural colors/texture based on planetData.colors and planetData.seed
    try {
      const color = Phaser.Display.Color.ValueToColor(planetData.colors.base);
      this.setTint(color.color);
    } catch (e) {
      console.warn(
        `Invalid base color for planet ${planetData.id}: ${planetData.colors.base}`
      );
      this.setTint(0xffffff);
    }

    this.setIgnoreGravity(true);
    (this.body as any).gameObject = this;
  }

  /**
   * Updates the planet based on server state (usually static, but could update visuals).
   * @param state The PlanetData from the server.
   */
  public override updateFromServer(state: PlanetData): void {
    super.updateFromServer(state);
    // Update visuals if needed
    if (
      this.tintTopLeft !==
      Phaser.Display.Color.ValueToColor(state.colors.base).color
    ) {
      try {
        const color = Phaser.Display.Color.ValueToColor(state.colors.base);
        this.setTint(color.color);
      } catch (e) {
        // ignore invalid color updates
      }
    }
  }
}
