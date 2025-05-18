import {
  ISerializedMatterBody,
  ISerializedVector,
} from "../../physics/scenarios/types";

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
  value: string | number | null | undefined
): HTMLParagraphElement {
  const p = document.createElement("p");
  p.style.margin = "2px 0 2px 10px"; // Indent details
  p.style.fontSize = "0.9em";
  p.innerHTML = `<strong>${label}:</strong> ${value ?? "N/A"}`;
  return p;
}

function formatVector(
  vector: ISerializedVector | undefined,
  precision: number = 2
): string {
  if (!vector) return "N/A";
  return `x: ${vector.x.toFixed(precision)}, y: ${vector.y.toFixed(precision)}`;
}

export function updateDynamicBodiesView(
  container: HTMLElement,
  bodies: ISerializedMatterBody[] | undefined
): void {
  container.innerHTML = ""; // Clear previous content

  if (!bodies || bodies.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No dynamic bodies in the current state.";
    container.appendChild(p);
    return;
  }

  bodies.forEach((body) => {
    const bodyContainer = document.createElement("div");
    bodyContainer.style.marginBottom = "15px";

    bodyContainer.appendChild(
      createSectionTitle(`Body ID: ${body.label} (Matter ID: ${body.id})`)
    );

    bodyContainer.appendChild(createDetailItem("Type", body.type));
    bodyContainer.appendChild(
      createDetailItem("Static", body.isStatic ? "Yes" : "No")
    );
    bodyContainer.appendChild(
      createDetailItem("Sensor", body.isSensor ? "Yes" : "No")
    );
    bodyContainer.appendChild(
      createDetailItem("Position", formatVector(body.position))
    );
    bodyContainer.appendChild(
      createDetailItem("Velocity", formatVector(body.velocity))
    );
    bodyContainer.appendChild(
      createDetailItem("Angle", body.angle?.toFixed(3))
    );
    bodyContainer.appendChild(
      createDetailItem("Ang. Vel.", body.angularVelocity?.toFixed(3))
    );
    bodyContainer.appendChild(createDetailItem("Mass", body.mass?.toFixed(3)));
    bodyContainer.appendChild(
      createDetailItem("Inertia", body.inertia?.toFixed(3))
    );
    bodyContainer.appendChild(
      createDetailItem("Friction", body.friction?.toFixed(2))
    );
    bodyContainer.appendChild(
      createDetailItem("Restitution", body.restitution?.toFixed(2))
    );

    // Display creation params if available (from plugin)
    if (body.plugin?.creationParams) {
      const cp = body.plugin.creationParams;
      let cpDetails = `Type: ${cp.type}`;
      if (
        cp.type === "box" &&
        cp.width !== undefined &&
        cp.height !== undefined
      ) {
        cpDetails += `, W: ${cp.width}, H: ${cp.height}`;
      }
      if (cp.type === "circle" && cp.radius !== undefined) {
        cpDetails += `, R: ${cp.radius}`;
      }
      // Add more for polygon if needed
      bodyContainer.appendChild(createDetailItem("Geom. Def.", cpDetails));
    }

    container.appendChild(bodyContainer);
  });
}
