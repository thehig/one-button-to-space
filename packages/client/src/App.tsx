import "./App.css";
import PhaserGame from "./components/PhaserGame";
import { GameEventLog } from "./components/GameEventLog";

function App() {
  return (
    <>
      <h1>One Button To Space</h1>
      <PhaserGame />
      {/* You can add other React components here alongside the game */}
      <GameEventLog />
    </>
  );
}

export default App;
