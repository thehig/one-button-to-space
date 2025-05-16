# Product Requirements Document: One Button to Space (OBTS) - Implementation Focused

**Version:** 0.4 (Restructured for Implementation Flow)
**Author:** David Higgins (Senior Dev)

## 1. Introduction & Overview

Alright, let's talk about "One Button to Space". The core concept is simple on the surface: a physics-based game where the player controls a rocket with minimal input – primarily a single touch/click for thrust and device tilt (or keys) for orientation. The goal is to navigate challenging environments, potentially delivering cargo, and eventually reaching space.

Beyond the core mechanics, OBTS aims to be a subtle commentary on the burgeoning era of space tourism, the resulting space pollution, and the future complexities of navigating an increasingly crowded orbital environment. A typical single-player gameplay loop will involve launching a rocket from a ground site and navigating it to a point in space, taking approximately 10 minutes and requiring careful resource management and trajectory planning.

Don't let the "one button" fool you; the complexity lies in the physics simulation and the interaction between the rocket and its environment. We're aiming for a satisfying, skill-based experience wrapped in a multiplayer context supporting up to 256 simultaneous players. We're building this using TypeScript across the board, with Phaser and Matter.js on the client (React/Vite) and Node.js/Express/Colyseus with Matter.js on the server, all structured within a pnpm monorepo.

In Multiplayer, the primary added gameplay complexity stems from collisions: colliding with another player's vessel causes both to explode, generating persistent debris. This debris, governed by the same physics simulation, can remain in orbit creating hazards, be flung into deep space, or even crash back down onto the planet, adding dynamic difficulty for all players.

## 2. Initial Project Setup & Environment

This phase focuses on establishing the foundational codebase structure and development environment.

**Current Status (as of [Current Date/Sprint]):**

- **Monorepo (pnpm):** Structure with `client` and `server` packages is in place.
- **TypeScript:** Configured and used in both `client` and `server`.
- **Client Setup (Parcel/Phaser):** Phaser is integrated and rendering basic scenes. Parcel is used for client bundling.
- **Server Setup (Node.js/Express/Colyseus):** Colyseus server is operational with Express, serving rooms and handling client connections. `tsx` is used for development.
- **Package Linking & Dependencies:** Core dependencies (Phaser, Colyseus SDKs, Express, TypeScript) are installed and functional.
- **Basic Client-Server Connection:** Clients can connect to server rooms, and basic message passing for input is functional. Room state synchronization (for player lists and basic properties) is working.
- **Input Handling:** Basic directional input is captured on the client and processed on the server.
- **Networking Features:** Foundational networking patterns (interpolation, client-side prediction, fixed tickrate) are demonstrated in example scenes/rooms (`Part1` through `Part4`).

**Key Outstanding Items for this Phase:**

- **`shared` Package:** The crucial `shared` package, intended for common code like the Matter.js physics simulation, **has not yet been created or integrated.** This is a top priority.
- **Matter.js Integration:** Matter.js, the specified physics engine, has not yet been introduced into the project. Current client physics is Phaser's default "Arcade" physics, and server-side "movement" is direct coordinate manipulation.

- **Monorepo:** Utilize a pnpm monorepo to manage distinct packages:
  - `client`: Contains the ~~React/Vite~~ Parcel frontend and Phaser game client. **(Status: Implemented with Parcel, React integration is not present as per current codebase, PRD mentions React/Vite but current client is Parcel/Phaser only).**
  - `server`: Contains the Node.js/Express/Colyseus backend server. **(Status: Implemented).**
  - `shared`: **Crucial package.** Houses all code intended to be identical across client and server, primarily the core physics simulation logic (Matter.js setup, stepping, constants) and potentially shared data structures/types. **(Status: NOT YET IMPLEMENTED - CRITICAL NEXT STEP).**
- **TypeScript:** Use TypeScript consistently across all packages (`client`, `server`, `shared`). Configure strict `tsconfig.json` files for each package and a base config at the root. **(Status: Implemented for `client` and `server`).**
- **Client Setup (~~Vite/React~~ Parcel/Phaser):**
  - Initialize the `client` package using ~~Vite with the React TypeScript template~~ Parcel. **(Status: Implemented with Parcel).**
  - Integrate Phaser into the ~~React application~~ client. **(Status: Implemented).**
- **Server Setup (Node.js/Express/Colyseus):**
  - Initialize the `server` package with Node.js and TypeScript (`tsx` for dev, `tsc` for building). **(Status: Implemented).**
  - Set up Express and integrate Colyseus for WebSocket communication and room management. **(Status: Implemented).**
