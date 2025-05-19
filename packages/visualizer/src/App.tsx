import React from "react";
import { Visualizer } from "./components";
import { VisualizerProvider } from "./VisualizerContext";

const App: React.FC = () => {
  return (
    <VisualizerProvider>
      <Visualizer />
    </VisualizerProvider>
  );
};

export default App;
