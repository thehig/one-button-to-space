import { BasePlayer, InputData, PlayerWithInputQueue } from "../schema";

/**
 * Handle basic movement based on input
 */
export const handlePlayerMovement = (
  player: BasePlayer,
  input: InputData,
  velocity: number = 2
): void => {
  if (input.left) {
    player.x -= velocity;
  } else if (input.right) {
    player.x += velocity;
  }

  if (input.up) {
    player.y -= velocity;
  } else if (input.down) {
    player.y += velocity;
  }

  // Update tick if it exists on the player and input
  if ("tick" in player && input.tick !== undefined) {
    (player as PlayerWithInputQueue).tick = input.tick;
  }
};