- **Package Linking & Dependencies:**
  - Use `pnpm` workspaces to manage dependencies and link local packages (`client`, `server`, `shared`). **(Status: Implemented for `client` and `server`; `shared` pending).**
  - Install necessary dependencies: Phaser, Matter.js, ~~React, Vite,~~ Colyseus (client & server SDKs), Express, TypeScript, Node.js types, etc. using pnpm catalog. **(Status: Core dependencies installed; Matter.js pending).**
- **Initial Verification:** Ensure basic project structure compiles, runs, and packages can import from `shared`. Confirm basic client-server connection setup is possible. **(Status: Client-server connection and basic sync are functional. `shared` package import is NOT YET POSSIBLE).**

## 3. Core Engine Architecture & Implementation (Phaser/Matter.js)

This is the **primary focus** of the initial development effort. Building a modular, maintainable, and consistent engine is paramount. Expect **significant iteration and debugging** during this phase.

**Current Status (as of [Current Date/Sprint]):**

- **Phaser Client Structure:** Client is organized into scenes (`BaseNetworkScene`, `Part1-4Scenes`) demonstrating various networking features.
- **Server Room Structure:** Server uses rooms (`BaseRoom`, `Part1-4Rooms`) corresponding to client scenes, with shared command/schema logic.
- **Basic Networking:** Connection, input sending, and state updates (player join/leave, basic properties) are functional.
- **Colyseus Schemas:** Schemas for `BaseRoomState`, `BasePlayer`, `InputData`, and `PlayerWithInputQueue` are defined and used on the server, and state is synchronized to clients.

**Key Outstanding Items for this Phase (TOP PRIORITY):**

- **Shared Physics (`shared` Package & Matter.js):** The entire concept of a shared, deterministic Matter.js physics simulation residing in a `shared` package **is not yet implemented.** This is the most critical next step for the core engine. Current client uses Phaser's Arcade physics, and server logic is direct coordinate manipulation.
- **Manager/System Modularity (Phaser Client):** While scenes exist, the detailed manager structure (`PhysicsManager` using shared code, `InputManager`, `NetworkManager` with advanced reconciliation, `EntityManager`, etc.) as described in the PRD is largely conceptual and needs to be built on top of the current example structure, especially integrating the `shared` physics.
- **Server-Side Physics (Matter.js):** The server rooms currently use simple state manipulation based on inputs. They need to be refactored to use the `shared` Matter.js physics simulation.
- **Client-Server Synchronization (Advanced):** While basic prediction/interpolation examples exist, the robust reconciliation and synchronization strategy tied to a shared Matter.js simulation needs full implementation as per PRD sections 3.2 and 3.7.

### 3.1. Core Principles

- **Consistency & Predictability:** Ensure identical behavior across client/server through shared code and deterministic simulation.
- **Professionalism & Maintainability:** Emphasize separation of concerns, clear interfaces, and robust lifecycle management.
- **Efficiency:** Design for performant update loops and mindful resource usage.

### 3.2. Shared Physics (in `shared` Package)

- **Dual Simulation Model:** Both client and server **MUST** run the _exact same_ deterministic physics simulation code. **(Status: NOT YET IMPLEMENTED. Currently, client uses Phaser Arcade, server uses direct manipulation. Matter.js in `shared` is the goal).**
- **Engine:** Matter.js handles core 2D physics. All Matter.js setup, configuration, world stepping logic, collision categories, constants, and utility functions related to the core simulation reside in the `shared` package. **(Status: NOT YET IMPLEMENTED).**
- **Deterministic Update Loop:** Implement a fixed-timestep update loop within the shared physics module for consistent and reproducible physics. **(Status: Basic fixed timestep demonstrated in `Part4Scene`/`Room`, but needs to be integrated with shared Matter.js simulation).**

### 3.3. Modularity via Managers/Systems (Phaser Client)

Core functionality will be separated into distinct managers/systems within Phaser Scenes. **(Status: Current structure is scene-based from examples. The detailed manager architecture below needs to be built, heavily relying on the upcoming `shared` physics package).**

