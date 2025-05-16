import config from "@colyseus/tools";
import { Server } from "@colyseus/core";
import rooms from "./rooms";
import routes from "./routes/routes";

let gameServerRef: Server;

export default config({
  options: {
    // devMode: true,
  },

  /**
   * Import the room names and handlers from `./rooms`
   */
  initializeGameServer: (gameServer) => {
    Object.entries(rooms).forEach(([key, value]) => {
      gameServer.define(key, value);
    });

    // keep gameServer reference, so we can
    // call `.simulateLatency()` later through an http route
    //
    gameServerRef = gameServer;
  },

  /**
   * Import the routes from `./routes/routes`
   */
  initializeExpress: (app) => {
    const setupRoutes = () => {
      if (!gameServerRef) {
        // Try again after a delay if gameServerRef isn't set yet
        setTimeout(setupRoutes, 100);
        return;
      }

      try {
        const appRoutes = routes(gameServerRef);
        Object.entries(appRoutes).forEach(([key, value]) => {
          app.use(key, value);
        });
      } catch (error) {
        console.error("Error setting up routes:", error);
        // Try again after a longer delay if there was an error
        setTimeout(setupRoutes, 500);
      }
    };

    // Start the setup process
    setupRoutes();
  },

  beforeListen: () => {
    /**
     * Before before gameServer.listen() is called.
     */
  },
});
