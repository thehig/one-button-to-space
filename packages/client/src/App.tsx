import React from "react";
import "./App.css";
import PhaserGame from "./components/PhaserGame";
import { GameEventLog } from "@one-button-to-space/logger-ui";
import { sourceTreeData } from "./types/LogTypes";
//
function App() {
  return (
    <>
      <h1>One Button To Space</h1>
      <PhaserGame />
      <GameEventLog
        sourceConfigData={sourceTreeData}
        startsLocked={true}
        /* Above is the default settings */
        initialX={-875}
        initialY={-228}
        initialWidth={787}
        initialHeight={200}
        startsOpen={true}
        startTreeOpen={false}
        startDataOpen={false}
        collapsedOpacity={0.7}
        lockedOpacity={0.25}
        hijackConsoleLogs={true}
      />
    </>
  );
}

export default App;