- **Core Managers:**
  - `PhysicsManager`: **Crucially, this manager imports and utilizes the simulation logic from the `shared` package.** It interfaces between Phaser and the shared Matter.js instance. Handles local world stepping on the client. **(Status: NOT YET IMPLEMENTED).**
  - `InputManager`: Handles raw input (keyboard, mouse, touch, device orientation) and translates it into abstract game actions/events (e.g., `thrust_start`, `rotate_left`). Emits these events via an event bus. **(Status: Basic cursor input captured in scenes; dedicated manager and abstract game actions pending).**
  - `NetworkManager`: Manages Colyseus client connection, room joining, sending client inputs to the server, receiving authoritative state updates, and handling state synchronization (prediction/reconciliation, interpolation). **(Status: Basic connection/sending in `BaseNetworkScene`. Advanced sync tied to shared physics pending).**
  - `SceneManager` (Phaser Built-in): Manages Phaser Scenes (loading, switching, lifecycle).
  - `EntityManager` / `GameObjectManager`: Creates, tracks, updates, and destroys game entities/objects (e.g., rockets, debris). Integrates with Phaser GameObjects and the `PhysicsManager`.
  - `CameraManager`: Wraps Phaser's camera controls for potentially complex behaviors (following, zoom).
  - `UIManager`: Manages UI elements (HUD, menus). Likely interfaces with React components outside the Phaser canvas, communicating via the event bus.
  - `AudioManager`: Handles loading/playing sounds and music.
  - `AssetManager` (Phaser Built-in): Leverages Phaser's loader.
- **Integration:** Managers are instantiated and orchestrated within Phaser Scenes. Utilize Scene/Global Plugins for cross-scene/global functionality.

### 3.4. Structure and Organization (Phaser Client)

- **Scene-Centric:** Phaser Scenes are the primary organizational unit (e.g., `BootScene`, `MainMenuScene`, `GameScene`).
- **Dependency Injection (DI):** Pass necessary dependencies during manager/controller initialization (e.g., a `PlayerRocketController` might receive `InputManager` and `NetworkManager`). Avoid global singletons where feasible.
- **Event Bus:** Utilize Phaser's built-in event emitters (`scene.events`, `game.events`) or potentially a dedicated event bus for communication between managers, reducing direct coupling. Define event constants in `shared`.
- **Entity Component System (ECS) (Recommended):** Strongly consider implementing or using a lightweight ECS library for managing game entities and their properties. This aligns well with the manager/system pattern.
  - **Components:** Pure data (e.g., `Position`, `Velocity`, `Renderable`, `PhysicsBody`, `PlayerControlled`).
  - **Entities:** IDs grouping components.
  - **Systems (Managers):** Logic operating on entities with specific components (e.g., `PhysicsManager` operates on entities with `Position`, `Velocity`, `PhysicsBody`; `RenderSystem` operates on `Position`, `Renderable`).
- **Constants:** Maintain dedicated files for shared constants (event names, scene keys, asset keys, physics values, collision categories) **primarily in the `shared` package**.

### 3.5. Lifecycle Management

- **Phaser Scene Lifecycle:** Utilize `init()`, `preload()`, `create()`, `update()` effectively.
  - `create()`: Instantiate managers, set up event listeners.
  - `update(time, delta)`: Call manager `update()` methods in a logical order (e.g., Input -> Network Send -> Physics Step -> Game Logic -> Network Receive/Reconcile -> Render Update).
- **Manager Lifecycle:** Ensure custom managers have robust `init()`, `create()`/`start()`, `update()`, and especially `shutdown()`/`destroy()` methods.
  - **`shutdown()`/`destroy()`: Essential.** Must rigorously clean up event listeners, timers, network connections, Matter.js bodies/constraints, and other resources to prevent memory leaks, especially with HMR.
- **HMR:** Ensure the client application handles Hot Module Replacement gracefully, properly triggering cleanup (`shutdown`/`destroy`) and re-initialization of game managers and Phaser/Matter.js instances.

### 3.6. Server-Side Architecture (Colyseus)

- **Colyseus Room:** Define a custom Colyseus Room (`GameRoom`) to manage the game state.
- **Server-Side Physics:** The `GameRoom` **MUST** instantiate and run the _exact same_ physics simulation using the code from the `shared` package as the client. **(Status: NOT YET IMPLEMENTED. Current rooms use direct state manipulation via commands).**
- **State Schema:** Use `@colyseus/schema` to define the synchronized state (player positions, velocities, debris, etc.).
- **Input Handling:** Receive player inputs sent via the `NetworkManager`.
- **Server Authority:** Apply inputs to the server-side physics simulation. The server's simulation result is the authoritative state.
- **State Broadcasting:** Broadcast the authoritative schema state updates to all connected clients at a regular interval.

### 3.7. Client-Server Synchronization

