import React, { useState, useEffect } from "react";
import { Logger } from "@one-button-to-space/shared"; // Import Logger
import { useRoom } from "../colyseus"; // Import the custom hook

// Logger Source for this component
const LOGGER_SOURCE = "⚛️🌐";

// Define the server control modes (moved from DebugOverlay)
type ServerControlMode = "run" | "step" | "pause";

const NetworkOverlay: React.FC = () => {
  // Get room and network stats from context
  const { room, networkStats } = useRoom();
  // Read server mode directly from synced room state
  const serverMode = room?.state?.serverControlMode as
    | ServerControlMode
    | undefined;

  // REMOVED: State for server control mode (moved from DebugOverlay)
  // const [serverMode, setServerMode] = useState<ServerControlMode>("run");

  // Handler to send server control messages (moved from DebugOverlay)
  const handleSetServerMode = (mode: ServerControlMode) => {
    if (room) {
      room.send("setServerControlMode", mode);
      // Update local state optimistically or wait for server confirmation
      // Only update local state for 'run' and 'pause', 'step' is momentary
      // REMOVED: setServerMode(mode);
      // if (mode === 'run' || mode === 'pause') {
      //     setServerMode(mode);
      // }
      Logger.debug(LOGGER_SOURCE, `Sent server control mode: ${mode}`);
    } else {
      Logger.error(
        LOGGER_SOURCE,
        "Room not available to send server control message."
      );
    }
  };

  // REMOVED: useEffect for listening to gameEmitter for networkStatsUpdate
  // useEffect(() => { ... });

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
        pointerEvents: "none", // Allow clicks to pass through NON-INTERACTIVE parts
        minWidth: "150px", // Ensure enough width
      }}
    >
      {/* Network Stats Display */}
      <div>
        Ping: {networkStats.ping >= 0 ? `${networkStats.ping}ms` : "N/A"} ⬇️{" "}
        {networkStats.msgInPerSec.toFixed(0)}/s ⬆️{" "}
        {networkStats.msgOutPerSec.toFixed(0)}/s
      </div>
      {/* Physics Tick Display */}
      <div>Tick: {room?.state?.physicsTick ?? "N/A"}</div>

      {/* Server Control Buttons (Moved from DebugOverlay) */}
      <div
        style={{
          marginTop: "5px",
          pointerEvents: "auto", // Enable pointer events specifically for these controls
        }}
      >
        <button
          onClick={() => handleSetServerMode("run")}
          disabled={serverMode === "run" || !room} // Also disable if room not connected
          style={buttonStyle(serverMode === "run")} // Use state from context
        >
          Run
        </button>
        <button
          onClick={() => handleSetServerMode("pause")}
          disabled={serverMode === "pause" || !room} // Also disable if room not connected
          style={buttonStyle(serverMode === "pause")} // Use state from context
        >
          Pause
        </button>
        <button
          onClick={() => handleSetServerMode("step")}
          disabled={!room} // Disable step if room not connected
          style={buttonStyle(false)} // Always appear as non-active
        >
          Step
        </button>
      </div>
    </div>
  );
};

// Helper function for button styling (Moved from DebugOverlay)
const buttonStyle = (isActive: boolean): React.CSSProperties => ({
  marginLeft: "5px",
  padding: "2px 5px",
  cursor: "pointer",
  border: isActive ? "1px solid #00ff00" : "1px solid #555",
  backgroundColor: isActive ? "#336633" : "#222",
  color: "#00ff00",
});

export default NetworkOverlay;
