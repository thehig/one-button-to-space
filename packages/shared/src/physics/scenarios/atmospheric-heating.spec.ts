import { expect } from "chai";
import "mocha";
import Matter from "matter-js"; // Matter needed for Vector, Body etc.
import * as fs from "fs";
import * as path from "path";
import { IScenario } from "./types";
import { PhysicsEngine, ICustomBodyPlugin } from "../PhysicsEngine";

import {
  atmosphericHeatingScenario1Step,
  atmosphericHeatingScenario10Steps,
  atmosphericHeatingScenario50Steps,
  atmosphericHeatingScenario100Steps,
} from "./atmospheric-heating.scenario";
import { runScenario, ScenarioResult } from "./test-runner.helper";

const snapshotDir = path.join(__dirname, "__snapshots__");

const runTestAndSnapshot = (
  scenario: IScenario,
  targetBodyId: string,
  snapshotFileName: string
) => {
  const snapshotFile = path.join(snapshotDir, snapshotFileName);
  // For atmospheric heating, the specific assertions are in the 1-step test.
  // For snapshots, we rely on the full ScenarioResult comparison.
  const currentResults = runScenario(scenario, targetBodyId);

  if (process.env.UPDATE_SNAPSHOTS === "true") {
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    fs.writeFileSync(snapshotFile, JSON.stringify(currentResults, null, 2));
    console.log(`  Snapshot updated: ${snapshotFileName}`);
    return currentResults;
  } else {
    if (!fs.existsSync(snapshotFile)) {
      throw new Error(
        `Snapshot file not found: ${snapshotFileName}. Run with UPDATE_SNAPSHOTS=true to create it.`
      );
    }
    const expectedResults = JSON.parse(
      fs.readFileSync(snapshotFile, "utf-8")
    ) as ScenarioResult;
    expect(currentResults).to.deep.equal(expectedResults);
    return currentResults;
  }
};

describe("PhysicsEngine Environmental Effects: Atmospheric Heating", () => {
  it("should simulate atmospheric heating (1 step - explicit assertions)", () => {
    const scenario = atmosphericHeatingScenario1Step;
    const celestialBodyDef = scenario.celestialBodies![0];
    const bodyDef = scenario.initialBodies[0];
    const noseRadius = bodyDef.options!.plugin!.effectiveNoseRadius!;
    const bodyInitialSpeed = Math.abs(bodyDef.initialVelocity!.x!); // Speed is magnitude

    const engine = new PhysicsEngine(
      scenario.engineSettings?.fixedTimeStepMs,
      scenario.engineSettings?.customG
    );
    if (scenario.engineSettings?.enableInternalLogging) {
      engine.setInternalLogging(true);
    }
    engine.init(scenario.celestialBodies);

    const testBody = engine.createBox(
      bodyDef.initialPosition.x,
      bodyDef.initialPosition.y,
      bodyDef.width!,
      bodyDef.height!,
      {
        label: bodyDef.label,
        plugin: bodyDef.options!.plugin as ICustomBodyPlugin,
      }
    );
    engine.setBodyVelocity(testBody, bodyDef.initialVelocity!);

    const altitude = bodyDef.initialPosition.x - celestialBodyDef.radius!;
    const rho =
      celestialBodyDef.surfaceAirDensity! *
      Math.exp(-Math.max(0, altitude) / celestialBodyDef.scaleHeight!);
    const V = bodyInitialSpeed;
    const Rn = noseRadius;
    const C_heating = 1.83e-4;
    const expectedHeatFlux = C_heating * Math.sqrt(rho / Rn) * Math.pow(V, 3);

    engine.fixedStep(scenario.engineSettings?.fixedTimeStepMs || 1000 / 60);

    const calculatedHeatFlux = (testBody.plugin as ICustomBodyPlugin)
      .currentHeatFlux;

    expect(calculatedHeatFlux).to.be.a(
      "number",
      "currentHeatFlux should be calculated"
    );
    expect(calculatedHeatFlux).to.be.closeTo(
      expectedHeatFlux,
      expectedHeatFlux * 0.1 // Allow 10% tolerance
    );
  });

  it("should match snapshot after 10 steps of atmospheric heating", () => {
    runTestAndSnapshot(
      atmosphericHeatingScenario10Steps,
      atmosphericHeatingScenario10Steps.initialBodies[0].id!,
      "atmospheric-heating.10steps.snap.json"
    );
  });

  it("should match snapshot after 50 steps of atmospheric heating", () => {
    runTestAndSnapshot(
      atmosphericHeatingScenario50Steps,
      atmosphericHeatingScenario50Steps.initialBodies[0].id!,
      "atmospheric-heating.50steps.snap.json"
    );
  });

  it("should match snapshot after 100 steps of atmospheric heating", () => {
    runTestAndSnapshot(
      atmosphericHeatingScenario100Steps,
      atmosphericHeatingScenario100Steps.initialBodies[0].id!,
      "atmospheric-heating.100steps.snap.json"
    );
  });
});
