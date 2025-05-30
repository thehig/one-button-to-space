import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { CommunicationProvider } from "@one-button-to-space/logger-ui";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CommunicationProvider maxLogSize={1000} redirectEventsToConsole={true}>
      <App />
    </CommunicationProvider>
  </StrictMode>
);
