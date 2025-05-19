import React, { createContext, useContext, useState, ReactNode } from "react";

// Types for state
export type SimulationStatus = "running" | "paused";

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface VisualizerState {
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
> = {
  currentScenario: "default",
  simulationStatus: "paused",
  simulationSpeed: 1,
  camera: { x: 0, y: 0, zoom: 1 },
  uiConfig: {},
};

const VisualizerContext = createContext<VisualizerState | undefined>(undefined);

export const VisualizerProvider = ({ children }: { children: ReactNode }) => {
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
