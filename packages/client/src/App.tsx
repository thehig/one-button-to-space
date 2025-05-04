import React from "react";
import "./App.css";
import PhaserGame from "./components/PhaserGame";
import { GameEventLog } from "@one-button-to-space/logger-ui";

function App() {
  return (
    <>
      <h1>One Button To Space</h1>
      <PhaserGame />
      <GameEventLog />
    </>
  );
}

export default App;
