import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import {
  usePhysicsEngine,
  type UsePhysicsEngineResult,
  type UsePhysicsEngineOptions,
} from "./hooks/usePhysicsEngine";
import type { IScenario } from "../../shared/src/physics/scenarios/types";

// Types for state
export type SimulationStatus = "running" | "paused" | "stopped";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface VisualizerState extends UsePhysicsEngineResult {
  currentScenario: string;
  simulationStatus: SimulationStatus;
  simulationSpeed: number;
  camera: CameraState;
  uiConfig: Record<string, unknown>;
  setCurrentScenario: (scenario: string) => void;
  setSimulationStatus: (status: SimulationStatus) => void;
  setSimulationSpeed: (speed: number) => void;
  setCamera: (camera: CameraState) => void;
  setUiConfig: (config: Record<string, unknown>) => void;
}

const defaultState: Omit<
  VisualizerState,
  | "setCurrentScenario"
  | "setSimulationStatus"
  | "setSimulationSpeed"
  | "setCamera"
  | "setUiConfig"
  | "play"
  | "pause"
  | "reset"
  | "setSpeed"
  | "selectScenario"
  | "step"
  | "physicsEngine"
  | "scenario"
  | "availableScenarios"
  | "lastState"
> = {
  currentScenario: "default",
  simulationStatus: "paused",
  simulationSpeed: 1,
  camera: { x: 0, y: 0, zoom: 1 },
  uiConfig: {},
  isPlaying: false,
  currentTick: 0,
};

const VisualizerContext = createContext<VisualizerState | undefined>(undefined);

interface VisualizerProviderProps {
  children: ReactNode;
  physicsEngineOptions?: UsePhysicsEngineOptions;
}

export const VisualizerProvider = ({
  children,
  physicsEngineOptions,
}: VisualizerProviderProps) => {
  const physicsEngineAPI = usePhysicsEngine(physicsEngineOptions);

  const [currentScenario, setCurrentScenario] = useState(
    defaultState.currentScenario
  );
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus>(
    defaultState.simulationStatus
  );
  const [simulationSpeed, setSimulationSpeed] = useState(
    defaultState.simulationSpeed
  );
  const [camera, setCamera] = useState<CameraState>(defaultState.camera);
  const [uiConfig, setUiConfig] = useState<Record<string, unknown>>(
    defaultState.uiConfig
  );

  const value: VisualizerState = {
    ...physicsEngineAPI,
    currentScenario,
    simulationStatus,
    simulationSpeed,
    camera,
    uiConfig,
    setCurrentScenario,
    setSimulationStatus,
    setSimulationSpeed,
    setCamera,
    setUiConfig,
  };

  return (
    <VisualizerContext.Provider value={value}>
      {children}
    </VisualizerContext.Provider>
  );
};

export function useVisualizerState(): VisualizerState {
  const ctx = useContext(VisualizerContext);
  if (!ctx)
    throw new Error(
      "useVisualizerState must be used within a VisualizerProvider"
    );
  return ctx;
}
