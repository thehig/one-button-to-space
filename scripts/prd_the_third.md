# Product Requirements Document: One Button to Space (OBTS)

**Version:** 0.1 (Based on initial task generation)
**Author:** Gemini (Senior Dev)

## 1. Introduction & Overview

Alright, let's talk about "One Button to Space". The core concept is simple on the surface: a physics-based game where the player controls a rocket with minimal input – primarily a single touch/click for thrust and device tilt (or keys) for orientation. The goal is to navigate challenging environments, potentially delivering cargo, and eventually reaching space.

Beyond the core mechanics, OBTS aims to be a subtle commentary on the burgeoning era of space tourism, the resulting space pollution, and the future complexities of navigating an increasingly crowded orbital environment. A typical single-player gameplay loop will involve launching a rocket from a ground site and navigating it to a point in space, taking approximately 10 minutes and requiring careful resource management and trajectory planning.

Don't let the "one button" fool you; the complexity lies in the physics simulation and the interaction between the rocket and its environment. We're aiming for a satisfying, skill-based experience wrapped in a multiplayer context supporting up to 256 simultaneous players. We're building this using TypeScript across the board, with Phaser and Matter.js on the client (React/Vite) and Node.js/Express/Colyseus with Matter.js on the server, all structured within a pnpm monorepo.

In Multiplayer, the primary added gameplay complexity stems from collisions: colliding with another player's vessel causes both to explode, generating persistent debris. This debris, governed by the same physics simulation, can remain in orbit creating hazards, be flung into deep space, or even crash back down onto the planet, adding dynamic difficulty for all players.

## 2. Core Gameplay Mechanics

### 2.1. Rocket Control

- **Thrust:** Single touch/click activates the main engine, applying force to the rocket body. This is the primary interaction.
- **Orientation:**
  - **Mobile:** Use device accelerometer/gyroscope data (tilt) to control the rocket's angle.
  - **Desktop:** Use keyboard inputs (e.g., A/D or Left/Right arrows) as an alternative for orientation control.

### 2.1.1. Ship Types (Initial)

- **Tourist Ship:** Designed for passenger transport.
  - **Mission Goal:** Safely ferry passengers between points A and B.
  - **Primary Challenge:** Maintain passenger comfort by avoiding excessive G-forces and high rotational velocities. Think "fat kids and soccer moms" – smooth rides are key.
- **Cargo Ship:** Designed for hauling resources/cargo.
  - **Mission Goal:** Move specific cargo from point A to point B.
  - **Primary Challenge:** Operate under strict fuel and time constraints, often requiring aggressive maneuvers and optimized trajectories. Think time-attack or race-style gameplay.

### 2.2. Physics Simulation (Shared Client & Server)

- **Dual Simulation Model:** Both the client and the server MUST run the _exact same_ deterministic physics simulation code using Matter.js. This ensures consistency and enables offline play.
- **Engine:** Matter.js will handle the core 2D physics simulation.
- **Gravity:** Implement variable gravity based on proximity to celestial bodies (planets, moons, etc.). This is crucial for realistic orbital mechanics and landings.
- **Atmospheric Effects:**
  - Simulate atmospheric density based on altitude/distance from planetary surfaces.
  - Implement air resistance (drag) that varies with density and rocket velocity.
  - Include atmospheric re-entry heating effects (visual/potentially gameplay impacting later).
- **Collision:**
  - Use precise collision detection, likely mesh-based, matching the rocket's visual representation.
  - Implement realistic collision responses between the rocket, terrain, and other objects.
  - Develop a landing detection system to differentiate between successful landings and crashes based on impact velocity and orientation.
- **Deterministic Simulation:** The simulation must run a fixed-timestep update loop for consistent and reproducible physics on both client and server.

### 2.3. Multiplayer (Colyseus)

