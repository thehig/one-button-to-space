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
        initialX={-938}
        initialY={-248}
        initialWidth={2530}
        initialHeight={200}
        startsOpen={true}
        startsLocked={true}
        startTreeOpen={false}
        startDataOpen={false}
        collapsedOpacity={0.7}
        lockedOpacity={0.75}
        hijackConsoleLogs={true}
      />
    </>
  );
}

export default App;
