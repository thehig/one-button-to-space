import { useVisualizerState } from "../VisualizerContext";

/**
 * useUiConfig - Access and update UI configuration options.
 *
 * Example:
 * const { uiConfig, setUiConfig } = useUiConfig();
 * uiConfig // { theme: 'dark' }
 * setUiConfig({ theme: 'light' })
 */
export function useUiConfig() {
  const { uiConfig, setUiConfig } = useVisualizerState();
  return { uiConfig, setUiConfig };
}
