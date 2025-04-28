import React from "react";
import { Logger } from "@one-button-to-space/shared";
import "./App.css"; // Optional: for App-specific styles

// Logger Source for this file
const LOGGER_SOURCE = "⚛️🖼️";

function App() {
  // This component can be used for overlays, menus, HUD elements, etc.
  // It renders separately from the Phaser canvas.

  // Example log during component mount/render (use sparingly in React components)
  React.useEffect(() => {
    Logger.debug(LOGGER_SOURCE, "App component mounted.");
  }, []);

  return (
    <div className="App">
      {/* Example UI Element */}
      {/* <header className="App-header">
        <h1>Game UI</h1>
      </header> */}
      {/* Add score display, health bars, menus, etc. here */}
      {/* <div style={{ position: 'absolute', top: 10, left: 10, color: 'white' }}>
        Score: 0
      </div> */}
    </div>
  );
}

export default App;
