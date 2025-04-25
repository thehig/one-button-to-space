// server/src/index.ts
import http from "http";
import express from "express";
import { Server } from "colyseus";
import { monitor } from "@colyseus/monitor"; // Optional: For monitoring dashboard
// @ts-ignore - Shared code outside rootDir, suppress TS6059 for build
import { Logger, LogLevel } from "@one-button-to-space/shared";

// Import your Room definitions
import { GameRoom } from "./rooms/GameRoom"; // Uncommented

// Set logger level to INFO
Logger.setFilters(LogLevel.INFO);

Logger.info("SERVER", "Server starting up...");
Logger.setWorldCreationTime(Date.now());

const port = Number(process.env.PORT || 2567);
const app = express();

// Allow CORS (for development - restrict in production)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // Allow all origins
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

app.use(express.json());

// Create HTTP server
const server = http.createServer(app);
// Create Colyseus Game Server instance
const gameServer = new Server({
  server: server,
});

// Define the room handlers
// Register "game_room" as the single room clients will join
gameServer.define("game_room", GameRoom); // Uncommented

// Optional: Register colyseus monitor AFTER registering your room handlers
// Access it at http://localhost:2567/colyseus
app.use("/colyseus", monitor());

// Start listening
gameServer.listen(port);
console.log(`Colyseus server listening on ws://localhost:${port}`);

// Basic GET route for health check or info
app.get("/", (req, res) => {
  res.send("Colyseus server is running.");
});
