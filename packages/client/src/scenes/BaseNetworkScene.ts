import Phaser from "phaser";
import { Room, Client, getStateCallbacks } from "colyseus.js";
import { BACKEND_URL } from "../backend";

export interface InputPayload {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  tick?: number;
}

export class BaseNetworkScene extends Phaser.Scene {
  protected room: Room;
  protected playerEntities: {
    [sessionId: string]: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  } = {};
  protected currentPlayer: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  protected debugFPS: Phaser.GameObjects.Text;
  protected cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys;
  protected inputPayload: InputPayload = {
    left: false,
    right: false,
    up: false,
    down: false,
  };

  constructor(config: string | Phaser.Types.Scenes.SettingsConfig) {
    super(config);
  }

  protected async initializeCommon() {
    // Set up common components
    this.cursorKeys = this.input.keyboard.createCursorKeys();
    this.debugFPS = this.add.text(4, 4, "", { color: "#ff0000" });

    // Set up camera bounds
    this.cameras.main.setBounds(0, 0, 800, 600);
  }

  protected async connect(roomName: string): Promise<Room> {
    // Add connection status text
    const connectionStatusText = this.add
      .text(0, 0, "Trying to connect with the server...")
      .setStyle({ color: "#ff0000" })
      .setPadding(4);

    const client = new Client(BACKEND_URL);

    try {
      this.room = await client.joinOrCreate(roomName, {});
      // Connection successful!
      connectionStatusText.destroy();
      return this.room;
    } catch (e) {
      // Couldn't connect
      connectionStatusText.text = "Could not connect with the server.";
      throw e;
    }
  }

  protected setupPlayerHandlers(
    onAddPlayer?: (
      player: any,
      sessionId: string,
      entity: Phaser.Types.Physics.Arcade.ImageWithDynamicBody
    ) => void
  ) {
    const $ = getStateCallbacks(this.room);

    $(this.room.state).players.onAdd((player, sessionId) => {
      const entity = this.physics.add.image(player.x, player.y, "ship_0001");
      this.playerEntities[sessionId] = entity;

      // Call the custom handler if provided
      if (onAddPlayer) {
        onAddPlayer(player, sessionId, entity);
      }
    });

    // Remove local reference when entity is removed from the server
    $(this.room.state).players.onRemove((player, sessionId) => {
      const entity = this.playerEntities[sessionId];
      if (entity) {
        entity.destroy();
        delete this.playerEntities[sessionId];
      }
    });
  }

  protected sendInput(messageType: number = 0) {
    if (!this.room) return;

    this.inputPayload.left = this.cursorKeys.left.isDown;
    this.inputPayload.right = this.cursorKeys.right.isDown;
    this.inputPayload.up = this.cursorKeys.up.isDown;
    this.inputPayload.down = this.cursorKeys.down.isDown;

    this.room.send(messageType, this.inputPayload);
  }

  protected updateFPSText() {
    if (this.debugFPS) {
      this.debugFPS.text = `Frame rate: ${this.game.loop.actualFps}`;
    }
  }

  protected interpolateOtherPlayers(excludeCurrentPlayer: boolean = true) {
    for (let sessionId in this.playerEntities) {
      // Skip current player if needed
      if (excludeCurrentPlayer && sessionId === this.room.sessionId) {
        continue;
      }

      const entity = this.playerEntities[sessionId];
      const { serverX, serverY } = entity.data?.values || {};

      if (serverX !== undefined && serverY !== undefined) {
        entity.x = Phaser.Math.Linear(entity.x, serverX, 0.2);
        entity.y = Phaser.Math.Linear(entity.y, serverY, 0.2);
      }
    }
  }
}