- **Client-Side Prediction:** The client `PhysicsManager` runs the shared simulation locally based on player input for immediate feedback. **(Status: Basic prediction shown in `Part3/4Scene` via direct coordinate changes. Integration with shared Matter.js physics via `PhysicsManager` pending).**
- **Reconciliation:** When the `NetworkManager` receives an authoritative state update from the server, it compares it to the client's predicted state. If different, it must reconcile the client's state (e.g., snap position, potentially replay inputs since the last acknowledged state). **(Status: Basic visual diff in `Part3/4Scene`. Full reconciliation with shared physics pending).**
- **Interpolation:** Smooth the visual representation of _remote_ entities between state updates. **(Status: Basic interpolation shown in `Part2Scene` and `BaseNetworkScene`).**

## 4. Core Gameplay Mechanics

Once the core engine architecture is stable, implement the fundamental gameplay elements.

### 4.1. Rocket Control

- Implement input handling in `InputManager` for thrust (single touch/click) and orientation (device tilt or keyboard).
- Translate input events into forces/torques applied to the rocket's physics body via a `PlayerRocketController` or similar system interacting with the `PhysicsManager`.

### 4.2. Shared Physics Simulation Details (To Implement within `shared`)

**(Status: This entire section is PENDING the creation of the `shared` package and Matter.js integration.)**

- **Gravity:** Implement variable gravity based on proximity to celestial bodies.
- **Atmospheric Effects:** Simulate density, drag, and potentially re-entry heating effects.
- **Collision:** Configure precise collision detection (e.g., using `matter-collision-events` or similar) and realistic responses. Implement landing detection logic based on impact velocity/angle.

### 4.3. Basic Multiplayer Implementation (Colyseus)

**(Status: Foundational elements are in place based on example scenes/rooms. Needs to be evolved to use the shared Matter.js physics and robust manager architecture.)**

- Establish basic client connection to the server room.
- Implement sending client inputs from `NetworkManager` to the `GameRoom`.
- Implement server broadcasting of the basic `@colyseus/schema` state (e.g., rocket positions/rotations).
- Implement basic client-side prediction, state reception, and reconciliation in `NetworkManager`.
- Implement basic interpolation for remote player rockets.

## 5. Initial Feature Implementation

Build upon the core engine and mechanics.

### 5.1. Ship Types & Initial Missions

- Define data structures for different ship types (`Tourist`, `Cargo`) with varying physics properties (mass, engine force) and constraints.
- **Cargo System:**
  - Implement mechanics for picking up, attaching (affecting physics), and delivering cargo items.
  - Design initial Cargo Missions (Point A to B, time/fuel limits).
- **Mission System Framework:**
  - Develop a basic structure for defining missions (objectives, triggers, success/fail conditions).
  - Implement initial Tourism Missions (Point A to B, passenger comfort constraints - G-force/rotation limits).

### 5.2. Multiplayer Enhancements

- **Persistent Debris:**
  - On player-vs-player collision detection (server-side), destroy both rockets.
  - Spawn new debris physics bodies in the server simulation.
  - Add debris state to the `@colyseus/schema` for synchronization.
  - Ensure clients render debris correctly.

## 6. Client-Side Implementation Details (Phaser/React)

Focus on the user-facing elements.

### 6.1. Rendering & Visuals (Phaser)

- Load and display rocket sprites.
- Implement animated thruster effects tied to input state.
- Support player differentiation (tinting/coloring).
- Implement a deterministic, seeded procedural star field background.
- Implement camera controls (zoom, potentially follow) via `CameraManager`.
- Organize rendering using Phaser layers or depth sorting.

### 6.2. User Interface (UI) / Heads-Up Display (HUD) (React/HTML)

- Develop UI components (likely React) to display velocity, altitude, fuel, mission info. Connect to game state via the event bus originating from Phaser managers.
- Implement Main Menu (React Component): Allow map/offline selection, connect to multiplayer server.
- Provide feedback mechanisms (visual/audio triggers) via `UIManager`/`AudioManager`.
- Implement Debug Overlay: Include controls to interact with the physics simulation (pause/step) and view debug info.

## 7. Non-Functional Requirements

- **Performance:** Optimize client rendering and server simulation/synchronization.
- **Scalability:** Colyseus architecture supports future scaling.
- **Maintainability:** Enforce clean code, documentation, and modularity established in the core engine phase.

## 8. Future Considerations (Beyond Initial Scope)

- Audio design (SFX, music)
- Detailed level design, progression
- Persistence (player progress, high scores)
- Advanced visual effects (particles, shaders)
- More complex missions/modes

---

This restructured document prioritizes establishing a solid technical foundation before building specific gameplay features. The focus is on the **Project Setup** and **Core Engine Architecture** first. Remember, this is iterative; details will be refined during implementation.