- **Real-time Interaction:** Use Colyseus for managing game rooms and real-time communication between clients and the server, designed to support up to 256 players concurrently.
- **State Synchronization & Server Authority:** In multiplayer, player inputs are sent to the server. The server runs its simulation and broadcasts the authoritative state (positions, velocities, etc.) to all clients.
- **Client-Side Prediction & Reconciliation:** To maintain responsiveness, the client _also_ runs the simulation locally, predicting the results of its inputs. When the client receives an authoritative state update from the server that differs from its prediction, it reconciles its local state to match the server's. This requires the client and server simulations to be perfectly synchronized.
- **Interpolation:** Use interpolation on the client to smooth the visual movement of remote players/objects between authoritative state updates received from the server.
- **Persistent Debris:**
  - Player-vs-Player collisions result in the destruction of both rockets and the creation of persistent debris objects.
  - Debris objects are physics-enabled bodies subject to gravity, atmospheric effects, and further collisions.
  - The server simulation tracks debris, and their state is synchronized to clients.
  - Debris can pose navigational hazards, remain in orbit, be ejected from the system, or impact planetary surfaces.

### 2.4. Cargo System (Initial Focus: Cargo Missions)

- **Mechanics:** Design and implement a system for picking up, transporting, and delivering resource-based cargo items, primarily for Cargo Ship missions.
- **Physics:** Cargo should have its own physics properties (mass) and directly affect the Cargo Ship's mass, inertia, and handling when attached.

### 2.5. Mission System (Initial Focus: Tourism & Cargo)

- **Structure:** Develop a framework for defining missions with objectives, target locations, and progression.
- **Initial Mission Types:**
  - **Tourism Missions:** Players pilot Tourist Ships, focusing on reaching destinations while adhering to passenger comfort constraints (G-force limits, low rotation). Success is based on safety and smoothness.
  - **Cargo Missions:** Players pilot Cargo Ships, focusing on delivering resources within tight time and fuel limits. May include G-force constraints as an additional challenge. Success is based on speed and efficiency.

## 3. Client-Side Implementation (Phaser/React)

### 3.1. Rendering & Visuals

- **Engine:** Phaser is our primary rendering engine on the client.
- **Rocket Visuals:**
  - Use a high-quality rocket sprite.
  - Implement animated thruster effects that activate based on player input.
  - Support tinting/coloring for player differentiation in multiplayer.
- **Environment:**
  - Implement a procedurally generated, deterministic star field background for visual appeal and consistency. Use a seeded random number generator.
- **Camera:**
  - Provide camera controls, specifically mouse-wheel zoom for desktop users. Implement smooth zoom transitions.
- **Layered Rendering:** Organize game objects into distinct rendering layers (e.g., Background, Game Objects, UI/HUD) for clarity and control.

### 3.2. User Interface (UI) / Heads-Up Display (HUD)

- Develop necessary UI elements to display game state (e.g., velocity, altitude, fuel, mission objectives - when implemented).
- **Menu System:** Implement a main menu screen that allows players to:
  - Select maps/levels for offline play.
  - Connect to the multiplayer server.
- Provide feedback mechanisms (visual/audio) for player actions and game events (e.g., successful landing, crash, cargo pickup).
- Implement a Debug Overlay for development, including controls to pause/step/run the server-side physics simulation.

### 3.3. Architecture & Lifecycle

- Further information can be found below in Section 5
- **HMR:** Ensure the client application handles Hot Module Replacement (HMR) gracefully during development, properly cleaning up and resetting game managers (especially Phaser/MatterJS instances and network connections) to avoid state corruption.

## 4. Project Structure & Development Environment

- **Monorepo:** Utilize a pnpm monorepo to manage `client`, `server`, and `shared` packages.
- **Shared Physics Code:** Critical physics logic, constants, and simulation stepping MUST reside in the `shared` package to guarantee identical execution on both client and server.
- **TypeScript:** Use TypeScript consistently across all packages.
- **Build/Dev:** Standard Vite setup for the client, `tsc` or similar for the server.

## 5. Engine Architecture & Design Principles

To ensure a consistent, predictable, professional, and efficient engine, the following principles and structure should be followed:

### 5.1. Modularity through Managers/Systems

