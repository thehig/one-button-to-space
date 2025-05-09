import { Boot } from "./scenes/Boot";
import { GameOver } from "./scenes/GameOver";
import { Game as MainGame } from "./scenes/Game";
import { MainMenu } from "./scenes/MainMenu";
import { AUTO, Game } from "phaser";
import { Preloader } from "./scenes/Preloader";

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Phaser.Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  parent: "game-container",
  backgroundColor: "#028af8",
  physics: {
    default: "matter",
    matter: {
      // debug: true, // Optional: enable debug drawing
      gravity: { x: 0, y: 1 }, // Set a default gravity
      // bounds: { // Explicitly set world bounds here
      //   x: 0,
      //   y: 0,
      //   width: 1024, // Match game width
      //   height: 768, // Match game height
      //   thickness: 60 // Thickness of the boundary walls if created automatically by bounds
      // }
      // For now, let's rely on scene-level setBounds, but keep gravity here.
    },
  },
  scene: [Boot, Preloader, MainMenu, MainGame, GameOver],
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};

export default StartGame;
