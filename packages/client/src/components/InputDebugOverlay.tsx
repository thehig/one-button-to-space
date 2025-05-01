import React, { useState, useEffect } from "react";
import { gameEmitter } from "../main"; // Adjust path if needed
// Import { DeviceOrientationManager } from "../utils/DeviceOrientationManager"; // Type not strictly needed as state comes via emitter

// Define the interface matching the emitted state from GameScene
interface InputDebugState {
  keysDown: string[];
  pointer1: { id: number; x: number; y: number; active: boolean };
  pointer2: { id: number; x: number; y: number; active: boolean };
  isPinching: boolean;
  pinchDistance: number;
  isThrusting: boolean;
  touchActive: boolean;
  orientation: {
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
    targetAngleRad: number | null;
  };
}

const InitialInputState: InputDebugState = {
  keysDown: [],
  pointer1: { id: -1, x: 0, y: 0, active: false },
  pointer2: { id: -1, x: 0, y: 0, active: false },
  isPinching: false,
  pinchDistance: 0,
  isThrusting: false,
  touchActive: false,
  orientation: {
    alpha: null,
    beta: null,
    gamma: null,
    targetAngleRad: null,
  },
};

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "10px",
  left: "10px",
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  color: "white",
  padding: "10px",
  borderRadius: "5px",
  fontFamily: "monospace",
  fontSize: "12px",
  zIndex: 1000,
  maxWidth: "calc(100vw - 20px)", // Prevent overflow
  maxHeight: "40vh", // Limit height
  overflowY: "auto", // Allow scrolling if needed
  whiteSpace: "pre-wrap", // Keep formatting
  pointerEvents: "none", // Allow clicks/touches to pass through
};

export const InputDebugOverlay: React.FC = () => {
  const [inputState, setInputState] =
    useState<InputDebugState>(InitialInputState);

  useEffect(() => {
    const handleStateUpdate = (newState: InputDebugState) => {
      // Direct set, as GameScene now sends the full state object
      setInputState(newState);
    };

    gameEmitter.on("inputStateUpdate", handleStateUpdate);

    return () => {
      gameEmitter.off("inputStateUpdate", handleStateUpdate);
    };
  }, []);

  const formatRad = (rad: number | null) => rad?.toFixed(2) ?? "null";
  const formatDeg = (deg: number | null) => deg?.toFixed(1) ?? "null";
  const formatPos = (pos: { x: number; y: number }) =>
    `(${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`;

  return (
    <div style={overlayStyle}>
      <b>Input Debug:</b>
      <br />
      {!inputState.touchActive && (
        <>
          Keys Down: {inputState.keysDown.join(", ") || "None"}
          <br />
        </>
      )}
      Thrusting: {inputState.isThrusting ? "YES" : "NO"}
      <br />
      {inputState.touchActive && (
        <>
          --- Touch ---
          <br />
          P1:{" "}
          {inputState.pointer1.active
            ? `Active (ID: ${inputState.pointer1.id}) @ ${formatPos(
                inputState.pointer1
              )}`
            : "Inactive"}
          <br />
          P2:{" "}
          {inputState.pointer2.active
            ? `Active (ID: ${inputState.pointer2.id}) @ ${formatPos(
                inputState.pointer2
              )}`
            : "Inactive"}
          <br />
          Pinching:{" "}
          {inputState.isPinching
            ? `YES (Dist: ${inputState.pinchDistance.toFixed(1)})`
            : "NO"}
          <br />
          --- Orientation ---
          <br />
          Alpha: {formatDeg(inputState.orientation.alpha)}
          <br />
          Beta: {formatDeg(inputState.orientation.beta)}
          <br />
          Gamma: {formatDeg(inputState.orientation.gamma)}
          <br />
          Target Angle: {formatRad(inputState.orientation.targetAngleRad)} rad
          <br />
        </>
      )}
    </div>
  );
};
