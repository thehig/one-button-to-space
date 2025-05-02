# Client Application Lifecycle & Manager System

This document outlines the client application's startup, cleanup, and Hot Module Replacement (HMR) lifecycle, managed primarily by the `GameManagerRegistry` and the `BaseManager` class.

## Overview

The client uses a system of singleton managers (extending `BaseManager`) coordinated by a central `GameManagerRegistry`. This ensures managers are initialized, updated, and cleaned up in a predictable order, crucial for stability and preventing resource leaks, especially during HMR.

## Core Components

- **`main.tsx`**: The main application entry point. Responsible for initializing the registry, creating the Phaser game instance, rendering the React UI, and triggering cleanup on HMR or page unload.
- **`BaseManager.ts`**: Abstract base class defining the standard manager lifecycle: `init()`, `update(time, delta)`, `cleanup(isHMRDispose)`, `destroy()`.
- **`GameManagerRegistry.ts`**: Singleton responsible for:
  - Registering all other manager singletons.
  * Orchestrating the lifecycle calls (`initializeManagers`, `updateManagers`, `cleanupAllManagers`, `destroyManagers`) across all registered managers.
- **Manager Singletons** (`EntityManager`, `InputManager`, etc.): Implement specific game functionalities and manage their own resources, adhering to the `BaseManager` lifecycle. They register themselves with the `GameManagerRegistry` upon instantiation.

## Application Flowcharts

### 1. Initial Startup / Full Reload

```mermaid
graph TD
    A[Browser Loads main.tsx] --> B(initializeApp Async Function);
    B --> C{GameManagerRegistry.getInstance()};
    C --> D[Managers Instantiate & Register];
    D --> E{GameManagerRegistry.initializeManagers()};
    E --> F[Call manager.init() on all];
    F --> G[initGame() - Create Phaser.Game];
    G --> H[renderApp() - Render React UI];
    H --> I[Application Running];
    I --> J(Game Loop - Phaser Scene Update);
    J --> K{GameManagerRegistry.updateManagers(time, delta)};
    K --> L[Call manager.update() on all];
    L --> J;  // Loop back to game loop
```

### 2. HMR Update

```mermaid
graph TD
    A[Vite HMR Trigger] --> B(Module `dispose` Hook in main.tsx);
    B --> C{cleanupApp(isHMRDispose = true)};
    C --> D{GameManagerRegistry.cleanup(true)};
    D --> E[Registry calls manager.cleanup(true) on all];
    E --> F[Registry clears manager map];
    F --> G[Phaser Scenes Stopped];
    G --> H[Phaser Game Instance Destroyed];
    H --> I[React Root Unmounted];
    I --> J[Vite Replaces Module Code];
    J --> K(Module Runs Again - initializeApp());
    K --> L{GameManagerRegistry.getInstance()};
    L --> M[Managers Re-Instantiate & Re-Register];
    M --> N{GameManagerRegistry.initializeManagers()};
    N --> O[Call manager.init() on all];
    O --> P[initGame() - Create New Phaser.Game];
    P --> Q[renderApp() - Render React UI];
    Q --> R[Application Running Again];
```

### 3. Page Unload / Full Teardown

_Note: Browser page unload events (`beforeunload`, `unload`) are less reliable for complex cleanup, especially async operations. The primary mechanism relies on HMR dispose or explicit application shutdown logic if implemented._ Assume `cleanupApp(false)` is triggered:

```mermaid
graph TD
    A[Page Unload / Shutdown Trigger] --> B{cleanupApp(isHMRDispose = false)};
    B --> C{GameManagerRegistry.cleanup(false)};
    C --> D[Registry calls manager.cleanup(false) on all];
    D --> E[Registry clears manager map];
    E --> F[Phaser Scenes Stopped];
    F --> G[Phaser Game Instance Destroyed];
    G --> H[React Root Unmounted];
    H --> I[Application Cleaned Up];
```

## Manager Responsibilities

- **`GameManagerRegistry`**: Central orchestrator. Manages lifecycle calls for all other managers.
- **`BaseManager`**: Defines the lifecycle interface (`init`, `update`, `cleanup`, `destroy`).
- **`EntityManager`**: Manages game entities (players, planets, etc.), state synchronization, creation, and removal.
- **`InputManager`**: Handles raw input device events (keyboard, device orientation) via `DeviceOrientationManager`. Provides state checking methods (`isKeyDown`, `getTargetRocketAngleRadians`).
- **`NetworkManager`**: Manages WebSocket connection to the Colyseus server, room joining/leaving, message sending/receiving, and basic network stats.
- **`CameraManager`**: Controls the main Phaser camera, including zooming and following targets.
- **`PhysicsManager`**: Configures the MatterJS world for the current scene, sets up collision event listeners, and provides physics utility functions.
- **`SceneManager`**: Handles starting and stopping Phaser scenes. Relies on a (currently DEV-mode) global reference to the `Phaser.Game` instance.
- **`TimeManager`**: Provides access to Phaser's game time, delta, FPS, and timer event creation (`addTimer`, `addLoop`).
- **`SceneInputManager`** (Non-singleton): Handles _scene-specific_ input _processing_. Reads state from `InputManager` and sends commands via `NetworkManager`. Instantiated and managed by individual scenes (e.g., `GameScene`).

## HMR & `cleanup(isHMRDispose)`

The `cleanup(isHMRDispose: boolean)` method is crucial:

- It's called **before** a manager instance is reset or destroyed.
- **`isHMRDispose = true`**: Indicates cleanup is happening due to a Vite HMR update. Managers should:
  - Release resources that **cannot** persist across module reloads (e.g., event listeners tied to the old module code, DOM references).
  - **Preserve** essential state if possible (e.g., network connection, non-serializable state that can be restored by the new instance).
  - Avoid actions that shouldn't happen during HMR (like explicitly leaving the Colyseus room in `NetworkManager.cleanup`, as `main.tsx` controls this contextually).
- **`isHMRDispose = false`**: Indicates a full teardown (like page unload or `resetInstance` calls). Managers should perform complete cleanup, releasing all resources and resetting all state.

`GameManagerRegistry.cleanupAllManagers` iterates through managers (currently in reverse registration order) and calls their respective `cleanup` methods.

## Adding New Managers

1.  Create your new manager class, extending `BaseManager`.
2.  Implement the protected constructor and the static `getInstance` method, ensuring it calls `GameManagerRegistry.getInstance().registerManager(this)` after creating the instance.
3.  Implement the static `resetInstance` method, calling `YourManager._instance.cleanup(false)` before nullifying the static instance.
4.  Implement the required lifecycle methods (`init`, `update`, `cleanup`, `destroy`). Pay close attention to resource allocation in `init` and release in `cleanup`.
5.  Consider dependencies: If Manager B depends on Manager A, ensure Manager A is instantiated and registered _before_ Manager B tries to access it (usually handled by calling `getInstance` when needed).
