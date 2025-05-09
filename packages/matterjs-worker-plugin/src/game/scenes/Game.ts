export class Game extends Phaser.Scene {
  camera!: Phaser.Cameras.Scene2D.Camera;
  private updateCount: number = 0;
  private fpsTime: number = 0;
  private fpsText!: Phaser.GameObjects.Text;

  // FPS Graph properties
  private fpsHistory: number[] = [];
  private readonly maxFpsHistoryLength: number = 10; // Store 10 seconds of FPS data
  private fpsGraph!: Phaser.GameObjects.Graphics;
  private readonly fpsGraphWidth: number = 150;
  private readonly fpsGraphHeight: number = 50;
  private readonly maxDisplayableFps: number = 70; // For graph scaling, adjust if FPS often exceeds this

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

    // Initialize FPS Graph
    this.fpsGraph = this.add.graphics();
    this.fpsGraph.setPosition(10, 35); // Position graph below FPS text
    this.fpsGraph.setScrollFactor(0);
    this.drawFpsGraph(); // Initial draw (empty graph)

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
      const currentFps = this.updateCount;
      this.fpsText.setText("FPS: " + currentFps);

      // Update FPS history
      this.fpsHistory.push(currentFps);
      if (this.fpsHistory.length > this.maxFpsHistoryLength) {
        this.fpsHistory.shift(); // Remove the oldest entry
      }
      this.drawFpsGraph(); // Redraw graph with new data

      this.updateCount = 0;
      this.fpsTime -= 1000;
    }
    // console.log("Game update", Math.round(time), Math.round(delta)); // Removed for FPS display
  }

  private drawFpsGraph(): void {
    this.fpsGraph.clear();

    // Background and Border
    this.fpsGraph.fillStyle(0x000000, 0.3);
    this.fpsGraph.fillRect(0, 0, this.fpsGraphWidth, this.fpsGraphHeight);
    this.fpsGraph.lineStyle(1, 0x555555, 0.7);
    this.fpsGraph.strokeRect(0, 0, this.fpsGraphWidth, this.fpsGraphHeight);

    // Helper function to draw reference lines
    const drawReferenceLine = (
      fpsValue: number,
      color: number,
      alpha: number = 0.3
    ) => {
      const y =
        this.fpsGraphHeight -
        Phaser.Math.Clamp(
          (fpsValue / this.maxDisplayableFps) * this.fpsGraphHeight,
          0,
          this.fpsGraphHeight
        );
      if (y >= 0 && y <= this.fpsGraphHeight) {
        this.fpsGraph.lineStyle(1, color, alpha);
        this.fpsGraph.beginPath();
        this.fpsGraph.moveTo(0, y);
        this.fpsGraph.lineTo(this.fpsGraphWidth, y);
        this.fpsGraph.strokePath();
      }
    };

    // Draw reference lines (e.g., for 30 and 60 FPS)
    drawReferenceLine(30, 0xffaa00); // Orange-ish for 30 FPS
    drawReferenceLine(60, 0xff0000); // Red for 60 FPS (can be a target)

    // Draw FPS line graph
    this.fpsGraph.lineStyle(2, 0x00ff00, 1); // Green line for actual FPS
    this.fpsGraph.beginPath();

    const stepX =
      this.fpsGraphWidth / Math.max(1, this.maxFpsHistoryLength - 1);

    if (this.fpsHistory.length === 0) {
      this.fpsGraph.moveTo(0, this.fpsGraphHeight);
    } else {
      let yPos =
        this.fpsGraphHeight -
        Phaser.Math.Clamp(
          (this.fpsHistory[0] / this.maxDisplayableFps) * this.fpsGraphHeight,
          0,
          this.fpsGraphHeight
        );
      this.fpsGraph.moveTo(0, yPos);
    }

    for (let i = 1; i < this.fpsHistory.length; i++) {
      const fpsValue = this.fpsHistory[i];
      const x = i * stepX;
      let y =
        this.fpsGraphHeight -
        Phaser.Math.Clamp(
          (fpsValue / this.maxDisplayableFps) * this.fpsGraphHeight,
          0,
          this.fpsGraphHeight
        );
      this.fpsGraph.lineTo(x, y);
    }
    this.fpsGraph.strokePath();
  }
}
