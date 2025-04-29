import React, { useState, useEffect } from "react";
import { gameEmitter } from "../main"; // Import the global emitter

interface DebugData {
  fps: number;
  entityCount: number;
  playerId: string;
}

const DebugOverlay: React.FC = () => {
  const [phaserVersion, setPhaserVersion] = useState<string>("");
  const [debugData, setDebugData] = useState<DebugData | null>(null);

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

    // Cleanup listeners on component unmount
    return () => {
      unsubscribeUpdate();
      unsubscribeVersion();
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
        </>
      )}
    </div>
  );
};

export default DebugOverlay;
