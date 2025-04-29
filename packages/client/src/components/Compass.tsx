import React, { useState, useEffect } from "react";
import { gameEmitter } from "../main"; // Import the global emitter
import Phaser from "phaser"; // Import Phaser to use its math functions

const Compass: React.FC = () => {
  const [angleDegrees, setAngleDegrees] = useState<number>(0);

  useEffect(() => {
    const handleAngleUpdate = (angleRadians: number) => {
      // Convert radians to degrees (Phaser default: 0 is right)
      let degrees = Phaser.Math.RadToDeg(angleRadians);
      // Keep the original Phaser angle convention for rotation logic
      setAngleDegrees(degrees);
    };

    const unsubscribe = gameEmitter.on("playerAngleUpdate", handleAngleUpdate);

    // Cleanup listener on component unmount
    return () => {
      unsubscribe();
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // --- Styles --- //
  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top: "10px",
    right: "10px",
    width: "40px", // Container size
    height: "40px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: "50%", // Make it circular
    zIndex: 1000,
    pointerEvents: "none",
  };

  const arrowStyle: React.CSSProperties = {
    fontSize: "24px",
    color: "#00ffcc", // Cyan arrow
    // Game angle 0 should mean UP on the HUD.
    // The ⮙ character points UP by default (0 CSS rotation).
    // Therefore, the CSS rotation should directly match the game angle.
    transform: `rotate(${angleDegrees}deg)`,
    transformOrigin: "center center",
    lineHeight: "1", // Prevent extra spacing
  };

  return (
    <div style={containerStyle}>
      {/* Using an asymmetrical UP arrowhead */}
      <div style={arrowStyle}>⮙</div>
    </div>
  );
};

export default Compass;
