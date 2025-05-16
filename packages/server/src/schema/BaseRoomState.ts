import { Schema, type, MapSchema } from "@colyseus/schema";
import { BasePlayer } from "./BasePlayer";
// Base room state schema
export class BaseRoomState extends Schema {
  @type("number") mapWidth: number = 800;
  @type("number") mapHeight: number = 600;
  @type({ map: BasePlayer }) players = new MapSchema<BasePlayer>();
}
