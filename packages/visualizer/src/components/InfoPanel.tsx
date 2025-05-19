import React from "react";

/**
 * InfoPanel - Display simulation statistics/info.
 *
 * Props:
 *   info: Record<string, string | number>
 *
 * Example:
 * <InfoPanel info={{ objects: 12, time: 3.2, status: 'running' }} />
 */
export interface InfoPanelProps {
  info: Record<string, string | number>;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ info }) => (
  <div>
    <h3>Simulation Info</h3>
    <ul>
      {Object.entries(info).map(([k, v]) => (
        <li key={k}>
          <strong>{k}:</strong> {v}
        </li>
      ))}
    </ul>
  </div>
);
