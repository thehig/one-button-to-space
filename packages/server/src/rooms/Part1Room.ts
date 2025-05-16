import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { BaseRoomState, InputData } from "../schema";
import { handlePlayerMovement, createPlayer } from "../commands";

export class Part1Room extends BaseRoom<BaseRoomState> {
  state = new BaseRoomState();

  onCreate(options: any) {
    super.onCreate(options);

    // handle player input
    this.onMessage(0, (client, input: InputData) => {
      const player = this.state.players.get(client.sessionId);
      // Use roomUtils for player movement but keep the same behavior
      handlePlayerMovement(player, input);
    });
  }

  onJoin(client: Client, options: any) {
    super.onJoin(client, options);
    const { mapWidth, mapHeight, players } = this.state;
    players.set(client.sessionId, createPlayer(mapWidth, mapHeight));
  }
}
