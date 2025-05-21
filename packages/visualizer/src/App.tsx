import React from "react";
import { Visualizer } from "./components";
import { VisualizerProvider } from "./VisualizerContext";
import { VisualizationCanvas } from "./components/VisualizationCanvas";

const App: React.FC = () => {
  return (
    <VisualizerProvider>
      <Visualizer />
      <div style={{ margin: "2rem 0" }} />
      <VisualizationCanvas width={800} height={600} />
    </VisualizerProvider>
  );
};

export default App;
