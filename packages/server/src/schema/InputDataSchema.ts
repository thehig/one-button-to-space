import { Schema, type } from "@colyseus/schema";

// Schema for InputData to use in ArraySchema
export class InputDataSchema extends Schema {
  @type("boolean") left: boolean;
  @type("boolean") right: boolean;
  @type("boolean") up: boolean;
  @type("boolean") down: boolean;
  @type("number") tick: number;
}
