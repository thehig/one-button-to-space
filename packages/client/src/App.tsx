import React from "react";
import "./App.css";
import PhaserGame from "./components/PhaserGame";
import { GameEventLog } from "@one-button-to-space/logger-ui";
// import { sourceTreeData } from "./types/LogTypes";

function App() {
  return (
    <>
      <h1>One Button To Space</h1>
      <PhaserGame />
      <GameEventLog
        startsOpen={true}
        collapsedOpacity={0.7}
        initialX={0}
        initialY={0}
        startDataOpen={true}
        startTreeOpen={true}
        initialWidth={900}
        // sourceConfigData={sourceTreeData}
      />
    </>
  );
}

export default App;
