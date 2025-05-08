import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";

// Schema Definitions

export class BodyState extends Schema {
  @type("string") id: string; // External ID
  @type("number") x: number;
  @type("number") y: number;
  @type("number") angle: number;

  constructor(id: string, x: number, y: number, angle: number) {
    super();
    this.id = id;
    this.x = x;
    this.y = y;
    this.angle = angle;
  }
}

export class CollisionPair extends Schema {
  @type("string") bodyAId: string; // External ID
  @type("string") bodyBId: string; // External ID

  constructor(bodyAId: string, bodyBId: string) {
    super();
    this.bodyAId = bodyAId;
    this.bodyBId = bodyBId;
  }
}

export class PhysicsSyncState extends Schema {
  @type({ map: BodyState }) bodies = new MapSchema<BodyState>();
  @type([CollisionPair]) collisionEvents = new ArraySchema<CollisionPair>();
}
