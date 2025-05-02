import React, { useRef, useEffect } from "react";
import Phaser from "phaser";

// Import scenes
import BootScene from "../phaser/scenes/BootScene";
import MainMenuScene from "../phaser/scenes/MainMenuScene";
import GameScene from "../phaser/scenes/GameScene";

interface PhaserGameProps {
  // Props can be added here if needed, e.g., dimensions
}

const PhaserGame: React.FC<PhaserGameProps> = () => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (gameContainerRef.current && !gameInstanceRef.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO, // Use WebGL if available, otherwise Canvas
        parent: gameContainerRef.current, // Mount the game in the div element
        width: 800, // Example width
        height: 600, // Example height
        // Add physics config if needed
        // physics: {
        //   default: 'arcade', // or 'matter' if using Matter.js
        //   arcade: {
        //     gravity: { y: 300 },
        //     debug: false,
        //   },
        // },
        // Add scenes
        scene: [BootScene, MainMenuScene, GameScene],
        backgroundColor: "#000000", // Example background color
      };

      gameInstanceRef.current = new Phaser.Game(config);
    }

    // Cleanup function
    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true); // Destroy the game instance
        gameInstanceRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount and cleanup on unmount

  return (
    <div ref={gameContainerRef} style={{ width: "800px", height: "600px" }} />
  );
};

export default PhaserGame;
