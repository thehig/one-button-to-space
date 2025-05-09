import { Scene } from "phaser";
// import Matter from "matter-js";

const objClone = (obj: any) => {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    return {};
  }
};

export class Game extends Scene {
  camera!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super("Game");

    console.log("Game constructor");
  }

  create() {
    console.log("Game create");

    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x1a1a1a); // Dark grey background
    this.matter.world.setBounds(
      0,
      0,
      this.game.canvas.width,
      this.game.canvas.height
    );

    // Add a simple circle using Phaser's factory to see if it works with the bounds
    this.matter.add.circle(400, 100, 20);

    // Add mouse control
    this.matter.add.mouseSpring({});

    // Remove previously added complex stack and custom walls for this test
    // const stack = Matter.Composites.stack(...);
    // this.matter.world.add(stack);
    // this.matter.world.add([ Matter.Bodies.rectangle(...) ]);
  }

  // update(time: number, delta: number): void {
  //   // Any custom update logic if needed
  // }
}
