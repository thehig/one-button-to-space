import React, { useState, useEffect } from "react";
import { gameEmitter } from "../main"; // Import the global emitter
import { NetworkStats } from "../managers/NetworkManager"; // Import the interface
import { Logger } from "@one-button-to-space/shared"; // Import Logger

// Logger Source for this component
const LOGGER_SOURCE = "⚛️🌐";

const NetworkOverlay: React.FC = () => {
  // Initialize with default values
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    ping: -1,
    msgInPerSec: 0,
    msgOutPerSec: 0,
  });

  useEffect(() => {
    // Listener for continuous network stats updates
    const handleNetworkStatsUpdate = (stats: NetworkStats) => {
      Logger.debug(
        LOGGER_SOURCE,
        "Received networkStatsUpdate",
        `${stats.ping}ms`,
        `In/s: ${stats.msgInPerSec.toFixed(0)}`,
        `Out/s: ${stats.msgOutPerSec.toFixed(0)}`
      ); // Use Logger.debug
      setNetworkStats(stats); // Update the state
    };
    const unsubscribeNetworkStats = gameEmitter.on(
      "networkStatsUpdate",
      handleNetworkStatsUpdate
    );

    // Cleanup listener on component unmount
    return () => {
      unsubscribeNetworkStats();
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  return (
    <div
      style={{
        position: "fixed",
        bottom: "10px", // Position at bottom
        right: "10px", // Position at right
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "#00ff00", // Green text like DebugOverlay
        padding: "5px 10px",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        borderRadius: "3px",
        zIndex: 1000, // Ensure it's above the Phaser canvas
        pointerEvents: "none", // Allow clicks to pass through
        minWidth: "150px", // Ensure enough width
      }}
    >
      <div>
        Ping: {networkStats.ping >= 0 ? `${networkStats.ping}ms` : "N/A"} ⬇️{" "}
        {networkStats.msgInPerSec.toFixed(0)}/s ⬆️{" "}
        {networkStats.msgOutPerSec.toFixed(0)}/s
      </div>
    </div>
  );
};

export default NetworkOverlay;
