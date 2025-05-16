import { ColyseusTestServer, boot } from "@colyseus/testing";
import { describe, it, before, after, beforeEach } from "mocha";
import * as assert from "assert";

import appConfig from "../src/app.config";
import { MyRoomState } from "../src/rooms/Part1Room";

describe("testing your Colyseus app", () => {
  let colyseus: ColyseusTestServer;

  before(async () => (colyseus = await boot(appConfig)));
  after(async () => colyseus.shutdown());

  beforeEach(async () => await colyseus.cleanup());

  it("connecting into a room", async () => {
    // `room` is the server-side Room instance reference.
    const room = await colyseus.createRoom<MyRoomState>("part1_room", {});

    // `client1` is the client-side `Room` instance reference (same as JavaScript SDK)
    const client1 = await colyseus.connectTo(room);

    // make your assertions
    assert.strictEqual(client1.sessionId, room.clients[0].sessionId);

    // wait for state sync
    await room.waitForNextPatch();

    const actualState = client1.state.toJSON();

    assert.partialDeepStrictEqual(actualState, {
      mapHeight: 600,
      mapWidth: 800,
      players: {
        [client1.sessionId]: {
          // x: assert.within
          // y: 509.3070373535156,
        },
      },
    });

    assert.equal(
      actualState.players[client1.sessionId].x > 0 &&
        actualState.players[client1.sessionId].x < actualState.mapWidth,
      true
    );

    assert.equal(
      actualState.players[client1.sessionId].y > 0 &&
        actualState.players[client1.sessionId].y < actualState.mapHeight,
      true
    );

    client1.send(0, {
      x: 100,
      y: 100,
    });

    await room.waitForNextPatch();
  });
});
