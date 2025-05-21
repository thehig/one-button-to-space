import { useEffect, useRef, useState, useCallback } from "react";
import { PhysicsEngine } from "../../../shared/src/physics/PhysicsEngine";
import type { IScenario } from "../../../shared/src/physics/scenarios/types";
import { scenariosToRun } from "../../../shared/src/physics/scenarios/index";

export interface UsePhysicsEngineOptions {
  initialScenarioId?: string;
  initialSpeed?: number; // 1 = normal, 2 = 2x, etc.
  debug?: boolean;
}

export interface UsePhysicsEngineResult {
  physicsEngine: PhysicsEngine | null;
  scenario: IScenario | null;
  isPlaying: boolean;
  currentTick: number;
  speed: number;
  availableScenarios: IScenario[];
  play: () => void;
  pause: () => void;
  reset: () => void;
  setSpeed: (speed: number) => void;
  selectScenario: (scenarioId: string) => void;
  step: (ticks?: number) => void;
  lastState: any;
}

export function usePhysicsEngine(
  options?: UsePhysicsEngineOptions
): UsePhysicsEngineResult {
  const [scenario, setScenario] = useState<IScenario | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [speed, setSpeedState] = useState(options?.initialSpeed ?? 1);
  const [lastState, setLastState] = useState<any>(null);
  const [availableScenarios] = useState<IScenario[]>(
    scenariosToRun.map((e) => e.scenario)
  );

  const engineRef = useRef<PhysicsEngine | null>(null);
  const rafRef = useRef<number | null>(null);

  // Helper to load a scenario
  const loadScenario = useCallback((scenarioId: string) => {
    const entry = scenariosToRun.find((e) => e.scenario.id === scenarioId);
    if (!entry) return;
    setScenario(entry.scenario);
    setCurrentTick(0);
    if (engineRef.current) {
      engineRef.current = null;
    }
    const engine = new PhysicsEngine(
      entry.scenario.engineSettings?.fixedTimeStepMs,
      entry.scenario.engineSettings?.customG
    );
    engine.init(entry.scenario.celestialBodies);
    for (const bodyDef of entry.scenario.initialBodies) {
      let body;
      switch (bodyDef.type) {
        case "box":
          body = engine.createBox(
            bodyDef.initialPosition.x,
            bodyDef.initialPosition.y,
            bodyDef.width!,
            bodyDef.height!,
            bodyDef.options
          );
          break;
        case "circle":
          body = engine.createCircle(
            bodyDef.initialPosition.x,
            bodyDef.initialPosition.y,
            bodyDef.radius!,
            bodyDef.options
          );
          break;
        case "rocket":
          body = engine.createRocketBody(
            bodyDef.initialPosition.x,
            bodyDef.initialPosition.y,
            bodyDef.options
          );
          break;
        default:
          continue;
      }
      if (bodyDef.initialVelocity) {
        engine.setBodyVelocity(body, bodyDef.initialVelocity);
      }
      if (bodyDef.initialAngle !== undefined) {
        body.angle = bodyDef.initialAngle;
      }
      if (bodyDef.initialAngularVelocity !== undefined) {
        body.angularVelocity = bodyDef.initialAngularVelocity;
      }
    }
    engineRef.current = engine;
    setLastState(engine.toJSON());
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    if (!engineRef.current || !scenario) return;
    for (let i = 0; i < speed; i++) {
      engineRef.current.fixedStep();
      setCurrentTick((tick) => tick + 1);
      setLastState(engineRef.current.toJSON());
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [scenario, speed]);

  // Play/pause logic
  const play = useCallback(() => {
    if (!isPlaying && scenario) {
      setIsPlaying(true);
    }
  }, [isPlaying, scenario]);

  const pause = useCallback(() => {
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Reset logic
  const reset = useCallback(() => {
    if (scenario) {
      loadScenario(scenario.id);
      setIsPlaying(false);
    }
  }, [scenario, loadScenario]);

  // Speed setter
  const setSpeed = useCallback((s: number) => {
    setSpeedState(s);
  }, []);

  // Scenario selector
  const selectScenario = useCallback(
    (scenarioId: string) => {
      loadScenario(scenarioId);
      setIsPlaying(false);
    },
    [loadScenario]
  );

  // Step function
  const step = useCallback((ticks = 1) => {
    if (!engineRef.current) return;
    for (let i = 0; i < ticks; i++) {
      engineRef.current.fixedStep();
      setCurrentTick((tick) => tick + 1);
      setLastState(engineRef.current.toJSON());
    }
  }, []);

  // Effect to start/stop animation
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(animate);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, animate]);

  // Initial scenario load
  useEffect(() => {
    const initialId =
      options?.initialScenarioId || scenariosToRun[0]?.scenario.id;
    if (initialId) {
      loadScenario(initialId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    physicsEngine: engineRef.current,
    scenario,
    isPlaying,
    currentTick,
    speed,
    availableScenarios,
    play,
    pause,
    reset,
    setSpeed,
    selectScenario,
    step,
    lastState,
  };
}
