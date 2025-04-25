import { Body as MatterBody, Vector as MatterVector } from "matter-js";
// @ts-ignore - Allow importing from potentially outside rootDir
import { Planet } from "@game/entities/Planet"; // Assuming Planet needs to be imported
// @ts-ignore - Allow importing from potentially outside rootDir
import { G, DRAG_COEFFICIENT } from "./Constants";

// Define a simplified structure for gravity sources for the shared function
interface SimpleGravitySource {
  position: { x: number; y: number };
  mass: number;
}

/**
 * Contains static methods for shared physics calculations (gravity, air resistance).
 */
export class PhysicsLogic {
  /**
   * Calculates and applies gravitational forces to a target body from multiple sources.
   * @param targetBody The Matter.js body to apply force to.
   * @param gravitySources An array of objects with position and mass.
   */
  public static calculateAndApplyGravity(
    targetBody: MatterBody,
    gravitySources: SimpleGravitySource[]
  ): void {
    // TODO: Move logic from PhysicsManager.applyCustomGravity here
    // Use the imported G constant
    const targetPosition = targetBody.position;

    gravitySources.forEach((source) => {
      const sourcePosition = source.position;
      const dx = sourcePosition.x - targetPosition.x;
      const dy = sourcePosition.y - targetPosition.y;
      const distanceSq = dx * dx + dy * dy;
      const minDistanceSq = 100; // Prevent extreme forces close up
      if (distanceSq < minDistanceSq) return;

      const distance = Math.sqrt(distanceSq);
      const forceMagnitude = (G * source.mass * targetBody.mass) / distanceSq;
      const forceX = (dx / distance) * forceMagnitude;
      const forceY = (dy / distance) * forceMagnitude;

      MatterBody.applyForce(targetBody, targetPosition, {
        x: forceX,
        y: forceY,
      });
    });
  }

  /**
   * Calculates and applies air resistance to a target body based on ambient density.
   * @param targetBody The Matter.js body to apply force to.
   * @param densityAtTarget The ambient density at the target body's position.
   */
  public static calculateAndApplyAirResistance(
    targetBody: MatterBody,
    densityAtTarget: number
  ): void {
    // TODO: Move logic from PhysicsManager.applyAirResistance here
    // Use the imported DRAG_COEFFICIENT
    const velocity = targetBody.velocity;
    const speedSq = velocity.x * velocity.x + velocity.y * velocity.y;

    if (speedSq === 0 || densityAtTarget <= 0.001) {
      return;
    }

    const speed = Math.sqrt(speedSq);
    if (speed < 0.01) return; // No drag if moving very slowly

    // Calculate drag force (F_drag = -C * density * v * |v|)
    const dragMagnitude = DRAG_COEFFICIENT * densityAtTarget * speed * speed;

    // Force vector opposite to velocity vector
    const dragForceX = (-velocity.x / speed) * dragMagnitude;
    const dragForceY = (-velocity.y / speed) * dragMagnitude;

    MatterBody.applyForce(targetBody, targetBody.position, {
      x: dragForceX,
      y: dragForceY,
    });
  }

  /**
   * Calculates the maximum atmospheric density at a given position based on a collection of planets.
   * @param position The world position {x, y} to check.
   * @param planets An iterable collection (e.g., Array, Map values) of planet-like objects.
   * Each object must have: x, y, radius, atmosphereHeight (optional), surfaceDensity (optional).
   * @returns The calculated maximum atmospheric density at the position.
   */
  public static calculateDensityAt(
    position: { x: number; y: number },
    planets: Iterable<{
      x: number;
      y: number;
      radius: number;
      atmosphereHeight?: number;
      surfaceDensity?: number;
    }>
  ): number {
    let maxDensity = 0;
    for (const planetData of planets) {
      const atmosphereHeight = planetData.atmosphereHeight ?? 0;
      const surfaceDensity = planetData.surfaceDensity ?? 0;

      if (atmosphereHeight <= 0 || surfaceDensity <= 0) {
        continue; // Skip planets with no atmosphere
      }

      const dx = position.x - planetData.x;
      const dy = position.y - planetData.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const altitude = distance - planetData.radius;

      if (altitude >= 0 && altitude <= atmosphereHeight) {
        // Linear falloff for density based on altitude
        const density = surfaceDensity * (1 - altitude / atmosphereHeight);
        maxDensity = Math.max(maxDensity, Math.max(0, density)); // Ensure density isn't negative
      }
    }
    return maxDensity;
  }
}
