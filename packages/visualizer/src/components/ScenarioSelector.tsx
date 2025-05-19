import React from "react";
import { useScenario } from "../hooks/useScenario";

/**
 * ScenarioSelector - Dropdown for selecting a scenario.
 *
 * Props:
 *   options: string[]
 *
 * Example:
 * <ScenarioSelector options={["default", "gravity", "collision"]} />
 */
export interface ScenarioSelectorProps {
  options: string[];
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  options,
}) => {
  const { scenario, setScenario } = useScenario();
  return (
    <select value={scenario} onChange={(e) => setScenario(e.target.value)}>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
};
