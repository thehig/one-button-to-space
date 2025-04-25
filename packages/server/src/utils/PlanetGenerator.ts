import { PlanetData, PlanetColors, NoiseParams } from "../schema/State";

// Simple seeded PRNG (Mulberry32) - From client Planet.ts
function mulberry32(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Helper to generate a random number within a range using the PRNG
function randomInRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

// Helper to generate a hex color string from PRNG
function randomHexColor(rng: () => number): string {
  // Generate random R, G, B values, ensuring some brightness
  const r = Math.floor(randomInRange(rng, 50, 256));
  const g = Math.floor(randomInRange(rng, 50, 256));
  const b = Math.floor(randomInRange(rng, 50, 256));
  // Convert to hex string
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Generates deterministic planet properties (excluding position) based on a name/seed.
 * Populates and returns a PlanetData schema instance.
 * @param name The unique name of the planet, used as the seed.
 * @returns A PlanetData schema instance with generated properties (x/y will be defaults).
 */
export function generatePlanetDataFromName(name: string): PlanetData {
  const rng = mulberry32(name); // Seed the PRNG with the planet name

  // Define generation ranges
  const MIN_RADIUS = 150;
  const MAX_RADIUS = 2000;
  const MIN_MASS_PER_RADIUS = 1.5;
  const MAX_MASS_PER_RADIUS = 4.0;
  const MIN_ATMOSPHERE_RATIO = 0.1;
  const MAX_ATMOSPHERE_RATIO = 0.4;
  const MIN_SURFACE_DENSITY = 0.5;
  const MAX_SURFACE_DENSITY = 1.2;
  const MIN_NOISE_SCALE = 4;
  const MAX_NOISE_SCALE = 15;

  // Create a PlanetData instance to populate
  const generatedData = new PlanetData();

  // Generate and assign properties directly to the instance
  generatedData.radius = Math.round(randomInRange(rng, MIN_RADIUS, MAX_RADIUS));
  generatedData.mass = Math.round(
    generatedData.radius *
      randomInRange(rng, MIN_MASS_PER_RADIUS, MAX_MASS_PER_RADIUS)
  );
  generatedData.atmosphereHeight = Math.round(
    generatedData.radius *
      randomInRange(rng, MIN_ATMOSPHERE_RATIO, MAX_ATMOSPHERE_RATIO)
  );
  generatedData.surfaceDensity = parseFloat(
    randomInRange(rng, MIN_SURFACE_DENSITY, MAX_SURFACE_DENSITY).toFixed(2)
  );
  generatedData.seed = name; // Use the input name as the seed identifier

  // Assign to nested schema properties
  generatedData.colors.base = randomHexColor(rng);
  generatedData.colors.accent1 = randomHexColor(rng);
  // generatedData.colors.accent2 = randomHexColor(rng); // Optional

  generatedData.noiseParams.scale = Math.round(
    randomInRange(rng, MIN_NOISE_SCALE, MAX_NOISE_SCALE)
  );
  // generatedData.noiseParams.octaves = Math.round(randomInRange(rng, 1, 3)); // Optional

  // Note: x and y will have their default values from the PlanetData schema (usually 0)
  return generatedData;
}