- **Separation of Concerns:** Core functionality will be separated into distinct managers (or systems) to improve organization, testability, and maintainability.
- **Core Managers:**
  - `InputManager`: Handles raw input (keyboard, mouse, touch, gamepad) and translates it into game actions/events which are 'emitted'
  - `NetworkManager`: Manages client-server communication (Colyseus), state sync, input transmission, and updates.
  - `PhysicsManager`: Encapsulates shared physics world setup (Matter.js), simulation stepping, and collision detection. **Must contain logic shared between client and server.**
  - `SceneManager` (Phaser Built-in): Manages Phaser Scenes (loading, switching, lifecycle).
  - `EntityManager` / `GameObjectManager`: Creates, tracks, updates, and destroys game entities/objects.
  - `CameraManager`: Wraps Phaser's camera controls for potentially complex camera behavior (following, zoom, effects).
  - `UIManager`: Manages UI elements (HUD, menus), implemented in React/HTML elements and connected via emitters
  - `AudioManager`: Handles loading/playing sounds and music.
  - `AssetManager` (Phaser Built-in): Leverages Phaser's loader, potentially with wrappers for tracking or dynamic loading.
- **Integration:** Managers will primarily be instantiated and orchestrated within Phaser Scenes. Scene/Global Plugins will be used for cross-scene or global functionality.

### 5.2. Structure and Organization

- **Scene-Centric:** Phaser Scenes are the primary organizational unit.
- **Shared Physics Code:** Critical physics logic, constants, simulation stepping, and configuration **MUST** reside in the `shared` package to guarantee identical simulation on client and server.
- **Dependency Injection (DI):** Pass necessary dependencies during initialization (e.g., `PlayerController` receives `InputManager`). Avoid global singletons where possible.
- **Event Bus:** Utilize Phaser's built-in event emitters (`scene.events`, `game.events`) for communication between managers to reduce direct coupling.
- **Entity Component System (ECS) (Recommended):** Consider implementing or using a lightweight ECS library.
  - **Components:** Pure data (e.g., `Position`, `Velocity`, `Renderable`).
  - **Entities:** IDs grouping components.
  - **Systems (Managers):** Logic operating on entities with specific components (e.g., `PhysicsSystem` operates on entities with `Position`, `Velocity`, `PhysicsBody`).
- **Constants:** Maintain dedicated files for shared constants (event names, scene keys, asset keys, physics values) in the `shared` package.

### 5.3. Lifecycle Management

- **Phaser Scene Lifecycle:** Utilize `init()`, `preload()`, `create()`, and `update()` effectively.
  - `create()`: Primary hook for manager instantiation, setup dependent on assets, event listener registration.
  - `update()`: Delegate frame-by-frame logic to manager `update()` methods. Maintain a logical update order (e.g., Input -> Network -> Physics -> Logic -> Rendering).
- **Manager Lifecycle:** Custom managers must implement robust lifecycle methods.
  - `init()`/`constructor()`: Basic setup.
  - `create()`/`start()`: Setup requiring scene readiness/assets.
  - `update(time, delta)`: Per-frame logic.
  - `shutdown()`/`destroy()`: **Essential.** Called via Scene `shutdown` or `destroy` events. Must rigorously clean up event listeners, timers, network connections, and other resources to prevent leaks.

### 5.4. Goal Alignment

- **Consistency/Predictability:** Achieved through defined manager roles, clear lifecycles, shared physics, and consistent patterns (DI/Events).
- **Professionalism/Maintainability:** Driven by separation of concerns, TypeScript usage, and testability (via DI).
- **Efficiency:** Requires careful optimization within `update` loops, efficient data handling, and mindful network usage.

## 6. Non-Functional Requirements

- **Performance:** Both client and server should be reasonably performant. Optimize state synchronization and rendering.
- **Scalability:** While initial focus is on a single room, the server architecture (Colyseus) should allow for scaling to multiple rooms later.
- **Maintainability:** Write clean, well-documented, and modular code. Follow established patterns within the chosen frameworks.

## 7. Future Considerations (Beyond Initial Tasks)

- Audio design (sound effects, music)
- Detailed level design and progression mechanics
- Persistence (saving player progress, high scores)
- Advanced visual effects (particles, shaders)
- More complex mission types or game modes

---

This covers the core requirements based on the tasks we've laid out. Remember, this is iterative. We'll refine this as we build. Focus on getting the core physics and networking solid first, as everything else builds on that foundation. Let me know if anything is unclear.
