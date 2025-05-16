import { InputDataSchema, PlayerWithInputQueue, InputData } from "../schema";

/**
 * Add an input to a player's queue
 */
export const addToInputQueue = (
  player: PlayerWithInputQueue,
  input: InputData
): void => {
  const schemaInput = new InputDataSchema();
  schemaInput.left = input.left;
  schemaInput.right = input.right;
  schemaInput.up = input.up;
  schemaInput.down = input.down;
  schemaInput.tick = input.tick || 0;
  player.inputQueue.push(schemaInput);
};
