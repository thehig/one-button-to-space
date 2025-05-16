import { InputData, InputDataSchema, PlayerWithInputQueue } from "../schema";
import { handlePlayerMovement } from "./handlePlayerMovement";

/**
 * Process the input queue for a player
 */
export const processInputQueue = (
  player: PlayerWithInputQueue,
  velocity: number = 2
): void => {
  let input: InputDataSchema;
  while ((input = player.inputQueue.shift())) {
    // Convert schema to plain InputData
    const plainInput: InputData = {
      left: input.left,
      right: input.right,
      up: input.up,
      down: input.down,
      tick: input.tick,
    };
    handlePlayerMovement(player, plainInput, velocity);
  }
};
