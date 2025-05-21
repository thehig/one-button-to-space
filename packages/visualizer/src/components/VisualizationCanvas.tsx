import React, { useRef, useEffect } from "react";
import { usePhysicsEngine } from "../hooks/usePhysicsEngine";

interface VisualizationCanvasProps {
  width?: number;
  height?: number;
}

export const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({
  width = 800,
  height = 600,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const {
    lastState,
    isPlaying,
    play,
    pause,
    reset,
    speed,
    setSpeed,
    scenario,
    availableScenarios,
    selectScenario,
    currentTick,
    step,
  } = usePhysicsEngine();

  // Render the physics state to the canvas
  useEffect(() => {
    if (!canvasRef.current || !lastState) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    // Clear
    ctx.clearRect(0, 0, width, height);
    // Draw bodies (simple 2D projection)
    if (lastState.world && lastState.world.bodies) {
      for (const body of lastState.world.bodies) {
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle || 0);
        ctx.strokeStyle = body.render?.strokeStyle || "#fff";
        ctx.lineWidth = body.render?.lineWidth || 1;
        ctx.globalAlpha = body.render?.visible === false ? 0.2 : 1;
        if (body.circleRadius) {
          ctx.beginPath();
          ctx.arc(0, 0, body.circleRadius, 0, 2 * Math.PI);
          ctx.stroke();
        } else if (body.vertices && body.vertices.length > 1) {
          ctx.beginPath();
          ctx.moveTo(
            body.vertices[0].x - body.position.x,
            body.vertices[0].y - body.position.y
          );
          for (let i = 1; i < body.vertices.length; i++) {
            ctx.lineTo(
              body.vertices[i].x - body.position.x,
              body.vertices[i].y - body.position.y
            );
          }
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }, [lastState, width, height]);

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <label>
          Scenario:
          <select
            value={scenario?.id || ""}
            onChange={(e) => selectScenario(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {availableScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <button onClick={isPlaying ? pause : play} style={{ marginLeft: 8 }}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={reset} style={{ marginLeft: 8 }}>
          Reset
        </button>
        <label style={{ marginLeft: 8 }}>
          Speed:
          <input
            type="range"
            min={1}
            max={10}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ marginLeft: 4, verticalAlign: "middle" }}
          />
          <span style={{ marginLeft: 4 }}>{speed}x</span>
        </label>
        <button onClick={() => step(1)} style={{ marginLeft: 8 }}>
          Step
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ background: "#222", border: "1px solid #444" }}
      />
      <div style={{ marginTop: 8, color: "#aaa" }}>
        <span>Tick: {currentTick}</span>
      </div>
    </div>
  );
};
