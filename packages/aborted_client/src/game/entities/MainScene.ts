  // --- Planet Handlers ---

  private handlePlanetAdd = (
    planetId: string,
    planetData: PlanetData
  ): void => {
    Logger.debug(LOGGER_SOURCE, `Handling add for planet ${planetId}`);
    Logger.debug(LOGGER_SOURCE, "Received PlanetData:", JSON.stringify(planetData)); // Log received data structure

    if (this.findGameObjectByName(`Planet_${planetId}`)) {
      Logger.warn(
        LOGGER_SOURCE,
        `GameObject for planet ${planetId} already exists. Ignoring add event.`
      );
      return;
    }

    // --- CORRECT MAPPING from PlanetData (Schema) to PlanetConfig (Interface) ---
    const planetConfig: PlanetConfig = {
      id: planetId,
      x: planetData.x,
      y: planetData.y,
      radius: planetData.radius,
      mass: planetData.mass,
      texture: planetData.texture, // Assuming texture is a simple string now
      surfaceDensity: planetData.surfaceDensity,
      atmosphereHeight: planetData.atmosphereHeight,
      seed: planetData.seed,
      // Map nested schema classes to plain objects
      colors: {
        base: planetData.colors.base,
        accent1: planetData.colors.accent1,
        accent2: planetData.colors.accent2,
      },
      noiseParams: {
        scale: planetData.noiseParams.scale,
        octaves: planetData.noiseParams.octaves,
      },
    };
    // -----------------------------------------------------------------------

    Logger.info(
      LOGGER_SOURCE,
      `Creating Planet GameObject for ${planetId} at (${planetConfig.x.toFixed( // Use planetConfig here
        1
      )}, ${planetConfig.y.toFixed(1)})` // Use planetConfig here
    );

    // Create the Planet GameObject using the correctly mapped config
    const newPlanet = new Planet(this, planetConfig);
  } 