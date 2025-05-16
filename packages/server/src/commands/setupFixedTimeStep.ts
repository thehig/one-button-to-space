import { Room } from "@colyseus/core";

/**
 * Setup a fixed timestep game loop
 */
export const setupFixedTimeStep = (
  room: Room,
  fixedTimeStep: number,
  tickCallback: (timeStep: number) => void
): void => {
  let elapsedTime = 0;
  room.setSimulationInterval((deltaTime) => {
    elapsedTime += deltaTime;

    while (elapsedTime >= fixedTimeStep) {
      elapsedTime -= fixedTimeStep;
      tickCallback(fixedTimeStep);
    }
  });
};
