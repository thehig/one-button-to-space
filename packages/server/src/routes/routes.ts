import { Server } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";

import { Request, Response } from "express";

// This variable will hold the Server instance once it's received
let gameServerRef: Server;
let latencySimulationMs: number = 0;

const routes = (_gameServerRef: Server) => {
  // Store the provided reference instead of throwing an error
  gameServerRef = _gameServerRef;

  return {
    "/hello": (req: Request, res: Response) => {
      res.send("It's time to kick ass and chew bubblegum!");
    },
    "/latency": (req: Request, res: Response) => {
      res.json(latencySimulationMs);
    },
    "/simulate-latency/:milliseconds": (req: Request, res: Response) => {
      latencySimulationMs = parseInt(req.params.milliseconds || "100");

      // enable latency simulation
      gameServerRef.simulateLatency(latencySimulationMs);

      res.json({ success: true });
    },

    "/": playground(),
    "/colyseus": monitor(),
  };
};

export default routes;
