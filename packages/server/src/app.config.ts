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
    Object.entries(routes(gameServerRef)).forEach(([key, value]) => {
      app.use(key, value);
    });
  },

  beforeListen: () => {
    /**
     * Before before gameServer.listen() is called.
     */
  },
});
