import { Schema, type } from "@colyseus/schema";

// Base Player schema that all rooms can extend
export class BasePlayer extends Schema {
  @type("number") x: number;
  @type("number") y: number;
  @type("number") tick: number;
}
