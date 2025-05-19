import React from "react";
import { useScenario } from "../hooks/useScenario";
import type { ScenarioMeta } from "../scenarioLoader";
import styles from "./ScenarioSelector.module.css";

/**
 * ScenarioSelector - Dropdown for selecting a scenario.
 *
 * Props:
 *   options: { id: string; name: string }[]
 *
 * Example:
 * <ScenarioSelector options={[{id: "default", name: "Default"}, ...]} />
 */
export interface ScenarioSelectorProps {
  options: ScenarioMeta[];
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  options,
}) => {
  const { scenario, setScenario } = useScenario();
  return (
    <select
      className={styles.select}
      value={scenario}
      onChange={(e) => setScenario(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.name}
        </option>
      ))}
    </select>
  );
};
