import React, { createContext, useContext, useState, useEffect } from "react";
import { Room } from "colyseus.js";
import { Logger } from "@one-button-to-space/shared";
import { RoomState as GameState } from "./schema/State"; // Assuming your generated schema state is here
import { gameEmitter } from "./main"; // Import gameEmitter for events
import { NetworkStats } from "./managers/NetworkManager"; // Import the interface
import { EngineManager } from "./managers/EngineManager"; // Import EngineManager type

const LOGGER_SOURCE = "⚛️ ColyseusContext";

interface RoomContextType {
  room: Room<GameState> | null;
  // Add other relevant states if needed, e.g., connection status from NetworkManager
  networkStats: NetworkStats;
}

const defaultNetworkStats: NetworkStats = {
  ping: -1,
  msgInPerSec: 0,
  msgOutPerSec: 0,
};

const RoomContext = createContext<RoomContextType>({
  room: null,
  networkStats: defaultNetworkStats,
});

export function useRoom() {
  return useContext(RoomContext);
}

// Define props for RoomProvider to accept EngineManager
interface RoomProviderProps {
  children: React.ReactNode;
  engineManager: EngineManager;
}

export function RoomProvider({ children, engineManager }: RoomProviderProps) {
  // Access NetworkManager via the passed EngineManager prop
  const networkManager = engineManager.getNetworkManager();

  // Initialize state based on the current room from the NetworkManager instance
  const [room, setRoom] = useState<Room<GameState> | null>(
    networkManager.currentRoom
  );
  const [networkStats, setNetworkStats] =
    useState<NetworkStats>(defaultNetworkStats);

  useEffect(() => {
    // Function to update the room state
    const checkRoom = () => {
      // Access the manager instance passed via props
      const currentRoom = networkManager.currentRoom;
      if (currentRoom !== room) {
        Logger.debug(
          LOGGER_SOURCE,
          `RoomProvider detected room change: ${currentRoom?.roomId}`
        );
        setRoom(currentRoom);
      }
    };

    // Listener for when the room is ready (emitted by NetworkManager)
    const handleRoomReady = (roomInstance: Room<GameState>) => {
      Logger.debug(
        LOGGER_SOURCE,
        `RoomProvider received roomReady event: ${roomInstance?.roomId}`
      );
      setRoom(roomInstance);
    };
    // Ensure gameEmitter is defined before subscribing
    const unsubscribeRoomReady = gameEmitter?.on("roomReady", handleRoomReady);

    // Listener for when the room is left/disconnected
    const handleRoomLeave = () => {
      Logger.debug(LOGGER_SOURCE, `RoomProvider received roomLeave event.`);
      setRoom(null);
    };
    const unsubscribeRoomLeave = gameEmitter?.on("roomLeave", handleRoomLeave);

    // Initial check in case the room was already available
    checkRoom();

    // Cleanup listeners
    return () => {
      unsubscribeRoomReady?.(); // Call only if subscription was successful
      unsubscribeRoomLeave?.(); // Call only if subscription was successful
    };
    // Dependency array includes networkManager instance to re-run if it changes (e.g., HMR)
  }, [networkManager, room]);

  useEffect(() => {
    // Listener for network stats
    const handleNetworkStatsUpdate = (stats: NetworkStats) => {
      // Logger.trace(LOGGER_SOURCE, "RoomProvider received networkStatsUpdate", stats);
      setNetworkStats(stats); // Update the context state
    };
    // Use the correct event name ("networkStats")
    const unsubscribeNetworkStats = gameEmitter?.on(
      "networkStats",
      handleNetworkStatsUpdate
    );

    return () => {
      unsubscribeNetworkStats?.();
    };
    // Run only once (or add dependencies if needed)
  }, []);

  return (
    <RoomContext.Provider value={{ room, networkStats }}>
      {children}
    </RoomContext.Provider>
  );
}
