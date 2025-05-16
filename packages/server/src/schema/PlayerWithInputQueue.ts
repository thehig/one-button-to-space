import { type, ArraySchema } from "@colyseus/schema";
import { BasePlayer } from "./BasePlayer";
import { InputDataSchema } from "./InputDataSchema";

// Player class with input queue for rooms that need it
export class PlayerWithInputQueue extends BasePlayer {
  // @type("number") tick: number;
  @type([InputDataSchema]) inputQueue = new ArraySchema<InputDataSchema>();
}
