export class Game extends Phaser.Scene {
  camera!: Phaser.Cameras.Scene2D.Camera;
  private updateCount: number = 0;
  private fpsTime: number = 0;
  private fpsText!: Phaser.GameObjects.Text;

  constructor() {
    super("Game");

    console.log("Game constructor");
  }

  create() {
    console.log("Game create");

    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(0x1a1a1a); // Dark grey background

    // Initialize FPS calculation variables and text
    this.updateCount = 0;
    this.fpsTime = 0;
    this.fpsText = this.add.text(10, 10, "FPS: 0", {
      font: "16px Arial",
      color: "#ffffff",
    });
    this.fpsText.setScrollFactor(0); // Keep FPS text fixed on screen if camera moves

    this.matter.world.setBounds(
      0,
      0,
      this.game.canvas.width,
      this.game.canvas.height
    );

    // Add a simple circle using Phaser's factory to see if it works with the bounds
    for (let i = 0; i < 1000; i++) {
      this.addCircle();
    }

    // Add mouse control
    this.matter.add.mouseSpring({});

    // Remove previously added complex stack and custom walls for this test
    // const stack = Matter.Composites.stack(...);
    // this.matter.world.add(stack);
    // this.matter.world.add([ Matter.Bodies.rectangle(...) ]);
  }

  addCircle() {
    this.matter.add.circle(
      Math.random() * this.game.canvas.width,
      Math.random() * this.game.canvas.height,
      10
    );
  }

  update(time: number, delta: number): void {
    this.updateCount++;
    this.fpsTime += delta;

    if (this.fpsTime >= 1000) {
      this.fpsText.setText("FPS: " + this.updateCount);
      this.updateCount = 0;
      this.fpsTime -= 1000;
    }
    // console.log("Game update", Math.round(time), Math.round(delta)); // Removed for FPS display
  }
}
