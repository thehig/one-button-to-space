import React, { createContext, useContext, useState, useEffect } from "react";
import { Room } from "colyseus.js";
import { Logger } from "@one-button-to-space/shared";
import { RoomState as GameState } from "./schema/State"; // Assuming your generated schema state is here
import { NetworkManager } from "./managers/NetworkManager";
import { gameEmitter } from "./main"; // Import gameEmitter for events
import { NetworkStats } from "./managers/NetworkManager"; // Import the interface

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

export function RoomProvider({ children }: { children: React.ReactNode }) {
  const [room, setRoom] = useState<Room<GameState> | null>(
    NetworkManager.getInstance().room
  );
  const [networkStats, setNetworkStats] =
    useState<NetworkStats>(defaultNetworkStats);

  useEffect(() => {
    // Function to update the room state
    const checkRoom = () => {
      const currentRoom = NetworkManager.getInstance().room;
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
    const unsubscribeRoomReady = gameEmitter.on("roomReady", handleRoomReady);

    // Listener for when the room is left/disconnected
    const handleRoomLeave = () => {
      Logger.debug(LOGGER_SOURCE, `RoomProvider received roomLeave event.`);
      setRoom(null);
    };
    const unsubscribeRoomLeave = gameEmitter.on("roomLeave", handleRoomLeave);

    // Initial check in case the room was already available
    checkRoom();

    // Cleanup listeners
    return () => {
      unsubscribeRoomReady();
      unsubscribeRoomLeave();
    };
  }, []); // Re-run effect if the local room state changes (might be redundant with emitter)

  useEffect(() => {
    // Listener for network stats
    const handleNetworkStatsUpdate = (stats: NetworkStats) => {
      // Logger.trace(LOGGER_SOURCE, "RoomProvider received networkStatsUpdate", stats);
      setNetworkStats(stats); // Update the context state
    };
    const unsubscribeNetworkStats = gameEmitter.on(
      "networkStatsUpdate",
      handleNetworkStatsUpdate
    );

    return () => {
      unsubscribeNetworkStats();
    };
  }, []); // Run only once

  return (
    <RoomContext.Provider value={{ room, networkStats }}>
      {children}
    </RoomContext.Provider>
  );
}
