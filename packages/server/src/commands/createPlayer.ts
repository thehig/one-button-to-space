import { BasePlayer } from "../schema";

/**
 * Initialize a new player at a random position
 */
export const createPlayer = (
  mapWidth: number,
  mapHeight: number,
  PlayerClass: typeof BasePlayer = BasePlayer
): BasePlayer => {
  const player = new PlayerClass();
  player.x = Math.random() * mapWidth;
  player.y = Math.random() * mapHeight;
  return player;
};
