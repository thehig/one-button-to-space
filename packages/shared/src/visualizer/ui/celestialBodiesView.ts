import {
  ICelestialBodyData,
  ISerializedVector,
} from "../../physics/scenarios/types";

// Helper functions (can be refactored into a shared UI utils file later if more views are added)
function createSectionTitle(text: string): HTMLHeadingElement {
  const h4 = document.createElement("h4");
  h4.textContent = text;
  h4.style.marginTop = "10px";
  h4.style.marginBottom = "5px";
  h4.style.borderBottom = "1px solid #eee";
  h4.style.paddingBottom = "3px";
  return h4;
}

function createDetailItem(
  label: string,
  value: string | number | boolean | null | undefined
): HTMLParagraphElement {
  const p = document.createElement("p");
  p.style.margin = "2px 0 2px 10px"; // Indent details
  p.style.fontSize = "0.9em";
  let displayValue: string;
  if (typeof value === "boolean") {
    displayValue = value ? "Yes" : "No";
  } else {
    displayValue = value?.toString() ?? "N/A";
  }
  p.innerHTML = `<strong>${label}:</strong> ${displayValue}`;
  return p;
}

function formatPosition(
  position: { x: number; y: number } | undefined,
  precision: number = 2
): string {
  if (!position) return "N/A";
  return `x: ${position.x.toFixed(precision)}, y: ${position.y.toFixed(
    precision
  )}`;
}

export function updateCelestialBodiesView(
  container: HTMLElement,
  celestialBodies: ICelestialBodyData[] | undefined
): void {
  container.innerHTML = ""; // Clear previous content

  if (!celestialBodies || celestialBodies.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No celestial bodies in the current state.";
    container.appendChild(p);
    return;
  }

  celestialBodies.forEach((cb) => {
    const cbContainer = document.createElement("div");
    cbContainer.style.marginBottom = "15px";

    cbContainer.appendChild(createSectionTitle(`Celestial Body ID: ${cb.id}`));

    cbContainer.appendChild(createDetailItem("Mass", cb.mass?.toFixed(3)));
    cbContainer.appendChild(
      createDetailItem("Position", formatPosition(cb.position))
    );
    cbContainer.appendChild(
      createDetailItem("Effective Radius", cb.radius?.toFixed(0))
    );
    cbContainer.appendChild(
      createDetailItem("Gravity Radius", cb.gravityRadius?.toFixed(0))
    );
    cbContainer.appendChild(
      createDetailItem("Has Atmosphere", cb.hasAtmosphere)
    );
    if (cb.hasAtmosphere) {
      cbContainer.appendChild(
        createDetailItem(
          "Atmosphere Limit Alt.",
          cb.atmosphereLimitAltitude?.toFixed(0)
        )
      );
      cbContainer.appendChild(
        createDetailItem(
          "Surface Air Density",
          cb.surfaceAirDensity?.toExponential(2)
        )
      );
      cbContainer.appendChild(
        createDetailItem("Scale Height", cb.scaleHeight?.toFixed(0))
      );
    }

    container.appendChild(cbContainer);
  });
}
