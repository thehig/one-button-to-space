import { ISerializedPhysicsEngineState } from "../../physics/scenarios/types";
import { Vector } from "matter-js";

function createTextElement(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = text;
  p.style.margin = "4px 0";
  return p;
}

export function updateSimulationInfoView(
  container: HTMLElement,
  state: ISerializedPhysicsEngineState | undefined
): void {
  // Clear previous content
  container.innerHTML = "";

  if (!state) {
    container.appendChild(createTextElement("State not available."));
    return;
  }

  container.appendChild(
    createTextElement(`Current Tick: ${state.simulationTick ?? "N/A"}`)
  );

  container.appendChild(
    createTextElement(
      `Timestep (ms): ${state.fixedTimeStepMs ?? "Default (Matter.js)"}`
    )
  );

  let gravityText = "Gravity (G): ";
  gravityText += state.G?.toFixed(4) ?? "Default (Matter.js)";
  container.appendChild(createTextElement(gravityText));

  container.appendChild(
    createTextElement(
      `Internal Logging: ${
        state.internalLoggingEnabled ? "Enabled" : "Disabled"
      }`
    )
  );
}
