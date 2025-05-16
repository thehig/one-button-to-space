import { Client } from "colyseus";
import { MapSchema } from "@colyseus/schema";

import { BaseRoom } from "./BaseRoom";
import { BaseRoomState, InputData, PlayerWithInputQueue } from "../schema";
import { addToInputQueue, processInputQueue, createPlayer } from "../commands";

export class Part3RoomState extends BaseRoomState {
  // Override the players property to specify PlayerWithInputQueue
  players = new MapSchema<PlayerWithInputQueue>();
}

export class Part3Room extends BaseRoom<Part3RoomState> {
  state = new Part3RoomState();
  fixedTimeStep = 1000 / 60;

  onCreate(options: any) {
    super.onCreate(options);

    this.onMessage(0, (client, input: InputData) => {
      // handle player input
      const player = this.state.players.get(client.sessionId);

      // enqueue input to user input buffer using helper method
      addToInputQueue(player, input);
    });

    this.setSimulationInterval((deltaTime) => {
      this.update(deltaTime);
    });
  }

  update(deltaTime: number) {
    this.state.players.forEach((player) => {
      // All players are PlayerWithInputQueue type, no need for instanceof check
      processInputQueue(player);
    });
  }

  onJoin(client: Client, options: any) {
    super.onJoin(client, options);

    // Create player with input queue capabilities
    const player = createPlayer(
      this.state.mapWidth,
      this.state.mapHeight,
      PlayerWithInputQueue
    ) as PlayerWithInputQueue;

    this.state.players.set(client.sessionId, player);
  }
}
