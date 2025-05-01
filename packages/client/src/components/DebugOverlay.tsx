import React, { useState, useEffect } from "react";
import { gameEmitter } from "../main"; // Import the global emitter
import { NetworkStats } from "../managers/NetworkManager"; // Import the interface
import { Logger } from "@one-button-to-space/shared"; // Import Logger

// Logger Source for this component
const LOGGER_SOURCE = "⚛️📊";

interface DebugData {
  fps: number;
  entityCount: number;
  playerId: string;
  x?: number; // Add optional x coordinate
  y?: number; // Add optional y coordinate
  speed?: number; // Add optional speed
}

const DebugOverlay: React.FC = () => {
  const [phaserVersion, setPhaserVersion] = useState<string>("");
  const [debugData, setDebugData] = useState<DebugData | null>(null);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    ping: -1,
    msgInPerSec: 0,
    msgOutPerSec: 0,
  });

  useEffect(() => {
    // Listener for continuous updates
    const handleDebugUpdate = (data: DebugData) => {
      setDebugData(data);
    };
    const unsubscribeUpdate = gameEmitter.on("debugUpdate", handleDebugUpdate);

    // Listener for one-time Phaser version
    const handlePhaserVersion = (version: string) => {
      setPhaserVersion(version);
    };
    // Use 'once' if you are sure it's emitted only once, otherwise 'on'
    const unsubscribeVersion = gameEmitter.on(
      "phaserVersion",
      handlePhaserVersion
    );

    // Listener for continuous network stats updates
    const handleNetworkStatsUpdate = (stats: NetworkStats) => {
      Logger.debug(
        LOGGER_SOURCE,
        "Received networkStatsUpdate",
        `${stats.ping}ms`,
        `In/s: ${stats.msgInPerSec.toFixed(0)}`,
        `Out/s: ${stats.msgOutPerSec.toFixed(0)}`
      ); // Use Logger.debug
      setNetworkStats(stats); // Add this line back to update the state
    };
    const unsubscribeNetworkStats = gameEmitter.on(
      "networkStatsUpdate",
      handleNetworkStatsUpdate
    );

    // Cleanup listeners on component unmount
    return () => {
      unsubscribeUpdate();
      unsubscribeVersion();
      unsubscribeNetworkStats();
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  if (!debugData && !phaserVersion) {
    // Optionally render nothing or a loading state until data arrives
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        left: "10px",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        color: "#00ff00",
        padding: "5px 10px",
        fontFamily: "Arial, sans-serif",
        fontSize: "14px",
        borderRadius: "3px",
        zIndex: 1000, // Ensure it's above the Phaser canvas
        pointerEvents: "none", // Allow clicks to pass through
      }}
    >
      {phaserVersion && <div>Phaser: {phaserVersion}</div>}
      {debugData && (
        <>
          <div>FPS: {debugData.fps.toFixed(2)}</div>
          <div>Entities: {debugData.entityCount}</div>
          <div>Player ID: {debugData.playerId}</div>
          {debugData.x !== undefined && debugData.y !== undefined && (
            <div>
              Pos: {debugData.x.toFixed(1)}, {debugData.y.toFixed(1)}
            </div>
          )}
          {debugData.speed !== undefined && (
            <div>Speed: {debugData.speed.toFixed(2)}</div>
          )}
        </>
      )}
      <div>
        Ping: {networkStats.ping >= 0 ? `${networkStats.ping}ms` : "N/A"} ⬇️{" "}
        {networkStats.msgInPerSec.toFixed(0)}/s ⬆️{" "}
        {networkStats.msgOutPerSec.toFixed(0)}/s
      </div>
    </div>
  );
};

export default DebugOverlay;
