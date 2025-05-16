import { Client } from "colyseus";
import { BaseRoom } from "./BaseRoom";
import { BaseRoomState, InputData } from "../schema";
import { handlePlayerMovement, createPlayer } from "../commands";

export class Part2Room extends BaseRoom<BaseRoomState> {
  state = new BaseRoomState();

  onCreate(options: any) {
    super.onCreate(options);

    this.onMessage(0, (client, input: InputData) => {
      const player = this.state.players.get(client.sessionId);
      handlePlayerMovement(player, input);
    });
  }

  onJoin(client: Client, options: any) {
    super.onJoin(client, options);

    const player = createPlayer(this.state.mapWidth, this.state.mapHeight);

    this.state.players.set(client.sessionId, player);
  }
}
