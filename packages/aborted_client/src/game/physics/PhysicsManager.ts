import Phaser from "phaser";
import {
  Body as MatterBody,
  Engine as MatterEngine,
  Vector as MatterVector,
  Composite as MatterComposite,
} from "matter-js";
import { PlanetData } from "../../schema/State";
import { Planet } from "../entities/Planet";
import { Logger } from "@one-button-to-space/shared";
import { PhysicsLogic } from "@one-button-to-space/shared";
import { ComponentBase } from "../core/IComponent";
import { GameObject } from "../core/GameObject";
import { PhysicsBody } from "../components/PhysicsBody";

const LOGGER_SOURCE = "⚛️⚙️";

type BodyType = MatterBody;

interface GravitySource {
  body: BodyType;
  planetGameObject: Planet;
}

/**
 * Manages global physics settings and applies forces like gravity and drag.
 * Acts as a component attached to a scene-level GameObject.
 */
export class PhysicsManager extends ComponentBase {
  private matterEngine!: MatterEngine;
  private gravitySources: Map<number, GravitySource> = new Map();

  awake(): void {
    super.awake();
    if (!this.gameObject || !this.gameObject.scene) {
      Logger.error(
        LOGGER_SOURCE,
        "PhysicsManager component requires a valid GameObject with a Scene."
      );
      this.active = false;
      return;
    }
    if (
      !this.gameObject.scene.matter.world ||
      !this.gameObject.scene.matter.world.engine
    ) {
      Logger.error(
        LOGGER_SOURCE,
        "Matter world or engine not initialized in the scene!"
      );
      this.active = false;
      return;
    }
    this.matterEngine = this.gameObject.scene.matter.world.engine;
    Logger.info(LOGGER_SOURCE, "Initialized with Matter engine.");

    this.gameObject.scene.matter.world.setGravity(0, 0);
    Logger.info(LOGGER_SOURCE, "Default Matter world gravity disabled.");

    this.setWorldBounds(-2000, -2000, 4000, 4000, 64, true, true, true, true);
  }

  start(): void {
    super.start();
    this.findAndRegisterInitialPlanets();
    Logger.info(
      LOGGER_SOURCE,
      "PhysicsManager started, initial planets registered."
    );
  }

  fixedUpdate(fixedDeltaTimeS: number): void {
    super.fixedUpdate(fixedDeltaTimeS);
    if (!this.active) return;

    const physicsEntities = this.findAllPhysicsBodies();

    const simpleGravitySources = Array.from(this.gravitySources.values()).map(
      (source) => ({
        position: { x: source.body.position.x, y: source.body.position.y },
        mass: source.planetGameObject.config.mass,
      })
    );

    physicsEntities.forEach((entityBody) => {
      PhysicsLogic.calculateAndApplyGravity(entityBody, simpleGravitySources);

      const planetDataForDensity = Array.from(this.gravitySources.values()).map(
        (source) => ({
          x: source.body.position.x,
          y: source.body.position.y,
          radius: source.planetGameObject.config.radius,
          atmosphereHeight: source.planetGameObject.config.atmosphereHeight,
          surfaceDensity: source.planetGameObject.config.surfaceDensity,
        })
      );
      const density = PhysicsLogic.calculateDensityAt(
        entityBody.position,
        planetDataForDensity
      );
      PhysicsLogic.calculateAndApplyAirResistance(entityBody, density);
    });
  }

  private findAllPhysicsBodies(): BodyType[] {
    const bodies: BodyType[] = [];
    this.gameObject.scene.managedGameObjects.forEach((go) => {
      if (go.active && go.isStarted) {
        const physicsBodyComp = go.getComponent(PhysicsBody);
        if (physicsBodyComp?.body && physicsBodyComp.active) {
          if (!physicsBodyComp.body.isStatic) {
            bodies.push(physicsBodyComp.body);
          }
        }
      }
    });
    return bodies;
  }

  private findAndRegisterInitialPlanets(): void {
    this.gameObject.scene.managedGameObjects.forEach((go) => {
      if (go instanceof Planet && go.active) {
        const physicsBodyComp = go.getComponent(PhysicsBody);
        if (physicsBodyComp?.body) {
          this.addGravitySource(physicsBodyComp.body, go);
        }
      }
    });
  }

  public addBody(body: BodyType): void {
    Logger.debug(
      LOGGER_SOURCE,
      `Body ${body.id} registered (already added by factory).`
    );
  }

  public removeBody(body: BodyType): void {
    try {
      MatterComposite.remove(this.matterEngine.world, body);
      Logger.info(LOGGER_SOURCE, `Body ${body.id} removed from Matter world.`);
    } catch (error) {
      Logger.error(LOGGER_SOURCE, `Error removing body ${body.id}:`, error);
    }
    if (this.gravitySources.has(body.id)) {
      this.removeGravitySource(body);
    }
  }

  public addGravitySource(
    planetBody: BodyType,
    planetGameObject: Planet
  ): void {
    if (!planetBody || !planetGameObject) {
      Logger.error(LOGGER_SOURCE, "Invalid arguments for addGravitySource");
      return;
    }
    if (this.gravitySources.has(planetBody.id)) {
      Logger.warn(
        LOGGER_SOURCE,
        `Gravity source Body ID ${planetBody.id} already registered.`
      );
      return;
    }

    const gravitySource: GravitySource = {
      body: planetBody,
      planetGameObject: planetGameObject,
    };
    this.gravitySources.set(planetBody.id, gravitySource);
    Logger.info(
      LOGGER_SOURCE,
      `Gravity source added: Planet '${planetGameObject.name}' (Body ID=${planetBody.id})`
    );
  }

  public removeGravitySource(bodyToRemove: BodyType): void {
    if (this.gravitySources.has(bodyToRemove.id)) {
      this.gravitySources.delete(bodyToRemove.id);
      Logger.info(
        LOGGER_SOURCE,
        `Removed gravity source with Body ID: ${bodyToRemove.id}`
      );
    } else {
      Logger.warn(
        LOGGER_SOURCE,
        `Gravity source Body ID ${bodyToRemove.id} not found for removal.`
      );
    }
  }

  public setWorldBounds(
    x: number,
    y: number,
    width: number,
    height: number,
    thickness: number = 60,
    left: boolean = true,
    right: boolean = true,
    top: boolean = true,
    bottom: boolean = true
  ): void {
    if (this.gameObject?.scene?.matter?.world) {
      this.gameObject.scene.matter.world.setBounds(
        x,
        y,
        width,
        height,
        thickness,
        left,
        right,
        top,
        bottom
      );
      Logger.info(LOGGER_SOURCE, "Matter world bounds set.", {
        x,
        y,
        width,
        height,
      });
    } else {
      Logger.error(
        LOGGER_SOURCE,
        "Cannot set world bounds - scene or matter world not available."
      );
    }
  }

  destroy(): void {
    this.gravitySources.clear();
    Logger.info(LOGGER_SOURCE, "Destroyed and resources cleared.");
    super.destroy();
  }
}
